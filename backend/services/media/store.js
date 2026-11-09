const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { UPLOAD_DIR } = require('../../middlewares/upload.middleware')

const GENERATED_DIR = path.join(UPLOAD_DIR, 'generated')
fs.mkdirSync(GENERATED_DIR, { recursive: true })

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
}

const driver = () => String(process.env.MEDIA_PUBLIC_DRIVER || 'catbox').toLowerCase()
const baseUrl = () =>
  String(process.env.MEDIA_BASE_URL || process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

const safeId = (value) => String(value || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)

/** Resolve a stored relative path inside backend/uploads without allowing traversal. */
function resolveUploadPath(relative) {
  const clean = String(relative || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
  if (!clean || clean.includes('..')) return ''
  const absolute = path.resolve(UPLOAD_DIR, clean)
  const root = path.resolve(UPLOAD_DIR)
  return absolute.startsWith(root + path.sep) || absolute === root ? absolute : ''
}

function mimeFor(filePath) {
  return MIME[path.extname(String(filePath || '')).toLowerCase()] || 'application/octet-stream'
}

function localUrl(relative) {
  return `${baseUrl()}/uploads/${String(relative || '').replace(/\\/g, '/').replace(/^\/+/, '')}`
}

/**
 * Persist a generated buffer locally and return both the relative path and the
 * immediately usable (local) URL.
 */
async function saveBuffer({ userId, name, buffer, ext = '.png' }) {
  const root = path.join(GENERATED_DIR, safeId(userId))
  fs.mkdirSync(root, { recursive: true })
  const safeName = `${String(name || 'file').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40)}-${Date.now()}-${crypto
    .randomBytes(4)
    .toString('hex')}${ext}`
  const absolute = path.join(root, safeName)
  await fs.promises.writeFile(absolute, buffer)
  const relative = path.relative(UPLOAD_DIR, absolute).replace(/\\/g, '/')
  return {
    absolute,
    relative,
    url: localUrl(relative),
    size: buffer.length,
    mimeType: mimeFor(absolute),
  }
}

async function uploadToCatbox(absolute, filename) {
  const buffer = await fs.promises.readFile(absolute)
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', new Blob([buffer], { type: mimeFor(absolute) }), filename)

  const response = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(120000),
  })
  const text = (await response.text()).trim()
  if (!response.ok || !/^https?:\/\//i.test(text)) {
    throw new Error(`Public media mirror failed (HTTP ${response.status})`)
  }
  return text
}

/**
 * Temporary public host (files expire after a few hours). Used as a fallback
 * when the permanent hosts are unreachable, which is enough because Instagram,
 * Facebook and Google Business fetch the file immediately while publishing.
 */
async function uploadToUguu(absolute, filename) {
  const buffer = await fs.promises.readFile(absolute)
  const form = new FormData()
  form.append('files[]', new Blob([buffer], { type: mimeFor(absolute) }), filename)

  const response = await fetch('https://uguu.se/upload.php', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(120000),
  })
  const data = await response.json().catch(() => ({}))
  const url = data && Array.isArray(data.files) && data.files[0] && data.files[0].url
  if (!response.ok || !url || !/^https?:\/\//i.test(url)) {
    throw new Error(`uguu mirror failed (HTTP ${response.status})`)
  }
  return url
}

async function uploadToFal(absolute, filename) {
  const key = String(process.env.FAL_KEY || '').trim()
  if (!key) throw new Error('FAL_KEY is not configured')
  const contentType = mimeFor(absolute)
  const initiate = await fetch('https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: contentType, file_name: filename }),
    signal: AbortSignal.timeout(30000),
  })
  const init = await initiate.json().catch(() => ({}))
  if (!initiate.ok || !init.upload_url || !init.file_url) {
    throw new Error(init.detail || `fal storage upload failed (HTTP ${initiate.status})`)
  }
  const buffer = await fs.promises.readFile(absolute)
  const put = await fetch(init.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: buffer,
    signal: AbortSignal.timeout(120000),
  })
  if (!put.ok) throw new Error(`fal storage PUT failed (HTTP ${put.status})`)
  return init.file_url
}

async function uploadToCloudinary(absolute) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET
  if (!cloud || !preset) throw new Error('Cloudinary is not configured')
  const buffer = await fs.promises.readFile(absolute)
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: mimeFor(absolute) }), path.basename(absolute))
  form.append('upload_preset', preset)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(120000),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || `Cloudinary upload failed (HTTP ${response.status})`)
  }
  return data.secure_url
}

const publicCache = new Map()

/**
 * Confirms a mirrored URL is directly fetchable with the right content type.
 * Some hosts return an HTML preview page instead of the raw file, which
 * Instagram/Facebook reject, so those URLs must not be cached as public.
 */
async function verifyPublicUrl(url, expectedMime) {
  if (!/^https?:\/\//i.test(String(url || ''))) return false
  const want = String(expectedMime || '').toLowerCase()
  const check = async (method) => {
    const response = await fetch(url, {
      method,
      headers: method === 'GET' ? { Range: 'bytes=0-1023' } : undefined,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    })
    if (!response.ok && response.status !== 206) return false
    const type = String(response.headers.get('content-type') || '').toLowerCase()
    if (response.body && method === 'GET') await response.body.cancel().catch(() => {})
    if (!want) return true
    if (type.startsWith(want.split('/')[0] + '/')) return true
    // Some CDNs label binaries as octet-stream; the platform download is still valid.
    return type.includes('octet-stream')
  }
  try {
    if (await check('HEAD')) return true
    try {
      return await check('GET')
    } catch {
      return false
    }
  } catch {
    return false
  }
}

/**
 * Mirrors a local upload to a public HTTPS host. Instagram, Facebook and Google
 * Business need a public URL; LinkedIn and YouTube read the local bytes.
 */
async function mirrorToPublic(relative, { force = false } = {}) {
  const key = String(relative || '')
  if (!key) return ''
  if (!force && publicCache.has(key)) return publicCache.get(key)

  const driverName = driver()
  if (driverName === 'none' || driverName === 'local') return ''

  const absolute = resolveUploadPath(key)
  if (!absolute || !fs.existsSync(absolute)) return ''
  const filename = path.basename(absolute)
  const expectedMime = mimeFor(absolute)

  const attempts = []
  if (driverName === 'fal') attempts.push(() => uploadToFal(absolute, filename))
  if (driverName === 'cloudinary') attempts.push(() => uploadToCloudinary(absolute))
  if (driverName === 'uguu') attempts.push(() => uploadToUguu(absolute, filename))
  if (driverName === 'catbox' || driverName === 'auto') {
    attempts.push(() => uploadToCatbox(absolute, filename))
    attempts.push(() => uploadToUguu(absolute, filename))
    attempts.push(() => uploadToFal(absolute, filename))
  }
  if (process.env.CLOUDINARY_CLOUD_NAME) attempts.push(() => uploadToCloudinary(absolute))

  for (const attempt of attempts) {
    try {
      const url = await attempt()
      if (url && (await verifyPublicUrl(url, expectedMime))) {
        publicCache.set(key, url)
        return url
      }
      if (url) console.warn(`[media] public mirror rejected unverifiable URL ${url}`)
    } catch (error) {
      console.warn(`[media] public mirror failed for ${filename}: ${error.message}`)
    }
  }
  return ''
}

module.exports = {
  GENERATED_DIR,
  saveBuffer,
  resolveUploadPath,
  localUrl,
  mimeFor,
  mirrorToPublic,
}
