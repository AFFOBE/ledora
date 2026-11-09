/**
 * One AI presenter portrait per deployment. The portrait is generated once,
 * cached on disk and reused by every reel. This keeps the free Pollinations
 * quota (one image / 45s) practical while still giving each business a real
 * on-camera AI presenter.
 */

const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { UPLOAD_DIR } = require('../../middlewares/upload.middleware')
const { generateAiImage } = require('./aiImage')
const { fetchStockPhoto } = require('./stock')

const CACHE_DIR = path.join(UPLOAD_DIR, 'cache', 'presenter')
fs.mkdirSync(CACHE_DIR, { recursive: true })
const CACHE_FILE = path.join(CACHE_DIR, 'ai-presenter-v3.jpg')

const PROMPT = [
  'professional Indian female social media brand presenter, warm friendly expression,',
  'lips relaxed and slightly parted as if speaking to camera, natural talking pose,',
  'smart business casual blazer, medium shot from waist up, looking directly at camera,',
  'clean studio background, soft cinematic lighting, photorealistic, sharp focus,',
  'high detail face, friendly and trustworthy, advertising campaign host, 4k portrait',
].join(' ')

let pending = null

async function cached() {
  if (!fs.existsSync(CACHE_FILE)) return null
  try {
    return await fs.promises.readFile(CACHE_FILE)
  } catch {
    return null
  }
}

async function createFallback() {
  // A real public photo of a professional woman is a much better backup than a
  // blank silhouette. It still gets the AI presenter branding in the video.
  try {
    const stock = await fetchStockPhoto({
      query: 'indian woman professional business portrait smiling office',
      seed: 23,
      width: 1024,
      height: 1024,
    })
    if (stock && stock.buffer) return stock.buffer
  } catch {
    /* ignore */
  }

  // Final fallback: a clean illustrated avatar (no external photo needed).
  try {
    const response = await fetch(
      'https://api.dicebear.com/9.x/notionists/png?seed=ledora-presenter&size=1024&backgroundColor=6d33e7',
      { signal: AbortSignal.timeout(15000) }
    )
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length > 5000) {
        return sharp(buffer).resize(1024, 1024, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
      }
    }
  } catch {
    /* ignore */
  }

  return null
}

/**
 * Returns `{ buffer, source }`. Safe to call from multiple workers: only one
 * generation runs at a time and the result is cached for the next plan.
 */
async function ensurePresenter() {
  const existing = await cached()
  if (existing) return { buffer: existing, source: 'cache' }
  if (pending) return pending

  pending = (async () => {
    let buffer = null
    let source = 'pollinations'
    try {
      const ai = await generateAiImage(PROMPT, {
        width: 1024,
        height: 1024,
        seed: 41,
        timeoutMs: 90000,
        maxWaitMs: 100000,
      })
      if (ai && ai.buffer) buffer = ai.buffer
    } catch (error) {
      console.warn('[presenter] AI portrait failed:', error.message)
    }

    if (!buffer) {
      buffer = await createFallback()
      source = buffer ? 'stock' : 'none'
    }

    if (buffer) {
      try {
        const normalised = await sharp(buffer)
          .rotate()
          .resize(1024, 1024, { fit: 'cover', position: 'attention' })
          .jpeg({ quality: 92, mozjpeg: true })
          .toBuffer()
        await fs.promises.writeFile(CACHE_FILE, normalised)
        buffer = normalised
      } catch (error) {
        console.warn('[presenter] could not cache portrait:', error.message)
      }
    }

    return { buffer, source }
  })()

  try {
    return await pending
  } finally {
    pending = null
  }
}

module.exports = { ensurePresenter }
