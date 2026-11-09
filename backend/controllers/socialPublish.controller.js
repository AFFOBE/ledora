const mongoose = require('mongoose')
const SocialPost = require('../models/SocialPost')
const SocialPlan = require('../models/SocialPlan')
const SocialAccount = require('../models/SocialAccount')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')
const { mediaKind, UPLOAD_DIR } = require('../middlewares/upload.middleware')
const { executePost } = require('../services/social/publisher')

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'youtube', 'google-business']
const KINDS = ['post', 'reel', 'video']

const mediaBaseUrl = (req) =>
  String(
    process.env.MEDIA_BASE_URL ||
      process.env.BASE_URL ||
      `${req.protocol}://${req.get('host')}`
  ).replace(/\/$/, '')

const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''))

const serialize = (post) => {
  const value = typeof post.toObject === 'function' ? post.toObject() : post
  return value
}

const assertPlatformRules = ({ platform, kind, mediaType }) => {
  if (platform === 'instagram' && mediaType === 'none') {
    throw new ApiError(400, 'Instagram needs an image or video. Upload a file or paste a public media URL.')
  }
  if (platform === 'youtube' && mediaType !== 'video') {
    throw new ApiError(400, 'YouTube needs a video file (MP4, MOV or WEBM).')
  }
  if (platform === 'google-business' && mediaType === 'video') {
    throw new ApiError(400, 'Google Business posts support images only, not video.')
  }
  if (kind === 'reel' && mediaType !== 'video') {
    throw new ApiError(400, 'A reel needs a video file.')
  }
  if (kind === 'video' && mediaType !== 'video') {
    throw new ApiError(400, 'A video post needs a video file.')
  }
}

const uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No file uploaded. Choose an image or video first.')

  const url = `${mediaBaseUrl(req)}/uploads/${req.file.filename}`

  res.status(201).json(
    ApiResponse(
      201,
      {
        url,
        path: req.file.filename,
        mediaType: mediaKind(req.file.mimetype),
        mimeType: req.file.mimetype,
        size: req.file.size,
        filename: req.file.originalname,
        isPublic: !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url),
        uploadDir: UPLOAD_DIR,
      },
      'Media uploaded'
    )
  )
})

const listPosts = asyncHandler(async (req, res) => {
  const query = { userId: req.user._id }
  if (req.query.status) query.status = req.query.status
  if (req.query.platform) query.platform = req.query.platform

  const posts = await SocialPost.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 100, 200))
    .lean()

  res.json(ApiResponse(200, posts, 'Posts fetched'))
})

const createPost = asyncHandler(async (req, res) => {
  const {
    platform,
    accountId,
    kind = 'post',
    title = '',
    caption = '',
    hashtags = '',
    mediaUrl = '',
    mediaPath = '',
    mediaType = 'none',
    mimeType = '',
    scheduledAt = null,
    publishNow = false,
    creativeId = '',
  } = req.body || {}

  if (!PLATFORMS.includes(platform)) throw new ApiError(400, 'Choose a valid platform')
  if (!KINDS.includes(kind)) throw new ApiError(400, 'Choose a valid content type')
  if (!String(caption).trim() && !String(title).trim() && mediaType === 'none') {
    throw new ApiError(400, 'Add a caption or select a media file before publishing.')
  }

  assertPlatformRules({ platform, kind, mediaType })

  const accountQuery = { userId: req.user._id, platform, connected: true }
  if (accountId) {
    if (!isValidId(accountId)) throw new ApiError(400, 'Invalid social account id')
    accountQuery._id = accountId
  }

  const account = await SocialAccount.findOne(accountQuery).sort({ createdAt: -1 })
  if (!account) {
    throw new ApiError(
      400,
      `No connected ${platform} account found. Connect it first from Manage Social Accounts.`
    )
  }

  let scheduleDate = null
  if (scheduledAt) {
    scheduleDate = new Date(scheduledAt)
    if (Number.isNaN(scheduleDate.getTime())) throw new ApiError(400, 'Invalid schedule date/time')
  }

  const status = publishNow ? 'draft' : scheduleDate ? 'scheduled' : 'draft'

  const post = await SocialPost.create({
    userId: req.user._id,
    accountId: account._id,
    platform,
    kind,
    title: String(title).trim(),
    caption: String(caption),
    hashtags: String(hashtags),
    mediaUrl: String(mediaUrl).trim(),
    mediaPath: mediaPath
      ? String(mediaPath)
          .replace(/\\/g, '/')
          .replace(/^\/+/, '')
          .split('/')
          .filter((part) => part && part !== '.' && part !== '..')
          .join('/')
      : '',
    mediaType,
    mimeType: String(mimeType),
    scheduledAt: scheduleDate,
    status,
    creativeId: String(creativeId || ''),
  })

  if (creativeId) {
    await SocialPlan.updateOne(
      { userId: req.user._id, 'items.id': creativeId },
      { $set: { 'items.$.status': scheduleDate || publishNow ? 'Scheduled' : 'Draft' } }
    ).catch(() => {})
  }

  if (publishNow) {
    try {
      const published = await executePost(post._id)
      return res
        .status(201)
        .json(ApiResponse(201, serialize(published), 'Published successfully'))
    } catch (error) {
      const failed = await SocialPost.findById(post._id).lean()
      throw new ApiError(
        400,
        error.message || 'Publishing failed',
        failed ? { post: failed } : null
      )
    }
  }

  res.status(201).json(
    ApiResponse(
      201,
      serialize(post),
      scheduleDate ? 'Post scheduled — it will publish automatically' : 'Post saved as draft'
    )
  )
})

const publishPost = asyncHandler(async (req, res) => {
  const { id } = req.params
  if (!isValidId(id)) throw new ApiError(400, 'Invalid post id')

  const existing = await SocialPost.findOne({ _id: id, userId: req.user._id })
  if (!existing) throw new ApiError(404, 'Post not found')
  if (existing.status === 'cancelled') throw new ApiError(400, 'This post was cancelled')

  try {
    const post = await executePost(id)
    res.json(ApiResponse(200, serialize(post), 'Published successfully'))
  } catch (error) {
    const failed = await SocialPost.findById(id).lean()
    throw new ApiError(400, error.message || 'Publishing failed', failed ? { post: failed } : null)
  }
})

const cancelPost = asyncHandler(async (req, res) => {
  const { id } = req.params
  if (!isValidId(id)) throw new ApiError(400, 'Invalid post id')

  const post = await SocialPost.findOneAndUpdate(
    { _id: id, userId: req.user._id, status: { $in: ['draft', 'scheduled'] } },
    { $set: { status: 'cancelled', lockedAt: null } },
    { returnDocument: 'after' }
  )

  if (!post) throw new ApiError(409, 'Only draft or scheduled posts can be cancelled')

  if (post.creativeId) {
    await SocialPlan.updateOne(
      { userId: req.user._id, 'items.id': post.creativeId },
      { $set: { 'items.$.status': 'Draft' } }
    ).catch(() => {})
  }

  res.json(ApiResponse(200, serialize(post), 'Post cancelled'))
})

const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params
  if (!isValidId(id)) throw new ApiError(400, 'Invalid post id')

  const post = await SocialPost.findOne({ _id: id, userId: req.user._id })
  if (!post) throw new ApiError(404, 'Post not found')
  if (post.status === 'publishing') {
    throw new ApiError(409, 'This post is publishing right now. Try again in a moment.')
  }

  await SocialPost.deleteOne({ _id: post._id })
  res.json(ApiResponse(200, { id }, 'Post removed from queue'))
})

const getPublishSummary = asyncHandler(async (req, res) => {
  const [accounts, posts] = await Promise.all([
    SocialAccount.find({ userId: req.user._id, connected: true })
      .select('platform platformUserId username connected createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    SocialPost.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100).lean(),
  ])

  const uniqueAccounts = accounts.filter(
    (account, index, list) =>
      list.findIndex(
        (item) =>
          item.platform === account.platform && item.platformUserId === account.platformUserId
      ) === index
  )

  res.json(
    ApiResponse(
      200,
      {
        accounts: uniqueAccounts,
        posts,
        counts: {
          scheduled: posts.filter((post) => post.status === 'scheduled').length,
          posted: posts.filter((post) => post.status === 'posted').length,
          failed: posts.filter((post) => post.status === 'failed').length,
        },
      },
      'Publishing summary fetched'
    )
  )
})

module.exports = {
  uploadMedia,
  listPosts,
  createPost,
  publishPost,
  cancelPost,
  deletePost,
  getPublishSummary,
}
