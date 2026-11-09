/**
 * Keyword photo source for banner creatives.
 *
 * Pollinations is rate limited to one image per IP every 45 seconds, so it is
 * only used for the one-time AI presenter portrait. Everything else uses the
 * Openverse API (public Creative Commons photos) with Picsum as a last resort.
 * Results are cached on disk, so regenerating a plan does not re-download the
 * same photos.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const sharp = require('sharp')
const { UPLOAD_DIR } = require('../../middlewares/upload.middleware')

const CACHE_DIR = path.join(UPLOAD_DIR, 'cache', 'stock')
fs.mkdirSync(CACHE_DIR, { recursive: true })

const CATEGORY_KEYWORDS = {
  'Digital Marketing': 'digital marketing team laptop office',
  'Web Design & Development': 'web designer laptop code office',
  'Real Estate': 'modern house home exterior',
  'Interior Design': 'modern living room interior design',
  'Fitness & Gym': 'gym fitness workout',
  'Education & Coaching': 'classroom students learning',
  'Restaurant & Cafe': 'coffee cafe restaurant food',
  'Clinic & Healthcare': 'modern clinic doctor healthcare',
  'Clothing & Apparel': 'fashion clothing store',
  'Automobile Service': 'car service garage mechanic',
  'Beauty & Salon': 'beauty salon makeup hair',
  'Construction & Interior': 'construction site building worker',
  'Travel & Tourism': 'travel india destination',
  'IT & Software': 'software developer computer office',
  'Finance & Accounting': 'business finance meeting',
  Manufacturing: 'factory manufacturing machines',
}

/**
 * Detects the real subject from the business profile (name, product, about) so
 * a dental clinic gets dental photos rather than a random railway picture. The
 * first matching pattern wins; category keywords are the fallback.
 */
const SUBJECT_PATTERNS = [
  { words: ['dental', 'dentist', 'tooth', 'teeth', 'whitening', 'aligner', 'orthodont'], query: 'dental clinic dentist' },
  { words: ['salon', 'hair', 'beauty', 'makeup', 'spa', 'facial', 'skin'], query: 'beauty salon hair stylist' },
  { words: ['gym', 'fitness', 'yoga', 'workout', 'trainer', 'zumba'], query: 'gym fitness workout' },
  { words: ['coffee', 'cafe', 'restaurant', 'food', 'bakery', 'pizza', 'catering'], query: 'coffee cafe restaurant food' },
  { words: ['real estate', 'property', 'apartment', 'villa', 'flat', 'builder floor'], query: 'real estate modern house property' },
  { words: ['interior', 'architect', 'furniture', 'decor', 'modular kitchen'], query: 'modern interior design living room' },
  { words: ['fashion', 'clothing', 'boutique', 'apparel', 'saree', 'lehenga'], query: 'fashion clothing store boutique' },
  { words: ['car', 'automobile', 'garage', 'bike', 'vehicle', 'detailing'], query: 'car service garage mechanic' },
  { words: ['travel', 'tour', 'hotel', 'resort', 'trip', 'holiday'], query: 'travel india destination hotel' },
  { words: ['school', 'coaching', 'education', 'classes', 'tuition', 'academy'], query: 'classroom students learning teacher' },
  { words: ['software', 'website', 'web design', 'app development', 'digital marketing', 'seo'], query: 'software developer team laptop office' },
  { words: ['finance', 'accounting', 'tax', 'gst', 'loan', 'insurance'], query: 'business finance meeting documents' },
  { words: ['construction', 'contractor', 'civil', 'manufacturing', 'factory'], query: 'construction site factory workers' },
  { words: ['wedding', 'photography', 'photographer', 'event planner'], query: 'indian wedding photography event' },
  { words: ['jewelry', 'jewellery', 'gold', 'diamond', 'silver'], query: 'jewelry gold necklace close up' },
  { words: ['pet', 'veterinary', 'dog', 'cat'], query: 'pet dog veterinary clinic' },
  { words: ['clinic', 'doctor', 'healthcare', 'hospital', 'medical', 'patient'], query: 'modern clinic doctor healthcare' },
]

const profileText = (business = {}) =>
  [
    business.name,
    business.category,
    business.product,
    business.about,
    business.goal,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/** Returns a subject-specific photo query, or the category fallback. */
function queryFromProfile(business = {}) {
  const text = profileText(business)
  for (const pattern of SUBJECT_PATTERNS) {
    if (pattern.words.some((word) => text.includes(word))) return pattern.query
  }
  const category = String((business && business.category) || '').trim()
  return (
    CATEGORY_KEYWORDS[category] ||
    (category ? `${category} business` : 'small business india team')
  )
}

const hash = (value) => crypto.createHash('sha1').update(String(value)).digest('hex')

/** Builds a short, relevant Openverse search phrase for one creative. */
function searchQueryFor({ item, business }) {
  const base = queryFromProfile(business)
  // Vary the frame slightly without polluting the query with unrelated words.
  const variant = Number((item && item.no) || 0) % 3
  const tails = ['', ' professional', ' detail']
  return `${base}${tails[variant] || ''}`.trim()
}

async function downloadBuffer(url, { timeoutMs = 20000, maxBytes = 12 * 1024 * 1024 } = {}) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Ledora/1.0 (social creative generator)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const type = String(response.headers.get('content-type') || '')
  if (!type.startsWith('image/')) throw new Error(`Unexpected content type ${type}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length < 2000) throw new Error('Image download was empty')
  if (buffer.length > maxBytes) throw new Error('Image download was too large')
  return buffer
}

async function searchOpenverse(query, { perPage = 12 } = {}) {
  const params = new URLSearchParams({
    q: query,
    page_size: String(perPage),
    license: 'cc0,pdm,by,by-sa',
    mature: 'false',
  })
  const response = await fetch(`https://api.openverse.org/v1/images/?${params}`, {
    headers: { 'User-Agent': 'Ledora/1.0 (social creative generator)', Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Openverse HTTP ${response.status}`)
  const payload = await response.json().catch(() => null)
  const results = (payload && payload.results) || []
  return results.filter((entry) => entry && entry.url)
}

async function normalise(buffer, width, height) {
  const meta = await sharp(buffer).metadata()
  if (!meta || !meta.width || !meta.height) throw new Error('Invalid image')
  return sharp(buffer)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
}

/**
 * Returns `{ buffer, source, query }` or null. Cached by query + seed so a
 * retry or monthly refresh does not hammer the free API.
 */
async function fetchStockPhoto({ query, seed = 0, width = 1080, height = 1080 }) {
  const safeQuery = String(query || 'small business india').slice(0, 120)
  const key = hash(`${safeQuery}|${seed}|${width}x${height}`)
  const file = path.join(CACHE_DIR, `${key}.jpg`)

  if (fs.existsSync(file)) {
    try {
      return { buffer: await fs.promises.readFile(file), source: 'cache', query: safeQuery }
    } catch {
      /* cache read failed, fall through */
    }
  }

  // Keep the whole lookup inside a fixed budget so one dead photo host can
  // never stall a 15-creative batch. The banner still renders over a brand
  // gradient if no photo arrives.
  const deadline = Date.now() + 45000
  const timeLeft = () => deadline - Date.now()

  let results = []
  try {
    results = await searchOpenverse(safeQuery)
  } catch (error) {
    console.warn('[stock] Openverse search failed:', error.message)
  }

  const ordered = results
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => ((a.index + seed) % results.length) - ((b.index + seed) % results.length))
    .map(({ entry }) => entry)

  const candidates = []
  for (const entry of ordered) {
    if (entry.url) candidates.push(entry.url)
    if (entry.thumbnail) candidates.push(entry.thumbnail)
    if (candidates.length >= 6) break
  }

  for (const url of candidates) {
    if (timeLeft() < 5000) break
    try {
      const raw = await downloadBuffer(url, { timeoutMs: Math.min(15000, timeLeft()) })
      const buffer = await normalise(raw, width, height)
      await fs.promises.writeFile(file, buffer).catch(() => {})
      return { buffer, source: 'openverse', query: safeQuery }
    } catch (error) {
      console.warn(`[stock] photo failed (${url.slice(0, 60)}): ${error.message}`)
    }
  }

  // Absolutely-last-resort photo source. Picsum returns a real photograph with
  // no API key; it may not match the category, but the design still renders.
  const picsumSeeds = [seed, seed + 7, seed + 13]
  for (const picsumSeed of picsumSeeds) {
    if (timeLeft() < 5000) break
    try {
      const raw = await downloadBuffer(
        `https://picsum.photos/seed/ledora-${safeQuery.length}-${picsumSeed}/1400/1400`,
        { timeoutMs: Math.min(15000, timeLeft()) }
      )
      const buffer = await normalise(raw, width, height)
      await fs.promises.writeFile(file, buffer).catch(() => {})
      return { buffer, source: 'picsum', query: safeQuery }
    } catch (error) {
      console.warn('[stock] Picsum fallback failed:', error.message)
    }
  }

  return null
}

module.exports = { fetchStockPhoto, searchQueryFor, CATEGORY_KEYWORDS }
