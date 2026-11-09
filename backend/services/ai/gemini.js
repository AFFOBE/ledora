/**
 * Thin Gemini API client.
 *
 * Text generation powers the content calendar and images power the creatives.
 * Every call fails soft: the caller can fall back to the local template engine
 * and the local brand designer, so a quota/outage never blocks a purchase.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const TEXT_FALLBACKS = [
  process.env.GEMINI_TEXT_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
].filter(Boolean) 

const IMAGE_FALLBACKS = [
  process.env.GEMINI_IMAGE_MODEL,
  'gemini-3.1-flash-image',
  'gemini-nano-banana-2.1',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
].filter(Boolean)

const unique = (list) => [...new Set(list)]

class GeminiError extends Error {
  constructor(message, { status = 0, code = 'GEMINI_ERROR' } = {}) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
    this.code = code
  }
}

const apiKey = () => String(process.env.GEMINI_API_KEY || '').trim()
const isConfigured = () => Boolean(apiKey())

const IMAGE_BLOCK = {
  until: 0,
  reason: '',
}

const imageBlocked = () => Date.now() < IMAGE_BLOCK.until
const imageBlockReason = () => (imageBlocked() ? IMAGE_BLOCK.reason : '')

function blockImages(reason, ms = 6 * 60 * 60 * 1000) {
  IMAGE_BLOCK.until = Date.now() + ms
  IMAGE_BLOCK.reason = reason
  console.warn(`[gemini] image generation paused: ${reason}`)
}

function friendlyMessage(status, payload) {
  const err = (payload && payload.error) || {}
  const raw = String(err.message || '')
  if (raw) return raw
  if (status === 429) return 'Gemini rate limit reached'
  if (status === 401 || status === 403) return 'Gemini API key was rejected'
  return `Gemini request failed (HTTP ${status})`
}

async function callModel(model, body, timeoutMs = 60000) {
  if (!isConfigured()) throw new GeminiError('GEMINI_API_KEY is not configured', { code: 'NO_KEY' })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await response.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }

    if (!response.ok) {
      const message = friendlyMessage(response.status, payload)
      const lower = message.toLowerCase()
      const code =
        response.status === 429
          ? 'QUOTA'
          : response.status === 404 && lower.includes('no longer available')
            ? 'RETIRED'
            : response.status === 401 || response.status === 403
              ? 'AUTH'
              : 'HTTP'
      throw new GeminiError(message, { status: response.status, code })
    }

    return payload
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new GeminiError('Gemini request timed out', { code: 'TIMEOUT' })
    }
    if (error instanceof GeminiError) throw error
    throw new GeminiError(error.message || 'Gemini network error', { code: 'NETWORK' })
  } finally {
    clearTimeout(timer)
  }
}

function extractText(payload) {
  const parts =
    (payload &&
      payload.candidates &&
      payload.candidates[0] &&
      payload.candidates[0].content &&
      payload.candidates[0].content.parts) ||
    []
  return parts
    .filter((part) => typeof part.text === 'string' && part.text.trim())
    .map((part) => part.text)
    .join('\n')
    .trim()
}

function parseJsonText(text) {
  if (!text) return null
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

/**
 * Generate plain text. Tries the configured model and then a couple of
 * current generation fallbacks if the model has been retired.
 */
async function generateText(prompt, { temperature = 0.9, maxOutputTokens = 8192, timeoutMs = 90000 } = {}) {
  let lastError = null
  for (const model of unique(TEXT_FALLBACKS)) {
    try {
      const payload = await callModel(
        model,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens },
        },
        timeoutMs
      )
      const text = extractText(payload)
      if (!text) throw new GeminiError('Gemini returned an empty response', { code: 'EMPTY' })
      return { text, model }
    } catch (error) {
      lastError = error
      console.warn(`[gemini] text model ${model} failed: ${error.message}`)
      if (error.code === 'NO_KEY' || error.code === 'AUTH') break
    }
  }
  throw lastError || new GeminiError('Gemini text generation failed')
}

/**
 * Generate a JSON object. Gemini is asked for JSON mime type, but we also
 * tolerate fenced/spurious text in the response.
 */
async function generateJson(prompt, options = {}) {
  let lastError = null
  for (const model of unique(TEXT_FALLBACKS)) {
    try {
      const payload = await callModel(
        model,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.9,
            maxOutputTokens: options.maxOutputTokens ?? 8192,
            responseMimeType: 'application/json',
          },
        },
        options.timeoutMs ?? 90000
      )
      const text = extractText(payload)
      const json = parseJsonText(text)
      if (!json) throw new GeminiError('Gemini did not return valid JSON', { code: 'BAD_JSON' })
      return { data: json, model, raw: text }
    } catch (error) {
      lastError = error
      console.warn(`[gemini] JSON model ${model} failed: ${error.message}`)
      if (error.code === 'NO_KEY' || error.code === 'AUTH') break
    }
  }
  throw lastError || new GeminiError('Gemini JSON generation failed')
}

/**
 * Generate one image. Returns { buffer, mimeType, model, prompt }.
 * The image model is quota-gated on many Google projects, so once we see a
 * hard quota/auth failure we pause image calls instead of retrying every item.
 */
async function generateImage(prompt, { timeoutMs = 90000, aspectRatio = '1:1' } = {}) {
  if (!isConfigured()) throw new GeminiError('GEMINI_API_KEY is not configured', { code: 'NO_KEY' })
  if (process.env.GEMINI_IMAGE_ENABLED === 'false') {
    throw new GeminiError('Gemini image generation is disabled', { code: 'DISABLED' })
  }
  if (imageBlocked()) {
    throw new GeminiError(`Gemini image generation paused: ${imageBlockReason()}`, { code: 'PAUSED' })
  }

  let lastError = null
  for (const model of unique(IMAGE_FALLBACKS)) {
    try {
      const payload = await callModel(
        model,
        {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
          },
        },
        timeoutMs
      )
      const parts =
        (payload &&
          payload.candidates &&
          payload.candidates[0] &&
          payload.candidates[0].content &&
          payload.candidates[0].content.parts) ||
        []
      const imagePart = parts.find((part) => part.inlineData && part.inlineData.data)
      if (!imagePart) {
        throw new GeminiError('Gemini did not return an image', { code: 'NO_IMAGE' })
      }
      return {
        buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
        mimeType: imagePart.inlineData.mimeType || 'image/png',
        model,
        prompt,
      }
    } catch (error) {
      lastError = error
      const message = String(error.message || '').toLowerCase()
      const hardQuota =
        error.code === 'QUOTA' ||
        message.includes('limit: 0') ||
        message.includes('exceeded your current quota')
      const unsupported =
        message.includes('does not support image') ||
        message.includes('response modalities') ||
        message.includes('not supported')
      if (hardQuota) {
        blockImages('the Google project has no image-generation quota (enable billing or use another key)')
        break
      }
      if (error.code === 'AUTH' || error.code === 'NO_KEY' || error.code === 'DISABLED') break
      if (unsupported) continue
      console.warn(`[gemini] image model ${model} failed: ${error.message}`)
    }
  }
  throw lastError || new GeminiError('Gemini image generation failed')
}

module.exports = {
  isConfigured,
  generateText,
  generateJson,
  generateImage,
  imageBlocked,
  imageBlockReason,
  GeminiError,
}
