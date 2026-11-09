const fs = require('fs')
const path = require('path')
const SocialPost = require('../../models/SocialPost')
const SocialPlan = require('../../models/SocialPlan')
const ApiError = require('../../utils/ApiError')
const { UPLOAD_DIR, resolveMediaPath } = require('../../middlewares/upload.middleware')
const { mirrorToPublic } = require('../media/store')
const { loadAccount, ensureAccessToken, graphUrl } = require('./token')

const LINKEDIN_API = 'https://api.linkedin.com'
const currentLinkedInVersion = () => {
  const now = new Date()
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || currentLinkedInVersion()
const YOUTUBE_UPLOAD_URL =
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'
const GBP_ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
const GBP_LOCATIONS_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const GBP_POSTS_URL = 'https://mybusiness.googleapis.com/v4'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isPrivateHost = (hostname = '') => {
  const host = String(hostname).toLowerCase()
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
}

const isPublicHttpUrl = (value) => {
  try {
    const url = new URL(String(value || ''))
    if (!['http:', 'https:'].includes(url.protocol)) return false
    return !isPrivateHost(url.hostname)
  } catch {
    return false
  }
}

const fullCaption = (post) =>
  [post.caption, post.hashtags]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()

async function parseResponse(response) {
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { data, text }
}

function failMessage(platform, status, data, fallback) {
  const detail =
    (data && data.error && (data.error.message || data.error.error_user_msg)) ||
    (data && data.message) ||
    (typeof data === 'string' ? data.slice(0, 300) : '')
  return new ApiError(
    status >= 400 && status < 500 ? 400 : 502,
    `${platform} publish failed${detail ? `: ${detail}` : ` (HTTP ${status})`}`
  )
}

async function readMediaBytes(post) {
  if (post.mediaPath) {
    const filePath =
      resolveMediaPath(post.mediaPath) ||
      path.join(UPLOAD_DIR, path.basename(post.mediaPath))
    if (fs.existsSync(filePath)) {
      return {
        buffer: await fs.promises.readFile(filePath),
        mimeType: post.mimeType || (post.mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
      }
    }
  }

  if (/^https?:\/\//i.test(post.mediaUrl || '')) {
    if (!isPublicHttpUrl(post.mediaUrl)) {
      throw new ApiError(
        400,
        'Media URL must be a public HTTPS address. Localhost and private network URLs are not allowed.'
      )
    }

    const response = await fetch(post.mediaUrl)
    if (!response.ok) {
      throw new ApiError(400, `Could not download media for upload (HTTP ${response.status})`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    return {
      buffer,
      mimeType:
        response.headers.get('content-type') ||
        post.mimeType ||
        (post.mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
    }
  }

  throw new ApiError(
    400,
    'Media file is missing. Upload a file or paste a public media URL before publishing.'
  )
}

function requirePublicMedia(post, platform) {
  if (!post.mediaUrl || !isPublicHttpUrl(post.mediaUrl)) {
    throw new ApiError(
      400,
      `${platform} needs a publicly reachable HTTPS media URL. Your backend is running on ${
        process.env.BASE_URL || 'http://localhost:5000'
      }. Set BASE_URL to a public domain (or paste a hosted media URL) before publishing media.`
    )
  }
}

/**
 * Instagram, Facebook and Google Business fetch the file themselves, so a local
 * upload is mirrored to a public host right before publishing.
 */
async function ensurePublicMedia(post) {
  if (!post.mediaPath) return
  if (post.mediaUrl && isPublicHttpUrl(post.mediaUrl)) return
  const url = await mirrorToPublic(post.mediaPath)
  if (url) {
    post.mediaUrl = url
    await post.save().catch(() => {})
  }
}

/* ------------------------------------------------------------------ */
/* Facebook Page                                                       */
/* ------------------------------------------------------------------ */

async function graphPost(pathname, token, params) {
  const body = new URLSearchParams({ ...params, access_token: token })
  const response = await fetch(graphUrl(pathname), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const { data } = await parseResponse(response)
  if (!response.ok || (data && data.error)) {
    throw failMessage('Facebook', response.status, data, 'Facebook rejected the post')
  }
  return data
}

async function publishFacebook(post, account, token) {
  const pageId = account.platformUserId
  if (!pageId) throw new ApiError(400, 'Facebook Page ID is missing. Reconnect the Page.')
  const caption = fullCaption(post)

  if (post.mediaType === 'none') {
    const data = await graphPost(`/${pageId}/feed`, token, {
      message: caption || post.title || 'New post',
    })
    return {
      externalId: String(data.id || ''),
      externalUrl: data.id ? `https://www.facebook.com/${data.id}` : `https://www.facebook.com/${pageId}`,
    }
  }

  requirePublicMedia(post, 'Facebook')

  if (post.mediaType === 'image') {
    const data = await graphPost(`/${pageId}/photos`, token, {
      url: post.mediaUrl,
      caption: caption || post.title || '',
      published: 'true',
    })
    const postId = data.post_id || data.id
    return {
      externalId: String(postId || ''),
      externalUrl: `https://www.facebook.com/${postId || pageId}`,
    }
  }

  if (post.kind === 'reel') {
    const start = await graphPost(`/${pageId}/video_reels`, token, {
      upload_phase: 'start',
      file_url: post.mediaUrl,
    })
    if (!start.video_id) {
      throw new ApiError(502, 'Facebook did not return a reel video id')
    }
    const finish = await graphPost(`/${pageId}/video_reels`, token, {
      upload_phase: 'finish',
      video_id: String(start.video_id),
      video_state: 'PUBLISHED',
      description: caption || post.title || '',
    })
    const videoId = String(finish.video_id || start.video_id)
    return {
      externalId: videoId,
      externalUrl: `https://www.facebook.com/reel/${videoId}`,
    }
  }

  const data = await graphPost(`/${pageId}/videos`, token, {
    file_url: post.mediaUrl,
    description: caption || post.title || '',
    title: post.title || '',
  })
  return {
    externalId: String(data.id || ''),
    externalUrl: data.id
      ? `https://www.facebook.com/${pageId}/videos/${data.id}`
      : `https://www.facebook.com/${pageId}`,
  }
}

/* ------------------------------------------------------------------ */
/* Instagram Business                                                  */
/* ------------------------------------------------------------------ */

async function graphGetJson(pathname, token, params = {}) {
  const url = new URL(graphUrl(pathname))
  Object.entries({ ...params, access_token: token }).forEach(([key, value]) =>
    url.searchParams.set(key, String(value))
  )
  const response = await fetch(url)
  const { data } = await parseResponse(response)
  if (!response.ok || (data && data.error)) {
    throw failMessage('Instagram', response.status, data, 'Instagram request failed')
  }
  return data
}

async function waitForInstagramContainer(containerId, token) {
  // Video containers can take a few minutes to process.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const data = await graphGetJson(`/${containerId}`, token, { fields: 'status_code,status' })
    const status = String(data.status_code || '').toUpperCase()
    if (status === 'FINISHED') return
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new ApiError(400, `Instagram could not process the media: ${data.status || status}`)
    }
    await sleep(attempt < 5 ? 2000 : 5000)
  }
  throw new ApiError(504, 'Instagram media processing timed out. Try a smaller or shorter video.')
}

async function publishInstagram(post, account, token) {
  const igId = account.platformUserId
  if (!igId) throw new ApiError(400, 'Instagram Business account ID is missing. Reconnect Instagram.')
  if (post.mediaType === 'none') {
    throw new ApiError(400, 'Instagram requires an image or video. Text-only posts are not supported.')
  }

  requirePublicMedia(post, 'Instagram')
  const caption = fullCaption(post)
  const params = { caption }

  if (post.mediaType === 'video') {
    params.media_type = post.kind === 'reel' ? 'REELS' : 'VIDEO'
    params.video_url = post.mediaUrl
    if (post.kind === 'reel') params.share_to_feed = 'true'
  } else {
    params.image_url = post.mediaUrl
  }

  const container = await graphPost(`/${igId}/media`, token, params)
  if (!container.id) throw new ApiError(502, 'Instagram did not return a media container id')

  await waitForInstagramContainer(String(container.id), token)

  const published = await graphPost(`/${igId}/media_publish`, token, {
    creation_id: String(container.id),
  })
  if (!published.id) throw new ApiError(502, 'Instagram did not return a published media id')

  let permalink = ''
  try {
    const media = await graphGetJson(`/${published.id}`, token, { fields: 'permalink' })
    permalink = media.permalink || ''
  } catch {
    permalink = ''
  }

  return {
    externalId: String(published.id),
    externalUrl: permalink || `https://www.instagram.com/${account.username || ''}`,
  }
}

/* ------------------------------------------------------------------ */
/* LinkedIn                                                            */
/* ------------------------------------------------------------------ */

const linkedinHeaders = (token, extra = {}) => ({
  Authorization: `Bearer ${token}`,
  'LinkedIn-Version': LINKEDIN_VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
  ...extra,
})

async function linkedinJson(url, { method = 'GET', token, body }) {
  const response = await fetch(url, {
    method,
    headers: linkedinHeaders(token, {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }),
    body: body ? JSON.stringify(body) : undefined,
  })
  const { data } = await parseResponse(response)
  if (!response.ok) throw failMessage('LinkedIn', response.status, data, 'LinkedIn request failed')
  return { data, headers: response.headers }
}

async function uploadLinkedInImage(buffer, token, owner) {
  const init = await linkedinJson(`${LINKEDIN_API}/rest/images?action=initializeUpload`, {
    method: 'POST',
    token,
    body: { initializeUploadRequest: { owner } },
  })
  const uploadUrl = init.data?.value?.uploadUrl
  const imageUrn = init.data?.value?.image
  if (!uploadUrl || !imageUrn) throw new ApiError(502, 'LinkedIn did not return an image upload URL')

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: buffer,
  })
  if (!upload.ok) {
    throw new ApiError(502, `LinkedIn image upload failed (HTTP ${upload.status})`)
  }
  return imageUrn
}

async function uploadLinkedInVideo(buffer, token, owner, mimeType) {
  const init = await linkedinJson(`${LINKEDIN_API}/rest/videos?action=initializeUpload`, {
    method: 'POST',
    token,
    body: {
      initializeUploadRequest: {
        owner,
        fileSizeBytes: buffer.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    },
  })

  const value = init.data?.value || {}
  const videoUrn = value.video
  const uploadToken = value.uploadToken
  const instructions = value.uploadInstructions || []

  if (!videoUrn || !uploadToken || !instructions.length) {
    throw new ApiError(502, 'LinkedIn did not return a video upload plan')
  }

  const uploadedPartIds = []
  for (const part of instructions) {
    const first = Number(part.firstByte)
    const last = Number(part.lastByte)
    const chunk = buffer.subarray(first, last + 1)
    const upload = await fetch(part.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(chunk.length),
      },
      body: chunk,
    })
    if (!upload.ok) {
      throw new ApiError(502, `LinkedIn video upload failed (HTTP ${upload.status})`)
    }
    const etag = upload.headers.get('etag')
    if (etag) uploadedPartIds.push(etag.replace(/"/g, ''))
  }

  await linkedinJson(`${LINKEDIN_API}/rest/videos?action=finalizeUpload`, {
    method: 'POST',
    token,
    body: {
      finalizeUploadRequest: {
        video: videoUrn,
        uploadToken,
        uploadedPartIds,
      },
    },
  })

  // Wait for LinkedIn to process the video before attaching it to a post.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const status = await linkedinJson(
      `${LINKEDIN_API}/rest/videos/${encodeURIComponent(videoUrn)}`,
      { token }
    ).catch(() => null)
    const valueStatus = String(status?.data?.status || '').toUpperCase()
    if (['AVAILABLE', 'PROCESSING_COMPLETE'].includes(valueStatus)) break
    if (valueStatus === 'PROCESSING_FAILED') {
      throw new ApiError(400, 'LinkedIn could not process the uploaded video')
    }
    await sleep(attempt < 5 ? 2000 : 5000)
  }

  return videoUrn
}

async function publishLinkedIn(post, account, token) {
  const memberId = account.platformUserId
  if (!memberId) throw new ApiError(400, 'LinkedIn member id is missing. Reconnect LinkedIn.')
  const owner = `urn:li:person:${memberId}`
  const commentary = fullCaption(post) || post.title || ''

  let mediaUrn = ''
  if (post.mediaType !== 'none') {
    const { buffer, mimeType } = await readMediaBytes(post)
    mediaUrn =
      post.mediaType === 'video'
        ? await uploadLinkedInVideo(buffer, token, owner, mimeType)
        : await uploadLinkedInImage(buffer, token, owner)
  }

  const payload = {
    author: owner,
    commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }
  if (mediaUrn) payload.content = { media: { id: mediaUrn } }

  const created = await linkedinJson(`${LINKEDIN_API}/rest/posts`, {
    method: 'POST',
    token,
    body: payload,
  })

  const postUrn =
    created.headers.get('x-restli-id') ||
    created.headers.get('x-linkedin-id') ||
    (created.data && created.data.id) ||
    ''

  return {
    externalId: String(postUrn || ''),
    externalUrl: postUrn
      ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}`
      : 'https://www.linkedin.com/feed/',
  }
}

/* ------------------------------------------------------------------ */
/* YouTube                                                             */
/* ------------------------------------------------------------------ */

async function publishYouTube(post, account, token) {
  if (post.mediaType !== 'video') {
    throw new ApiError(400, 'YouTube requires a video file (MP4, MOV or WEBM).')
  }

  const { buffer, mimeType } = await readMediaBytes(post)
  const title = String(post.title || post.caption || 'New video').slice(0, 100)
  const description = fullCaption(post).slice(0, 5000)
  const tags = String(post.hashtags || '')
    .split(/\s+/)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 15)

  const init = await fetch(YOUTUBE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': mimeType || 'video/mp4',
      'X-Upload-Content-Length': String(buffer.length),
    },
    body: JSON.stringify({
      snippet: {
        title: title || 'New video',
        description,
        tags,
        categoryId: '22',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    }),
  })

  const initData = await parseResponse(init)
  if (!init.ok) throw failMessage('YouTube', init.status, initData.data, 'YouTube upload start failed')

  const uploadUrl = init.headers.get('location')
  if (!uploadUrl) throw new ApiError(502, 'YouTube did not return a resumable upload URL')

  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType || 'video/mp4',
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  })

  const uploaded = await parseResponse(upload)
  if (!upload.ok || !uploaded.data?.id) {
    throw failMessage('YouTube', upload.status, uploaded.data, 'YouTube upload failed')
  }

  return {
    externalId: String(uploaded.data.id),
    externalUrl: `https://youtu.be/${uploaded.data.id}`,
  }
}

/* ------------------------------------------------------------------ */
/* Google Business Profile                                             */
/* ------------------------------------------------------------------ */

async function discoverGoogleBusiness(account, token) {
  if (account.meta?.gbpAccount && account.meta?.gbpLocation) {
    return { accountName: account.meta.gbpAccount, locationName: account.meta.gbpLocation }
  }

  const accountsResponse = await fetch(GBP_ACCOUNTS_URL, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const accountsData = await parseResponse(accountsResponse)
  if (!accountsResponse.ok) {
    throw failMessage('Google Business', accountsResponse.status, accountsData.data, 'Could not list accounts')
  }

  const accountName = accountsData.data?.accounts?.[0]?.name
  if (!accountName) {
    throw new ApiError(400, 'No Google Business Profile account found for this Google login.')
  }

  const locationsResponse = await fetch(
    `${GBP_LOCATIONS_URL}/${accountName}/locations?readMask=name,title&pageSize=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const locationsData = await parseResponse(locationsResponse)
  if (!locationsResponse.ok) {
    throw failMessage(
      'Google Business',
      locationsResponse.status,
      locationsData.data,
      'Could not list business locations'
    )
  }

  const location = locationsData.data?.locations?.[0]?.name
  if (!location) {
    throw new ApiError(400, 'No Google Business Profile location found for this account.')
  }

  account.meta = { ...(account.meta || {}), gbpAccount: accountName, gbpLocation: location }
  account.markModified('meta')
  await account.save()

  return { accountName, locationName: location }
}

async function publishGoogleBusiness(post, account, token) {
  const { accountName, locationName } = await discoverGoogleBusiness(account, token)
  const resource = locationName.startsWith('accounts/')
    ? locationName
    : `${accountName}/${locationName}`

  const payload = {
    languageCode: 'en',
    summary: (fullCaption(post) || post.title || '').slice(0, 1500),
  }

  if (post.mediaType === 'image' && post.mediaUrl) {
    payload.media = [{ mediaFormat: 'PHOTO', sourceUrl: post.mediaUrl }]
  }

  const response = await fetch(`${GBP_POSTS_URL}/${resource}/localPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const { data } = await parseResponse(response)
  if (!response.ok) {
    throw failMessage('Google Business', response.status, data, 'Google Business post failed')
  }

  return {
    externalId: String(data?.name || ''),
    externalUrl: data?.searchUrl || 'https://business.google.com/',
  }
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

async function publishToPlatform(post, account) {
  const token = await ensureAccessToken(account)

  switch (post.platform) {
    case 'facebook':
      return publishFacebook(post, account, token)
    case 'instagram':
      return publishInstagram(post, account, token)
    case 'linkedin':
      return publishLinkedIn(post, account, token)
    case 'youtube':
      return publishYouTube(post, account, token)
    case 'google-business':
      return publishGoogleBusiness(post, account, token)
    default:
      throw new ApiError(400, `Unsupported platform: ${post.platform}`)
  }
}

async function syncCreativeStatus(post) {
  if (!post.creativeId) return
  try {
    const plan = await SocialPlan.findOne({ userId: post.userId })
    if (!plan) return
    const item = plan.items.find((entry) => entry.id === post.creativeId)
    if (!item) return
    item.status = 'Scheduled'
    item.note = post.status === 'posted' ? 'Published to platform' : 'Scheduled for auto-publish'
    await plan.save()
  } catch {
    // Creative sync is cosmetic; never fail a real publish because of it.
  }
}

async function runPublish(post) {
  try {
    const account = await loadAccount(post.userId, post.accountId, post.platform)
    if (['facebook', 'instagram', 'google-business'].includes(post.platform)) {
      await ensurePublicMedia(post)
    }
    const result = await publishToPlatform(post, account)

    post.status = 'posted'
    post.postedAt = new Date()
    post.lockedAt = null
    post.error = ''
    post.externalId = result.externalId || ''
    post.externalUrl = result.externalUrl || ''
    await post.save()

    await syncCreativeStatus(post)
    return post
  } catch (error) {
    post.status = 'failed'
    post.lockedAt = null
    post.error = error.message || 'Publishing failed'
    await post.save().catch(() => {})
    throw error
  }
}

/**
 * Atomically claims a draft / scheduled / failed post and publishes it now.
 */
async function executePost(postId) {
  const post = await SocialPost.findOneAndUpdate(
    { _id: postId, status: { $in: ['draft', 'scheduled', 'failed'] } },
    { $set: { status: 'publishing', lockedAt: new Date(), error: '' }, $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  )

  if (!post) {
    throw new ApiError(409, 'This post is already publishing, posted or cancelled.')
  }

  return runPublish(post)
}

async function processDuePosts(limit = 5) {
  const claimed = []

  for (let index = 0; index < limit; index += 1) {
    const post = await SocialPost.findOneAndUpdate(
      {
        status: 'scheduled',
        scheduledAt: { $lte: new Date() },
      },
      {
        $set: { status: 'publishing', lockedAt: new Date(), error: '' },
        $inc: { attempts: 1 },
      },
      { returnDocument: 'after', sort: { scheduledAt: 1 } }
    )

    if (!post) break
    claimed.push(post)
  }

  for (const post of claimed) {
    try {
      await runPublish(post)
      console.log(`[social-scheduler] Published ${post.platform} post ${post._id}`)
    } catch (error) {
      console.error(
        `[social-scheduler] Failed ${post.platform} post ${post._id}:`,
        error.message
      )
    }
  }

  return claimed.length
}

module.exports = {
  publishToPlatform,
  executePost,
  processDuePosts,
  fullCaption,
  isPublicHttpUrl,
}
