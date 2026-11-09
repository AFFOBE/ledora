/**
 * Builds a real 30-day content calendar from the customer's business profile
 * and website. Gemini writes the strategy; a deterministic template engine is
 * used when Gemini is unavailable so a purchase never ends with empty content.
 */

const crypto = require('crypto')
const { generateJson } = require('./gemini')
const { fetchWebsiteProfile } = require('./website')
const {
  SM_PLANS,
  SM_CATS,
  SM_AUDS,
  SM_TONES,
  SM_GOALS,
  SM_HOOKS,
  SM_POST,
  SM_CTA,
  SM_REEL_IDEA,
  SM_REEL_CTA,
  SM_REEL_SCRIPT,
  SM_TIMES,
  SM_GRADS,
} = require('../../data/socialContent')

const SUPPORTED = ['instagram', 'facebook', 'linkedin', 'youtube', 'google-business']
const PLATFORM_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  'google-business': 'Google Business',
}

const PALETTES = {
  'Digital Marketing': ['#160B33', '#6D33E7', '#B9A1FF'],
  'Web Design & Development': ['#0B1020', '#384FE7', '#8FB4FF'],
  'Real Estate': ['#0F172A', '#C9A227', '#F8FAFC'],
  'Interior Design': ['#1C1917', '#D6B98C', '#FAF7F2'],
  'Fitness & Gym': ['#090C08', '#B6FF3B', '#F4FFE3'],
  'Education & Coaching': ['#1E1B4B', '#F59E0B', '#FEF3C7'],
  'Restaurant & Cafe': ['#2A0E0E', '#F4A261', '#FFF4E6'],
  'Clinic & Healthcare': ['#043B3B', '#5EEAD4', '#ECFDF5'],
  'Clothing & Apparel': ['#171717', '#F472B6', '#FDF2F8'],
  'Automobile Service': ['#0B1220', '#EF4444', '#FEF2F2'],
  'Beauty & Salon': ['#2B0A1E', '#F7C8D8', '#FFF1F5'],
  'Construction & Interior': ['#1C1917', '#F59E0B', '#FFFBEB'],
  'Travel & Tourism': ['#082F49', '#38BDF8', '#F0F9FF'],
  'IT & Software': ['#0B1020', '#22D3EE', '#ECFEFF'],
  'Finance & Accounting': ['#052E2B', '#34D399', '#ECFDF5'],
  Manufacturing: ['#0F172A', '#94A3B8', '#F1F5F9'],
}

const DEFAULT_PALETTE = ['#1B1035', '#6D33E7', '#D8CCFF']

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const asText = (value, max = 0) => {
  const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  return max > 0 ? text.slice(0, max) : text
}

const slugHandle = (name) =>
  '@' + String(name || 'yourbusiness').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24)

const normalizeHex = (value) => {
  const raw = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return (
      '#' +
      raw
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    ).toLowerCase()
  }
  return ''
}

const categoryPalette = (category) => {
  const key = Object.keys(PALETTES).find(
    (name) => name.toLowerCase() === String(category || '').toLowerCase()
  )
  return key ? PALETTES[key] : DEFAULT_PALETTE
}

const pickTime = (preferred, index) => {
  const raw = asText(preferred, 12)
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(raw)) return raw.toUpperCase()
  return SM_TIMES[index % SM_TIMES.length]
}

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000)

const dateAtTime = (baseDate, dayOffset, time) => {
  const day = new Date(baseDate)
  day.setDate(day.getDate() + dayOffset)
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i)
  let hours = 10
  let minutes = 0
  if (match) {
    hours = Number(match[1]) % 12
    minutes = Number(match[2])
    if (match[3].toUpperCase() === 'PM') hours += 12
  }
  day.setHours(hours, minutes, 0, 0)
  return day
}

const formatDstr = (date) =>
  date
    .toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .replace(',', ' ·')
    .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase())

const dayName = (date) =>
  date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' })

/** Slot list: posts and reels spread evenly across the 30-day window. */
function buildSlots(plan) {
  const total = Math.max(Number(plan.posts || 0) + Number(plan.reels || 0), 1)
  const reels = clamp(Number(plan.reels || 0), 0, total)
  const types = Array(total).fill('post')
  if (reels > 0) {
    for (let i = 1; i <= reels; i += 1) {
      const position = clamp(Math.round((i * total) / (reels + 1)) - 1, 0, total - 1)
      types[position] = 'reel'
    }
  }

  return types.map((type, index) => {
    const day = 1 + Math.round((index * 29) / Math.max(total - 1, 1))
    return { no: index + 1, type, day }
  })
}

function buildPrompt({ biz, plan, slots, website }) {
  const websiteBlock = website
    ? [
        `Website: ${website.url}`,
        website.title ? `Website title: ${website.title}` : '',
        website.description ? `Website description: ${website.description}` : '',
        website.text ? `Website content (only use facts here, do not invent):\n${website.text}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'Website: not provided'

  const slotLines = slots
    .map((slot) => `${slot.no}. day ${slot.day} — ${slot.type === 'reel' ? 'REEL (short vertical video)' : 'POST (image post)'}`)
    .join('\n')

  return `You are a senior social media strategist for Indian small businesses. Create a ready-to-publish 30-day content calendar.

BUSINESS
Name: ${asText(biz.name, 120)}
Category: ${asText(biz.cat, 80) || 'General business'}
City: ${asText(biz.city, 60) || 'India'}
Owner/contact: ${asText(biz.owner, 60) || 'not provided'}
About: ${asText(biz.about, 500) || 'not provided'}
Main product/service: ${asText(biz.product, 160) || 'not provided'}
Audience: ${asText(biz.aud, 120) || 'local customers'}
Brand tone: ${asText(biz.tone, 80) || 'friendly and professional'}
Goal: ${asText(biz.goal, 120) || 'generate leads'}
Words/style to avoid: ${asText(biz.avoid, 160) || 'none'}
Preferred posting time: ${asText(biz.time, 20) || 'not provided'}

${websiteBlock}

SLOTS (return exactly ${slots.length} items, in this order, no more, no fewer)
${slotLines}

RULES
1. Every caption must be specific to this business and category. Never write generic filler.
2. Only use facts from the business profile and website. Never invent awards, client counts, prices, guarantees or locations.
3. Captions: 60-130 words, first line is a strong hook, maximum 2 emojis, end with a clear call to action. Plain text only, no markdown.
4. Hashtags: 8-12 hashtags in one string, include the brand name, city and category. No spaces inside a hashtag.
5. Reels must include a practical 20-30 second script with beats HOOK, PROBLEM, SOLUTION, PROOF, CTA and a short SHOT LIST. Keep it filmable by a small business.
6. imagePrompt: a detailed text-free visual brief for an AI image generator. Mention subject, setting, lighting, brand colours, composition, photorealistic, no text, no logos, square 1:1.
7. videoPrompt: one short sentence describing the camera motion for an image-to-video model (5-8 seconds, subtle, no text morphing).
8. bestTime: one time in "HH:MM AM/PM" format, suitable for Indian audiences.
9. Do not repeat the same hook or CTA twice in a row.
10. Brand palette: exactly 3 hex colours that suit the category and brand.
11. voiceover (reels only): a natural 45-70 word spoken script for a friendly female AI presenter. First person, speaks directly to the viewer, mentions the business name and one real benefit from the profile/website, ends with the CTA. No emojis, hashtags, stage directions or markdown. Empty string for posts.

Return ONLY this JSON shape:
{
  "brand": {
    "tagline": "max 8 words",
    "summary": "one sentence positioning",
    "palette": ["#111111", "#6D33E7", "#F5F3FF"]
  },
  "items": [
    {
      "no": 1,
      "title": "max 60 characters",
      "caption": "60-130 word caption",
      "hashtags": "#Brand #City #Category ...",
      "cta": "one short call to action",
      "script": "only for reels, otherwise empty string",
      "voiceover": "only for reels: 45-70 word natural spoken script, otherwise empty string",
      "imagePrompt": "text-free visual brief",
      "videoPrompt": "camera motion brief",
      "bestTime": "06:30 PM"
    }
  ]
}`
}

/** Deterministic fallback calendar built from the existing template bank. */
function fallbackItems({ biz, slots }) {
  const cat = asText(biz.cat, 80).toLowerCase() || 'business'
  const name = asText(biz.name, 120) || 'Your Business'
  const aud = asText(biz.aud, 120).toLowerCase() || 'local customers'
  const tags = [
    `#${name.replace(/[^a-z0-9]/gi, '')}`,
    `#${cat.split(' ')[0].replace(/[^a-z0-9]/gi, '')}`,
    '#SmallBusiness',
    '#India',
    '#Growth',
    '#Marketing',
    '#LocalBusiness',
    '#SocialMedia',
  ].join(' ')

  return slots.map((slot, index) => {
    const hook = SM_HOOKS[index % SM_HOOKS.length].replace('{cat}', cat).replace('{biz}', name)
    const cta = SM_CTA[(index * 3 + 1) % SM_CTA.length].replace('{cat}', cat)
    const reelCta = SM_REEL_CTA[(index * 5 + 2) % SM_REEL_CTA.length].replace('{cat}', cat)
    const post = SM_POST[index % SM_POST.length]
      .replace(/\{hook\}/g, hook)
      .replace(/\{cat\}/g, cat)
      .replace(/\{biz\}/g, name)
      .replace(/\{aud\}/g, aud)
      .replace(/\{cta\}/g, cta)
      .replace(/\{n\}/g, String(40 + index * 11))
    const title = slot.type === 'reel'
      ? SM_REEL_IDEA[index % SM_REEL_IDEA.length].replace(/\{cat\}/g, cat).replace(/\{biz\}/g, name)
      : post.split(/[.!?]/)[0]

    return {
      title: asText(title, 60),
      caption: slot.type === 'reel' ? `${post}\n\n${reelCta}` : post,
      hashtags: tags,
      cta: slot.type === 'reel' ? reelCta : cta,
      script: slot.type === 'reel'
        ? SM_REEL_SCRIPT.replace('{hook}', hook).replace('{cta}', reelCta).replace(/\{cat\}/g, cat)
        : '',
      voiceover: slot.type === 'reel'
        ? `Hello and welcome! I am your AI brand presenter for ${name}. ${title}. ${post
            .split(/(?<=[.!?])\s+/)
            .slice(0, 2)
            .join(' ')} ${reelCta} Thank you for watching. Follow ${name} for more.`
            .replace(/\s+/g, ' ')
            .slice(0, 700)
        : '',
      imagePrompt: `Professional ${cat} brand photo for ${name}, Indian setting, natural light, premium and clean composition, brand colours, no text, no logos, square`,
      videoPrompt: `Slow cinematic push-in on the ${cat} scene, natural motion, no text`,
      bestTime: pickTime(biz.time, index),
    }
  })
}

const hasBadClaim = (text) =>
  /\b(\d{2,}%|\d{3,}\+?\s*(customers|clients|projects)|guaranteed|100% (free|guaranteed)|no\.?\s?1|number one)\b/i.test(
    String(text || '')
  )

function sanitizeItems(rawItems, slots) {
  const list = Array.isArray(rawItems) ? rawItems : []
  const byNo = new Map()
  list.forEach((entry, index) => {
    const no = Number(entry && entry.no)
    byNo.set(Number.isFinite(no) ? no : index + 1, entry)
  })

  return slots.map((slot, index) => {
    const entry = byNo.get(slot.no) || list[index] || {}
    const caption = asText(entry.caption, 2200)
    return {
      title: asText(entry.title, 60) || `Content idea ${slot.no}`,
      caption: hasBadClaim(caption) ? caption.replace(/\b(guaranteed|100% free|no\.?\s?1)\b/gi, '') : caption,
      hashtags: asText(entry.hashtags, 400),
      cta: asText(entry.cta, 160),
      script: slot.type === 'reel' ? asText(entry.script, 2000) : '',
      voiceover: slot.type === 'reel' ? asText(entry.voiceover, 900) : '',
      imagePrompt: asText(entry.imagePrompt, 1000),
      videoPrompt: asText(entry.videoPrompt, 400),
      bestTime: pickTime(entry.bestTime || '', index),
    }
  })
}

const platformList = (biz) => {
  const chosen = (biz.accounts || [])
    .map((account) => String(account.platformId || '').trim())
    .filter((id) => SUPPORTED.includes(id))
  const unique = [...new Set(chosen)]
  return unique.length ? unique : ['instagram', 'facebook']
}

const platformLabelFor = (platforms) => platforms.map((id) => PLATFORM_LABELS[id] || id).join(' + ')

/**
 * Main entry. Returns a complete `{ brand, items, source, warning }` payload
 * with dates, platforms and media placeholders already filled in.
 */
async function buildContentPlan({ biz, plan, video = true }) {
  const slots = buildSlots(plan)
  const website = await fetchWebsiteProfile(biz.site)
  const platforms = platformList(biz)
  const handle = (biz.accounts || []).find((a) => a.handle)?.handle || slugHandle(biz.name)
  const palette = categoryPalette(biz.cat)

  let ai = null
  let warning = ''
  if (process.env.GEMINI_API_KEY) {
    try {
      const result = await generateJson(
        buildPrompt({ biz, plan, slots, website }),
        { temperature: 0.85, maxOutputTokens: 8192, timeoutMs: 75000 }
      )
      const items = result && result.data && result.data.items
      if (Array.isArray(items) && items.length >= Math.ceil(slots.length * 0.6)) {
        ai = result.data
      } else {
        warning = 'AI returned an incomplete calendar, so the local content engine filled the gaps.'
      }
    } catch (error) {
      warning = `AI content is temporarily unavailable (${error.message}). Local content engine used.`
      console.warn('[content-plan]', warning)
    }
  } else {
    warning = 'GEMINI_API_KEY is missing, so the local content engine was used.'
  }

  let itemData = ai ? sanitizeItems(ai.items, slots) : fallbackItems({ biz, slots })
  if (ai) {
    const fallback = fallbackItems({ biz, slots })
    itemData = itemData.map((item, index) => ({
      ...fallback[index],
      ...Object.fromEntries(Object.entries(item).filter(([, value]) => value)),
    }))
  }

  const baseDate = new Date()
  baseDate.setHours(0, 0, 0, 0)
  baseDate.setDate(baseDate.getDate() + 1)
  // Unique per batch so a new 30-day batch never reuses old publishing-queue ids.
  const batchId = crypto.randomBytes(3).toString('hex')

  const items = slots.map((slot, index) => {
    const data = itemData[index]
    const time = data.bestTime || pickTime(biz.time, index)
    const when = dateAtTime(baseDate, slot.day - 1, time)
    const finalWhen = when.getTime() < Date.now() + 10 * 60000 ? addMinutes(new Date(), 15 + index * 3) : when
    const title = asText(data.title, 60) || `Idea ${slot.no}`
    const isReel = slot.type === 'reel'
    const useVideo = isReel && video !== false
    return {
      id: `sm${batchId}${index}`,
      day: slot.day,
      no: slot.no,
      title,
      dstr: formatDstr(finalWhen),
      dow: dayName(finalWhen),
      date: finalWhen.toISOString(),
      type: isReel ? 'reel' : 'post',
      caption: data.caption,
      hashtags: data.hashtags,
      media: isReel
        ? 'Vertical 9:16 AI presenter video · voiceover · brand colours'
        : 'AI designed 1080x1080 banner · brand colours · logo',
      script: data.script || (isReel ? SM_REEL_SCRIPT : 'Image / carousel graphic as per brand kit'),
      voiceover: data.voiceover || '',
      cta: data.cta,
      platform: platforms[0],
      platforms,
      handle,
      platformLabel: platformLabelFor(platforms),
      status: 'Draft',
      note: '',
      grad: SM_GRADS[index % SM_GRADS.length],
      bestTime: time,
      imagePrompt: data.imagePrompt,
      videoPrompt: data.videoPrompt,
      mediaType: useVideo ? 'video' : 'image',
      mediaStatus: 'pending',
      imageUrl: '',
      imagePath: '',
      videoUrl: '',
      videoPath: '',
      publicImageUrl: '',
      publicVideoUrl: '',
      mediaError: '',
    }
  })

  const aiPalette = (ai && ai.brand && Array.isArray(ai.brand.palette) ? ai.brand.palette : [])
    .map(normalizeHex)
    .filter(Boolean)
  const brand = {
    tagline: asText((ai && ai.brand && ai.brand.tagline) || '', 80) || `${asText(biz.name, 40)} · ${asText(biz.cat, 40) || 'Business'}`,
    summary:
      asText((ai && ai.brand && ai.brand.summary) || '', 300) ||
      `Content plan for ${asText(biz.name, 80)} built from the business profile${
        website.title ? ` and ${website.title}` : ''
      }.`,
    palette: [...new Set([...aiPalette, ...palette])].slice(0, 4),
    website: website.url || '',
  }

  return {
    brand,
    items,
    source: ai ? 'gemini' : 'fallback',
    warning,
    website: {
      url: website.url || '',
      title: website.title || '',
      description: website.description || '',
      readable: Boolean(website.text),
    },
  }
}

module.exports = {
  buildContentPlan,
  buildSlots,
  categoryPalette,
  dateAtTime,
  formatDstr,
  PLATFORM_LABELS,
}
