/**
 * Pollinations.ai image client.
 *
 * The free tier allows one image every 45 seconds per IP, so requests are
 * serialised and the "retry after" value is respected. Generated images are
 * cached on disk. If the service is unavailable the caller falls back to a
 * public photo (stock.js), so generation never stalls forever.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { UPLOAD_DIR } = require('../../middlewares/upload.middleware')

const CACHE_DIR = path.join(UPLOAD_DIR, 'cache', 'ai')
fs.mkdirSync(CACHE_DIR, { recursive: true })

const MIN_GAP_MS = 46000
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const hash = (value) => crypto.createHash('sha1').update(String(value)).digest('hex')

let chain = Promise.resolve()
let lastRequestAt = 0

const enqueue = (task) => {
  const run = chain.then(task, task)
  chain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function retryAfterMs(payload, fallback = 45000) {
  const message = String(
    (payload && payload.error && payload.error.message) || payload || ''
  )
  const match = message.match(/retry after\s+(\d+)\s*s/i)
  return match ? Number(match[1]) * 1000 + 1200 : fallback
}

async function requestPollinations(prompt, { width, height, seed, timeoutMs }) {
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    nologo: 'true',
    seed: String(seed),
  })
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 Ledora/1.0' },
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let payload = null
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
    const error = new Error(`Pollinations HTTP ${response.status}`)
    error.status = response.status
    error.retryAfter = retryAfterMs(payload)
    throw error
  }

  const type = String(response.headers.get('content-type') || '')
  if (!type.startsWith('image/')) throw new Error(`Pollinations returned ${type}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length < 5000) throw new Error('Pollinations returned an empty image')
  return buffer
}

/**
 * Generate (or reuse) an AI image. `maxWaitMs` is how long the caller is happy
 * to wait for the shared free quota. Pass 0 to use the cache only / never wait.
 */
async function generateAiImage(
  prompt,
  { width = 1024, height = 1024, seed = 1, timeoutMs = 90000, maxWaitMs = 0 } = {}
) {
  const clean = String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 1400)
  if (!clean) return null
  const key = hash(`${clean}|${width}x${height}|${seed}`)
  const file = path.join(CACHE_DIR, `${key}.jpg`)

  if (fs.existsSync(file)) {
    try {
      return { buffer: await fs.promises.readFile(file), source: 'cache' }
    } catch {
      /* ignore cache read failure */
    }
  }

  return enqueue(async () => {
    if (fs.existsSync(file)) {
      try {
        return { buffer: await fs.promises.readFile(file), source: 'cache' }
      } catch {
        /* ignore */
      }
    }

    const started = Date.now()
    let attempts = 0
    while (attempts < 3) {
      const remaining = maxWaitMs - (Date.now() - started)
      if (remaining <= 500) return null
      attempts += 1
      const wait = MIN_GAP_MS - (Date.now() - lastRequestAt)
      if (wait > 0) {
        // Never sleep longer than the caller is willing to wait.
        if (wait + 500 > remaining) return null
        await sleep(wait + 500)
      }

      try {
        const capped = Math.max(1000, Math.min(timeoutMs, maxWaitMs - (Date.now() - started)))
        const buffer = await requestPollinations(clean, { width, height, seed, timeoutMs: capped })
        lastRequestAt = Date.now()
        await fs.promises.writeFile(file, buffer).catch(() => {})
        return { buffer, source: 'pollinations' }
      } catch (error) {
        lastRequestAt = Date.now()
        const left = maxWaitMs - (Date.now() - started)
        if (left <= 1000) return null
        if (error.status === 402) {
          await sleep(Math.min(error.retryAfter || 45000, left))
        } else if (error.status === 503 || error.status === 429) {
          await sleep(Math.min(8000, left))
        } else {
          return null
        }
      }
    }
    return null
  })
}

module.exports = { generateAiImage }
