
const jwt = require('jsonwebtoken')
const SocialAccount = require('../models/SocialAccount')
const { autoScheduleIfEnabled } = require('../services/social/schedule')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')

const getConfig = () => {
  const {
    META_APP_ID,
    META_APP_SECRET,
    META_FACEBOOK_CONFIG_ID,
    META_FACEBOOK_REDIRECT_URI,
    GRAPH_API_VERSION,
    JWT_SECRET,
    CLIENT_URL,
  } = process.env

  if (
    !META_APP_ID ||
    !META_APP_SECRET ||
    !META_FACEBOOK_CONFIG_ID ||
    !META_FACEBOOK_REDIRECT_URI ||
    !GRAPH_API_VERSION ||
    !JWT_SECRET
  ) {
    throw new ApiError(
      500,
      'Facebook integration configuration is incomplete'
    )
  }

  return {
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    configId: META_FACEBOOK_CONFIG_ID,
    redirectUri: META_FACEBOOK_REDIRECT_URI,
    graphVersion: GRAPH_API_VERSION,
    jwtSecret: JWT_SECRET,
    clientUrl: CLIENT_URL || 'http://localhost:5173',
  }
}

// Facebook Page tokens inherit the lifetime of the user token they were
// created from. Exchange the short lived code token for a long lived one
// (about 60 days) so scheduled posts keep working.
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
      'Facebook long lived token exchange failed:',
      JSON.stringify(data.error || data)
    )
  } catch (error) {
    console.warn('Facebook long lived token exchange error:', error.message)
  }

  return shortLivedToken
}

const connectFacebook = asyncHandler(async (req, res) => {
  const config = getConfig()

  const state = jwt.sign(
    {
      userId: req.user._id.toString(),
      purpose: 'facebook-connect',
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

  const loginUrl =
    `https://www.facebook.com/${config.graphVersion}/dialog/oauth?${params.toString()}`

  return res.status(200).json({
    status: 'success',
    data: { loginUrl },
    message: 'Facebook authorization URL created',
  })
})

const facebookCallback = asyncHandler(async (req, res) => {
  const config = getConfig()
  const { code, state, error, error_description } = req.query

  if (error) {
    return res.status(400).send(
      `Facebook authorization failed: ${String(
        error_description || error
      )}`
    )
  }

  if (!code || !state) {
    throw new ApiError(
      400,
      'Facebook authorization code or state is missing'
    )
  }

  let stateData

  try {
    stateData = jwt.verify(state, config.jwtSecret)
  } catch {
    throw new ApiError(
      400,
      'Invalid or expired Facebook authorization state'
    )
  }

  if (
    stateData.purpose !== 'facebook-connect' ||
    !stateData.userId
  ) {
    throw new ApiError(400, 'Invalid Facebook authorization state')
  }

  // 1. Exchange authorization code for an access token
  const tokenParams = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code: String(code),
  })

  const tokenResponse = await fetch(
    `https://graph.facebook.com/${config.graphVersion}/oauth/access_token?${tokenParams.toString()}`
  )

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error(
      'Facebook token exchange failed:',
      JSON.stringify(tokenData.error || tokenData)
    )

    throw new ApiError(400, 'Facebook token exchange failed')
  }

  const userAccessToken = await exchangeForLongLivedToken(tokenData.access_token, config)

  // 2. Check permissions actually granted to this app
  const permissionsUrl = new URL(
    `https://graph.facebook.com/${config.graphVersion}/me/permissions`
  )

  permissionsUrl.searchParams.set('access_token', userAccessToken)

  const permissionsResponse = await fetch(permissionsUrl)
  const permissionsData = await permissionsResponse.json()

  if (!permissionsResponse.ok) {
    console.error(
      'Facebook permission check failed:',
      JSON.stringify(permissionsData.error || permissionsData)
    )

    throw new ApiError(
      400,
      'Could not verify Facebook permissions. Check backend logs.'
    )
  }

  const grantedPermissions = (permissionsData.data || [])
    .filter((item) => item.status === 'granted')
    .map((item) => item.permission)

  console.log(
    'Facebook granted permissions:',
    grantedPermissions
  )

  if (!grantedPermissions.includes('pages_show_list')) {
    console.error(
      'Required permission pages_show_list was not granted.'
    )

    throw new ApiError(
      400,
      'Facebook pages_show_list permission is not granted. Reconnect Facebook and allow Page access.'
    )
  }

  // 3. Fetch Facebook Pages managed by this user
  const pagesUrl = new URL(
    `https://graph.facebook.com/${config.graphVersion}/me/accounts`
  )

  pagesUrl.searchParams.set(
    'fields',
    'id,name,access_token,tasks'
  )
  pagesUrl.searchParams.set('access_token', userAccessToken)

  const pagesResponse = await fetch(pagesUrl)
  const pagesData = await pagesResponse.json()

  if (!pagesResponse.ok) {
    console.error(
      'Facebook Page lookup failed:',
      JSON.stringify(pagesData.error || pagesData)
    )

    throw new ApiError(
      400,
      'Facebook Page lookup failed. Check backend logs for the API error.'
    )
  }

  if (!Array.isArray(pagesData.data)) {
    console.error(
      'Unexpected Facebook Pages response:',
      JSON.stringify(pagesData)
    )

    throw new ApiError(
      400,
      'Facebook returned an unexpected Pages response.'
    )
  }

  console.log(
    'Facebook Pages found:',
    pagesData.data.map((page) => ({
      id: page.id,
      name: page.name,
      tasks: page.tasks || [],
      hasPageAccessToken: Boolean(page.access_token),
    }))
  )

  if (pagesData.data.length === 0) {
    throw new ApiError(
      400,
      'No Facebook Pages returned. Check granted permissions and Page access in the backend logs.'
    )
  }

  // 4. Save every returned Page that has an ID and Page access token
  let savedCount = 0

  for (const page of pagesData.data) {
    if (!page.id || !page.access_token) {
      console.warn(
        'Skipping Facebook Page because ID or Page access token is missing:',
        page.name || 'Unknown Page'
      )
      continue
    }

    await SocialAccount.findOneAndUpdate(
      {
        userId: stateData.userId,
        platform: 'facebook',
        platformUserId: String(page.id),
      },
      {
        $set: {
          username: page.name || null,
          accessToken: page.access_token,
          tokenExpiresAt: null,
          connected: true,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    )

    savedCount += 1
  }

  if (savedCount === 0) {
    throw new ApiError(
      400,
      'Facebook returned Pages, but none had a usable Page access token.'
    )
  }

  console.log(
    `Facebook connection successful. Saved ${savedCount} Page(s).`
  )

  await autoScheduleIfEnabled(stateData.userId)

  // 5. Redirect to the Social Manager
  return res.redirect(
    `${config.clientUrl.replace(/\/$/, '')}/social?facebook=authorized`
  )
})

module.exports = {
  connectFacebook,
  facebookCallback,
}
