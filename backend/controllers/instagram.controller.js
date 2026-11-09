
const jwt = require('jsonwebtoken')
const SocialAccount = require('../models/SocialAccount')
const { autoScheduleIfEnabled } = require('../services/social/schedule')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')

const getConfig = () => {
  const {
    META_APP_ID,
    META_APP_SECRET,
    META_INSTAGRAM_CONFIG_ID,
    META_INSTAGRAM_REDIRECT_URI,
    GRAPH_API_VERSION,
    CLIENT_URL,
    JWT_SECRET,
  } = process.env

  if (
    !META_APP_ID ||
    !META_APP_SECRET ||
    !META_INSTAGRAM_CONFIG_ID ||
    !META_INSTAGRAM_REDIRECT_URI ||
    !GRAPH_API_VERSION ||
    !JWT_SECRET
  ) {
    throw new ApiError(500, 'Meta Instagram configuration is incomplete')
  }

  return {
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    configId: META_INSTAGRAM_CONFIG_ID,
    redirectUri: META_INSTAGRAM_REDIRECT_URI,
    graphVersion: GRAPH_API_VERSION,
    clientUrl: CLIENT_URL || 'http://localhost:5173',
    jwtSecret: JWT_SECRET,
  }
}

const graphGet = async (url) => {
  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok || data.error) {
    console.error('Instagram Graph API error:', data.error?.message || 'Unknown error')
    throw new ApiError(400, 'Unable to retrieve Instagram account details from Meta')
  }

  return data
}

// Page tokens born from a short lived code token expire quickly. Exchange the
// token for a long lived one before reading the Pages so scheduled Instagram
// publishing keeps working after the first hour.
const exchangeForLongLivedToken = async (shortLivedToken, config) => {
  try {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.appId,
      client_secret: config.appSecret,
      fb_exchange_token: shortLivedToken,
    })

    const response = await fetch(
      `https://graph.facebook.com/${config.graphVersion}/oauth/access_token?${params.toString()}`
    )
    const data = await response.json().catch(() => ({}))

    if (response.ok && data.access_token) {
      return data.access_token
    }

    console.warn(
      'Instagram long lived token exchange failed:',
      JSON.stringify(data.error || data)
    )
  } catch (error) {
    console.warn('Instagram long lived token exchange error:', error.message)
  }

  return shortLivedToken
}

const connectInstagram = asyncHandler(async (req, res) => {
  const config = getConfig()

  const state = jwt.sign(
    {
      userId: req.user._id.toString(),
      purpose: 'instagram-connect',
    },
    config.jwtSecret,
    { expiresIn: '10m' }
  )

  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    config_id: config.configId,
    state,
  })

  res.json(
    ApiResponse(
      200,
      {
        loginUrl: `https://www.facebook.com/${config.graphVersion}/dialog/oauth?${params}`,
      },
      'Instagram authorization URL created'
    )
  )
})

const instagramCallback = asyncHandler(async (req, res) => {
  const config = getConfig()
  const { code, state, error, error_description } = req.query

  if (error) {
    return res.status(400).send(
      `Instagram authorization failed: ${String(error_description || error)}`
    )
  }

  if (!code || !state) {
    throw new ApiError(400, 'Authorization code or state is missing')
  }

  let stateData

  try {
    stateData = jwt.verify(state, config.jwtSecret)
  } catch {
    throw new ApiError(400, 'Invalid or expired Instagram authorization state')
  }

  if (
    stateData.purpose !== 'instagram-connect' ||
    !stateData.userId
  ) {
    throw new ApiError(400, 'Invalid Instagram authorization state')
  }

  // Exchange the OAuth code for a user access token.
  const tokenParams = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code: String(code),
  })

  const tokenData = await graphGet(
    `https://graph.facebook.com/${config.graphVersion}/oauth/access_token?${tokenParams}`
  )

  if (!tokenData.access_token) {
    throw new ApiError(400, 'Meta did not return an access token')
  }

  // Page access tokens are long lived only when they are derived from a long
  // lived user token, so exchange the short lived code token first.
  const userAccessToken = await exchangeForLongLivedToken(tokenData.access_token, config)

  // Retrieve Pages and linked Instagram Professional accounts.
  const pagesUrl = new URL(
    `https://graph.facebook.com/${config.graphVersion}/me/accounts`
  )

  pagesUrl.searchParams.set(
    'fields',
    'id,name,access_token,instagram_business_account{id,username}'
  )
  pagesUrl.searchParams.set('limit', '100')
  pagesUrl.searchParams.set('access_token', userAccessToken)

  const pagesData = await graphGet(pagesUrl.toString())

  const linkedAccounts = (pagesData.data || [])
    .filter((page) => page.instagram_business_account?.id)
    .map((page) => ({
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      instagramId: page.instagram_business_account.id,
      username: page.instagram_business_account.username || page.name,
    }))

  if (linkedAccounts.length === 0) {
    throw new ApiError(
      400,
      'No linked Instagram Professional account found. Check Page access, Instagram linking, and Meta permissions.'
    )
  }

  // Save the discovered Instagram accounts.
  // Never store a connection without a real Instagram account ID.
  for (const account of linkedAccounts) {
    await SocialAccount.findOneAndUpdate(
      {
        userId: stateData.userId,
        platform: 'instagram',
        platformUserId: account.instagramId,
      },
      {
        $set: {
          username: account.username,
          accessToken: account.pageAccessToken,
          tokenExpiresAt: tokenData.expires_in
            ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
            : null,
          connected: true,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    )
  }

  await autoScheduleIfEnabled(stateData.userId)

  return res.redirect(
    `${config.clientUrl.replace(/\/$/, '')}/social?instagram=authorized`
  )
})

module.exports = {
  connectInstagram,
  instagramCallback,
}
