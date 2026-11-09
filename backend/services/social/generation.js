/**
 * Background creative factory.
 *
 * Text + strategy: Gemini (with template fallback).
 * Image: Gemini image model (with the local brand designer fallback).
 * Reel: real MP4 rendered from the poster with ffmpeg.
 *
 * Progress is written to SocialPlan.generation after every creative so the
 * dashboard can poll and show real progress instead of a spinner.
 */

const fs = require('fs')
const path = require('path')
const SocialPlan = require('../../models/SocialPlan')
const Business = require('../../models/Business')
const SocialAccount = require('../../models/SocialAccount')
const SocialPost = require('../../models/SocialPost')
const { SM_PLANS } = require('../../data/socialContent')
const { buildContentPlan, categoryPalette, PLATFORM_LABELS } = require('../ai/contentPlan')
const { generateImage, imageBlocked } = require('../ai/gemini')
const { generateAiImage } = require('../media/aiImage')
const { renderCreative } = require('../media/creative')
const { renderPresenterReel, renderReelVideo } = require('../media/video')
const { saveBuffer, resolveUploadPath } = require('../media/store')
const { loadLogo } = require('../media/logo')
const { fetchStockPhoto, searchQueryFor } = require('../media/stock')
const { ensurePresenter } = require('../media/presenter')

const active = new Map()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const asText = (value, max = 0) => {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  return max > 0 ? text.slice(0, max) : text
}

const publicPlatforms = (business) =>
  [...new Set((business.accounts || []).map((account) => String(account.platformId || '')).filter((id) => PLATFORM_LABELS[id]))]

/**
 * Onboarding may only list a couple of platforms, but every account the user
 * actually connected should receive the generated content. Merge both sources.
 */
async function planTargets(userId, business) {
  const connected = await SocialAccount.find({ userId, connected: true })
    .select('platform username')
    .lean()
    .catch(() => [])

  const byPlatform = new Map()
  for (const account of business.accounts || []) {
    const id = String(account.platformId || '').trim()
    if (!PLATFORM_LABELS[id] || byPlatform.has(id)) continue
    byPlatform.set(id, { platformId: id, handle: account.handle || '' })
  }
  for (const account of connected) {
    if (!PLATFORM_LABELS[account.platform]) continue
    const current = byPlatform.get(account.platform) || { platformId: account.platform, handle: '' }
    if (!current.handle && account.username) current.handle = account.username
    byPlatform.set(account.platform, current)
  }
  return [...byPlatform.values()]
}

async function patchGeneration(userId, patch) {
  await SocialPlan.updateOne({ userId }, { $set: { generation: patch } }).catch(() => {})
}

async function finishGeneration(userId) {
  const record = await SocialPlan.findOne({ userId }).lean()
  if (!record) return
  const failed = Number(record.generation?.failed || 0)
  const total = Number(record.generation?.total || 0)
  const completed = Number(record.generation?.completed || 0)
  const videos = (record.items || []).filter((item) => item.videoPath).length
  const images = (record.items || []).filter((item) => item.imagePath).length
  const status = failed > 0 ? 'partial' : 'done'
  const message =
    failed > 0
      ? `${Math.max(completed - failed, 0)} of ${total} creatives are ready (${images} banners, ${videos} AI presenter videos). ${failed} could not be rendered.`
      : `${total} creatives are ready: ${images} brand banners${videos ? ` and ${videos} AI presenter videos with voiceover` : ''}.`
  await SocialPlan.updateOne(
    { userId },
    {
      $set: {
        'generation.status': status,
        'generation.phase': 'Ready',
        'generation.message': message,
        'generation.finishedAt': new Date(),
      },
    }
  ).catch(() => {})

  if (record.autoPublish !== false) {
    try {
      const { scheduleGeneratedContent } = require('./schedule')
      const count = await scheduleGeneratedContent(userId)
      if (count > 0) {
        await SocialPlan.updateOne(
          { userId },
          { $set: { 'generation.message': `${message} ${count} post${count === 1 ? '' : 's'} auto-scheduled to connected accounts.` } }
        ).catch(() => {})
      }
    } catch (error) {
      console.warn('[generation] auto-schedule skipped:', error.message)
    }
  }
}

/**
 * Builds the art-direction prompt sent to the image model. The goal is a
 * campaign-quality photograph that already looks like a social media advert:
 * brand colours from the logo, the right audience and mood, a hero subject on
 * the right third and clean space for the headline on the left.
 */
function imagePromptFor({ item, business, brand }) {
  const palette = (brand.palette || []).filter(Boolean).slice(0, 4).join(', ')
  const ratio = item.type === 'reel' ? 'vertical 9:16 composition' : 'square 1:1 composition'
  const audience = asText(business.audience, 90) || 'local Indian customers'
  const tone = asText(business.tone, 60) || 'friendly and professional'
  const goal = asText(business.goal, 90) || 'more enquiries and bookings'
  const product = asText(business.product, 80) || business.category || 'its services'
  const avoid = asText(business.avoid, 80)
  const scene = asText(item.imagePrompt, 240)
  return [
    `Premium social media advertisement photograph for ${business.name || 'a local business'},`,
    `a ${business.category || 'small business'} in ${business.city || 'India'}.`,
    scene ? `${scene}.` : '',
    `The advert sells ${product} to ${audience} with a ${tone} brand voice; the marketing goal is ${goal}.`,
    'High-end commercial advertising photography, real people with natural expressions, editorial lighting,',
    'aspirational lifestyle styling, believable Indian setting, shallow depth of field, sharp focus, 4k detail.',
    palette
      ? `Use the brand colours ${palette} from the company logo as accent lighting, wardrobe, props and colour grading so the creative feels on-brand.`
      : '',
    'Composition: hero subject on the right third, uncluttered negative space on the left for a headline,',
    'balanced props, premium brand campaign quality, scroll-stopping social media visual.',
    avoid ? `Avoid: ${avoid}.` : '',
    `Strictly no text, no letters, no typography, no logos, no watermarks, no UI elements. ${ratio}.`,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1350)
}

async function updateItemMedia(userId, itemId, media, extra = {}) {
  const updates = { ...media, ...extra }
  const $set = {}
  Object.entries(updates).forEach(([key, value]) => {
    $set[`items.$.${key}`] = value
  })
  await SocialPlan.updateOne({ userId, 'items.id': itemId }, { $set }).catch((error) => {
    console.warn('[generation] item update failed:', error.message)
  })
}

/**
 * Loads shared assets once per batch: logo + logo-derived palette, and the AI
 * presenter portrait. Doing this outside the workers means the free image API
 * is called once, not once per reel.
 */
async function prepareAssets({ business, brand, videoEnabled, items, onPhase }) {
  let logo = null
  if (business.logoPath) {
    const absolute = resolveUploadPath(business.logoPath)
    if (absolute && fs.existsSync(absolute)) {
      try {
        logo = await loadLogo(absolute)
      } catch (error) {
        console.warn(`[generation] logo could not be read: ${error.message}`)
      }
    }
  }

  const logoPalette = (logo?.palette || []).filter(Boolean)
  // When a logo exists its colours should drive the creatives. Only borrow
  // category colours when the logo is (almost) monochrome.
  const palette = logoPalette.length
    ? [...new Set([...logoPalette, ...(logoPalette.length < 3 ? (brand && brand.palette) || [] : [])])].slice(0, 5)
    : [...new Set((brand && brand.palette) || [])].slice(0, 5)

  const finalBrand = {
    ...(brand || {}),
    palette,
    logoPalette,
    logoPath: business.logoPath || '',
  }

  let presenter = null
  if (videoEnabled && (items || []).some((item) => item.type === 'reel')) {
    try {
      presenter = await ensurePresenter()
    } catch (error) {
      console.warn(`[generation] presenter portrait unavailable: ${error.message}`)
    }
  }

  // Generate a couple of campaign-quality AI backdrops once per batch. The free
  // image API allows one image per ~45s, so the renderer reuses these across the
  // plan and falls back to public photos if the quota is unavailable.
  const backdrops = { square: [], portrait: [] }
  if (process.env.AI_BACKDROPS !== 'false' && Array.isArray(items) && items.length) {
    const posts = items.filter((item) => item.type !== 'reel')
    const reels = items.filter((item) => item.type === 'reel')
    const jobs = []
    if (posts.length) {
      const picks = posts.length > 4 ? [posts[1], posts[4]] : [posts[0]]
      picks.filter(Boolean).forEach((item, index) => {
        jobs.push({ kind: 'square', item, seed: 4100 + index, width: 1024, height: 1024 })
      })
    }
    if (reels.length) {
      jobs.push({ kind: 'portrait', item: reels[0], seed: 5200, width: 1024, height: 1536 })
    }

    for (let index = 0; index < jobs.length; index++) {
      const job = jobs[index]
      if (onPhase) {
        await onPhase(
          `Designing AI marketing visual ${index + 1}/${jobs.length}${logoPalette.length ? ' with your logo colours' : ''}`
        ).catch(() => {})
      }
      try {
        const result = await generateAiImage(imagePromptFor({ item: job.item, business, brand: finalBrand }), {
          width: job.width,
          height: job.height,
          seed: job.seed,
          timeoutMs: 90000,
          maxWaitMs: index === 0 ? 12000 : 55000,
        })
        if (result && result.buffer) {
          backdrops[job.kind].push(result.buffer)
        } else {
          // The free image quota is unavailable. Don't make the user wait
          // through the same rate-limit for every remaining backdrop.
          console.warn('[generation] AI backdrop quota unavailable, using public photos')
          break
        }
      } catch (error) {
        console.warn(`[generation] AI backdrop ${index + 1} unavailable: ${error.message}`)
        break
      }
    }
  }

  // Pre-fetch one real photo for the whole batch. Every banner can then use a
  // photo even if its own lookup times out, so a creative never degrades into
  // plain text on a flat colour.
  let photoFallback = null
  if (process.env.STOCK_PHOTOS !== 'false') {
    try {
      const sample = await fetchStockPhoto({
        query: searchQueryFor({ item: { no: 1 }, business }),
        seed: 17,
        width: 1600,
        height: 1600,
      })
      photoFallback = (sample && sample.buffer) || null
    } catch (error) {
      console.warn('[generation] batch photo unavailable:', error.message)
    }
  }

  return { logo, brand: finalBrand, presenter, backdrops, photoFallback }
}

async function processItem({ userId, item, business, brand, videoEnabled, assets = {} }) {
  const brandForItem = assets.brand || brand
  try {
    // 0) Reuse the campaign backdrop designed once per batch. This keeps the
    //    whole plan visually consistent and avoids hammering the free image API.
    const backdropPool =
      item.type === 'reel' ? assets.backdrops && assets.backdrops.portrait : assets.backdrops && assets.backdrops.square
    const backdrop = backdropPool && backdropPool.length
      ? backdropPool[Math.max(0, Number(item.no || 1) - 1) % backdropPool.length]
      : null

    // 1) Try a real AI photo. If the batch already has a backdrop we skip this
    //    so every creative in the plan draws from the same art direction.
    let aiImage = backdrop || null
    if (!aiImage && process.env.GEMINI_IMAGE_ENABLED !== 'false' && !imageBlocked()) {
      try {
        const generated = await generateImage(imagePromptFor({ item, business, brand: brandForItem }), {
          aspectRatio: item.type === 'reel' ? '9:16' : '1:1',
          timeoutMs: 75000,
        })
        aiImage = generated.buffer
      } catch (error) {
        console.warn(`[generation] AI image fallback for ${item.id}: ${error.message}`)
      }
    }

    // 2) Keyword public photo. This gives the banner a real photographic
    //    background instead of a flat brand colour. If this item's lookup
    //    fails (dead host / timeout) reuse a photo from the same batch so no
    //    creative silently turns into text on a flat colour.
    let photo = null
    if (!aiImage) {
      try {
        photo = await fetchStockPhoto({
          query: searchQueryFor({
            item,
            business,
            index: Math.max(0, Number(item.no || 1) - 1),
          }),
          seed: Number(item.no || 1) * 31 + String(item.id || '').length,
          width: 1600,
          height: 1600,
        })
      } catch (error) {
        console.warn(`[generation] stock photo fallback for ${item.id}: ${error.message}`)
      }
      if (photo && photo.buffer) {
        if (!assets.photoFallback) assets.photoFallback = photo.buffer
      } else if (assets.photoFallback) {
        photo = { buffer: assets.photoFallback, source: 'batch' }
      }
    }

    // 3) Render a banner: photo + brand overlay + logo + headline + CTA.
    const creative = await renderCreative({
      item,
      biz: {
        name: business.name,
        cat: business.category,
        city: business.city,
        site: business.website,
        handle: item.handle,
      },
      brand: brandForItem,
      index: Math.max(0, Number(item.no || 1) - 1),
      aiImage,
      photo,
      logo: assets.logo || null,
    })
    const savedImage = await saveBuffer({
      userId,
      name: `${item.id}-img`,
      buffer: creative.buffer,
      ext: creative.ext,
    })

    const media = {
      imageUrl: savedImage.url,
      imagePath: savedImage.relative,
      mediaType: item.type === 'reel' && videoEnabled ? 'video' : 'image',
      mediaStatus: item.type === 'reel' && videoEnabled ? 'image' : 'ready',
      mediaError: '',
    }

    // 4) Reels become a presenter MP4 with voiceover and synced captions.
    if (item.type === 'reel' && videoEnabled) {
      const tempName = `reel-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.mp4`
      const tempPath = path.join(path.dirname(savedImage.absolute), tempName)
      try {
        let rendered
        const presenter = assets.presenter && assets.presenter.buffer
        if (presenter) {
          try {
            rendered = await renderPresenterReel({
              presenter,
              logo: assets.logo || null,
              backdrop: backdrop || aiImage || (photo && photo.buffer) || null,
              biz: {
                name: business.name,
                cat: business.category,
                city: business.city,
                site: business.website,
                handle: item.handle,
              },
              brand: brandForItem,
              item,
              outPath: tempPath,
            })
          } catch (error) {
            console.warn(`[generation] presenter video failed for ${item.id}: ${error.message}`)
          }
        }
        if (!rendered) {
          // Never lose the reel: fall back to a silent poster video.
          await renderReelVideo({ imagePath: savedImage.absolute, outPath: tempPath })
        }

        const buffer = await fs.promises.readFile(tempPath)
        const savedVideo = await saveBuffer({
          userId,
          name: `${item.id}-video`,
          buffer,
          ext: '.mp4',
        })
        media.videoUrl = savedVideo.url
        media.videoPath = savedVideo.relative
        media.mediaStatus = 'ready'
        if (!rendered) {
          media.mediaError = 'AI presenter voice was unavailable, so a silent video was rendered.'
        }
      } catch (error) {
        media.mediaStatus = 'ready'
        media.mediaType = 'image'
        media.mediaError = `Video render failed, so the image poster is ready instead: ${error.message}`
        console.warn(`[generation] video failed for ${item.id}: ${error.message}`)
      } finally {
        fs.promises.unlink(tempPath).catch(() => {})
      }
    }

    await updateItemMedia(userId, item.id, media)
  } catch (error) {
    console.error(`[generation] creative failed for ${item.id}:`, error.message)
    await updateItemMedia(userId, item.id, {
      mediaStatus: 'failed',
      mediaError: error.message || 'Creative rendering failed',
    })
  } finally {
    await SocialPlan.updateOne({ userId }, { $inc: { 'generation.completed': 1 } }).catch(() => {})
  }
}

async function recoverMedia(userId) {
  const record = await SocialPlan.findOne({ userId })
  if (!record) throw new Error('No social plan found')
  const business = await Business.findOne({ userId })
  if (!business) throw new Error('Business profile is missing')

  const items = record.items.filter(
    (item) => !item.imagePath || item.mediaStatus === 'failed' || (record.video && item.type === 'reel' && !item.videoPath)
  )
  if (!items.length) return 0

  const baseBrand = record.brand && record.brand.palette && record.brand.palette.length
    ? record.brand.toObject
      ? record.brand.toObject()
      : record.brand
    : { palette: categoryPalette(business.category) }
  const videoEnabled = record.video !== false
  const assets = await prepareAssets({
    business,
    brand: baseBrand,
    videoEnabled,
    items: record.items,
  })

  record.brand = assets.brand
  record.generation = {
    ...(record.generation || {}),
    status: 'images',
    phase: 'Rendering missing creatives',
    total: record.items.length,
    completed: record.items.length - items.length,
    failed: 0,
    message: '',
    startedAt: new Date(),
    finishedAt: null,
  }
  await record.save()

  let cursor = 0
  const workers = Array.from({ length: Math.min(videoEnabled ? 2 : 3, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await processItem({
        userId,
        item: items[index],
        business,
        brand: assets.brand,
        videoEnabled,
        assets,
      })
    }
  })
  await Promise.all(workers)
  await refreshFailureCount(userId)
  await finishGeneration(userId)
  return items.length
}

async function refreshFailureCount(userId) {
  const record = await SocialPlan.findOne({ userId }).select('items').lean()
  if (!record) return
  const failed = (record.items || []).filter((item) => item.mediaStatus === 'failed').length
  await SocialPlan.updateOne({ userId }, { $set: { 'generation.failed': failed } }).catch(() => {})
}

async function runGeneration(userId, { planId, billing, video }) {
  const business = await Business.findOne({ userId })
  if (!business) {
    await patchGeneration(userId, {
      status: 'failed',
      phase: 'Failed',
      message: 'Business profile is missing. Complete Business Onboard first.',
      finishedAt: new Date(),
    })
    return
  }

  const plan = SM_PLANS.find((entry) => entry.id === planId) || SM_PLANS[1]
  const videoEnabled = video !== false
  const total = plan.posts + plan.reels

  await SocialPlan.updateOne(
    { userId },
    {
      $set: {
        'generation.status': 'text',
        'generation.phase': 'Reading your website and writing 30 days of content',
        'generation.total': total,
        'generation.completed': 0,
        'generation.failed': 0,
        'generation.message': '',
        'generation.startedAt': new Date(),
        'generation.finishedAt': null,
      },
    }
  ).catch(() => {})

  let planData
  try {
    planData = await buildContentPlan({
      biz: {
        name: business.name,
        cat: business.category,
        city: business.city,
        owner: business.owner,
        about: business.about,
        product: business.product,
        aud: business.audience,
        tone: business.tone,
        goal: business.goal,
        avoid: business.avoid,
        time: business.postingTime,
        site: business.website,
        accounts: await planTargets(userId, business),
      },
      plan,
      video: videoEnabled,
    })
  } catch (error) {
    await patchGeneration(userId, {
      status: 'failed',
      phase: 'Failed',
      message: `Content generation failed: ${error.message}`,
      finishedAt: new Date(),
    })
    return
  }

  const record = await SocialPlan.findOne({ userId })
  if (!record) return

  const assets = await prepareAssets({
    business,
    brand: planData.brand,
    videoEnabled,
    items: planData.items,
    onPhase: async (phase) => {
      await SocialPlan.updateOne({ userId }, { $set: { 'generation.phase': phase } }).catch(() => {})
    },
  })

  record.brand = assets.brand
  record.items = planData.items
  record.generation = {
    status: 'images',
    phase: 'Designing brand banners',
    total: planData.items.length,
    completed: 0,
    failed: 0,
    message: planData.warning || '',
    startedAt: record.generation?.startedAt || new Date(),
    finishedAt: null,
  }
  await record.save()

  let cursor = 0
  const concurrency = videoEnabled ? 2 : 3
  const workers = Array.from({ length: Math.min(concurrency, record.items.length) }, async () => {
    while (cursor < record.items.length) {
      const index = cursor
      cursor += 1
      await processItem({
        userId,
        item: record.items[index].toObject ? record.items[index].toObject() : record.items[index],
        business,
        brand: assets.brand,
        videoEnabled,
        assets,
      })
      // Keep the human-readable phase honest while the batch runs.
      const done = await SocialPlan.findOne({ userId }).select('generation.completed generation.total').lean()
      if (done) {
        const completed = Number(done.generation?.completed || 0)
        const all = Number(done.generation?.total || total)
        const phase = completed >= all ? 'Rendering AI presenter videos' : 'Designing brand banners'
        await SocialPlan.updateOne({ userId }, { $set: { 'generation.phase': phase } }).catch(() => {})
      }
    }
  })

  await Promise.all(workers)
  await refreshFailureCount(userId)
  await finishGeneration(userId)
  console.log(`[generation] finished for ${userId}`)
}

/**
 * Create/refresh the plan and start the background factory. Returns immediately
 * with generation.status = "text" so the dashboard can show live progress.
 */
async function startGeneration(userId, { planId, billing, video, amountPaid, autoRenew }) {
  if (active.has(String(userId))) return { started: false, reason: 'already-running' }

  const plan = SM_PLANS.find((entry) => entry.id === planId) || SM_PLANS[1]
  const record = await SocialPlan.findOneAndUpdate(
    { userId },
    {
      $set: {
        planId: plan.id,
        planName: plan.name,
        price: plan.price,
        paid: true,
        video: video !== false,
        billing: billing === 'yearly' ? 'yearly' : 'monthly',
        amountPaid: Number(amountPaid || 0),
        autoRenew: Boolean(autoRenew),
        items: [],
        brand: {},
        status: 'active',
        generation: {
          status: 'text',
          phase: 'Starting your AI content engine',
          total: plan.posts + plan.reels,
          completed: 0,
          failed: 0,
          message: '',
          startedAt: new Date(),
          finishedAt: null,
        },
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )

  // Any queued posts from the previous batch must not publish alongside the new one.
  await SocialPost.updateMany(
    { userId, status: { $in: ['scheduled', 'draft', 'failed'] } },
    {
      $set: {
        status: 'cancelled',
        lockedAt: null,
        error: 'Cancelled because a new content batch was generated',
      },
    }
  ).catch(() => {})

  const run = runGeneration(String(userId), { planId: plan.id, billing, video })
    .catch(async (error) => {
      console.error('[generation] fatal:', error)
      await patchGeneration(userId, {
        status: 'failed',
        phase: 'Failed',
        message: error.message || 'Generation failed',
        finishedAt: new Date(),
      })
    })
    .finally(() => {
      active.delete(String(userId))
    })

  active.set(String(userId), run)
  return { started: true, record }
}

const isRunning = (userId) => active.has(String(userId))

/** Called on server boot so a crash never leaves a plan stuck on "writing". */
async function recoverStuckGenerations() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000)
  const result = await SocialPlan.updateMany(
    {
      'generation.status': { $in: ['text', 'images', 'videos'] },
      'generation.startedAt': { $lt: cutoff },
    },
    {
      $set: {
        'generation.status': 'partial',
        'generation.phase': 'Interrupted',
        'generation.message': 'Generation was interrupted when the server restarted. Use Retry missing creatives.',
        'generation.finishedAt': new Date(),
      },
    }
  ).catch(() => ({ modifiedCount: 0 }))
  if (result.modifiedCount) {
    console.warn(`[generation] marked ${result.modifiedCount} interrupted plan(s) as partial`)
  }
}

module.exports = {
  startGeneration,
  recoverMedia,
  recoverStuckGenerations,
  isRunning,
}
