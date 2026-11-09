const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')
const ApiError = require('../utils/ApiError')

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

// Make sure the folder exists before the first upload.
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10)
    const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : ''
    const owner = req.user && req.user._id ? String(req.user._id) : 'anon'
    const name = `${owner}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`
    cb(null, name)
  },
})

const ALLOWED_IMAGE = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]

const ALLOWED_VIDEO = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
]

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE.includes(file.mimetype) || ALLOWED_VIDEO.includes(file.mimetype)) {
    return cb(null, true)
  }
  return cb(new ApiError(400, 'Only JPG, PNG, WEBP, GIF images and MP4, MOV, WEBM videos are supported'))
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 250 * 1024 * 1024 },
})

const handleUploadError = (error, next) => {
  if (!(error instanceof multer.MulterError)) return next(error)
  const message =
    error.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : error.message
  return next(new ApiError(400, message))
}

const singleMedia = (req, res, next) =>
  upload.single('file')(req, res, (error) => {
    if (!error) return next()
    return handleUploadError(error, next)
  })

const ALLOWED_LOGO = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

const logoUploader = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_LOGO.includes(file.mimetype)) return cb(null, true)
    return cb(new ApiError(400, 'Logo must be a PNG, JPG, WEBP or SVG image up to 8 MB'))
  },
})

/** Logo-only upload: images, max 8 MB. Everything else is rejected early. */
const singleLogo = (req, res, next) =>
  logoUploader.single('file')(req, res, (error) => {
    if (!error) return next()
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'Logo is too large. Maximum size is 8 MB.'))
    }
    return handleUploadError(error, next)
  })

const mediaKind = (mimetype = '') =>
  String(mimetype).startsWith('video/') ? 'video' : 'image'

/** Resolve a stored relative media path without allowing directory traversal. */
const resolveMediaPath = (relative) => {
  const clean = String(relative || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
  if (!clean || clean.includes('..')) return ''
  const absolute = path.resolve(UPLOAD_DIR, clean)
  const root = path.resolve(UPLOAD_DIR)
  return absolute.startsWith(root + path.sep) ? absolute : ''
}

module.exports = { singleMedia, singleLogo, UPLOAD_DIR, mediaKind, resolveMediaPath }
