/**
 * Turns generated creatives into real auto-publish queue entries.
 * Only platforms with a connected account are scheduled; nothing is queued if
 * no account exists.
 */

const SocialPlan = require('../../models/SocialPlan')
const SocialPost = require('../../models/SocialPost')
const SocialAccount = require('../../models/SocialAccount')

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'youtube', 'google-business']

const mediaFor = (item, platform) => {
  const hasVideo = Boolean(item.videoPath)
  const hasImage = Boolean(item.imagePath)

  if (platform === 'youtube') {
    return hasVideo
      ? { mediaType: 'video', path: item.videoPath, url: item.publicVideoUrl || '', mimeType: 'video/mp4', kind: 'video' }
      : null
  }
  if (platform === 'google-business') {
    return hasImage
      ? { mediaType: 'image', path: item.imagePath, url: item.publicImageUrl || '', mimeType: 'image/png', kind: 'post' }
      : null
  }
  if (item.type === 'reel' && hasVideo) {
    return { mediaType: 'video', path: item.videoPath, url: item.publicVideoUrl || '', mimeType: 'video/mp4', kind: 'reel' }
  }
  return hasImage
    ? { mediaType: 'image', path: item.imagePath, url: item.publicImageUrl || '', mimeType: 'image/png', kind: 'post' }
    : null
}

async function scheduleGeneratedContent(userId, { limit = 200 } = {}) {
  const [record, accounts] = await Promise.all([
    SocialPlan.findOne({ userId }),
    SocialAccount.find({ userId, connected: true }).select('platform platformUserId username').lean(),
  ])
  if (!record || !record.items.length || !accounts.length) return 0

  const connected = new Set(accounts.map((account) => account.platform))

  const existing = await SocialPost.find({
    userId,
    creativeId: { $in: record.items.map((item) => item.id) },
    status: { $in: ['scheduled', 'publishing', 'posted'] },
  })
    .select('creativeId platform')
    .lean()
  const taken = new Set(existing.map((post) => `${post.creativeId}:${post.platform}`))

  let created = 0
  for (const item of record.items.slice(0, limit)) {
    const candidates = [...new Set([item.platform, ...(item.platforms || [])])].filter(
      (id) => PLATFORMS.includes(id) && connected.has(id)
    )
    if (!candidates.length) continue

    let queuedHere = 0
    for (const platform of candidates) {
      if (taken.has(`${item.id}:${platform}`)) continue

      const platformMedia = mediaFor(item, platform)
      if (!platformMedia) continue

      let when = item.date ? new Date(item.date) : new Date(Date.now() + 60 * 60 * 1000)
      if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + 5 * 60 * 1000) {
        when = new Date(Date.now() + (10 + created * 4) * 60 * 1000)
      }

      const account = accounts.find((entry) => entry.platform === platform)

      try {
        await SocialPost.create({
          userId,
          accountId: account?._id || null,
          platform,
          kind: platformMedia.kind,
          title: String(item.title || '').slice(0, 100),
          caption: String(item.caption || ''),
          hashtags: String(item.hashtags || ''),
          mediaUrl: platformMedia.url || '',
          mediaPath: platformMedia.path || '',
          mediaType: platformMedia.mediaType,
          mimeType: platformMedia.mimeType,
          scheduledAt: when,
          status: 'scheduled',
          creativeId: item.id,
        })
        taken.add(`${item.id}:${platform}`)
        created += 1
        queuedHere += 1
      } catch (error) {
        console.warn(`[schedule] could not queue ${item.id} on ${platform}:`, error.message)
      }
    }

    if (queuedHere > 0) {
      item.status = 'Scheduled'
      item.note = `Auto-scheduled for ${candidates.length} connected platform${candidates.length === 1 ? '' : 's'}`
    }
  }

  if (created > 0) await record.save().catch(() => {})
  return created
}

/**
 * Called right after a platform is connected. If the user already generated
 * content and auto-publish is ON, immediately queue creatives for the new
 * account(s) instead of waiting for a manual "Schedule all" click.
 */
async function autoScheduleIfEnabled(userId) {
  try {
    const record = await SocialPlan.findOne({ userId }).select('autoPublish items').lean()
    if (!record || record.autoPublish === false) return 0
    if (!record.items || !record.items.length) return 0
    return await scheduleGeneratedContent(userId)
  } catch (error) {
    console.warn('[schedule] auto-schedule after connection failed:', error.message)
    return 0
  }
}

module.exports = { scheduleGeneratedContent, autoScheduleIfEnabled }
