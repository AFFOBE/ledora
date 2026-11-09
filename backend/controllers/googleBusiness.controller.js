
const jwt = require('jsonwebtoken')
const SocialAccount = require('../models/SocialAccount')
const { autoScheduleIfEnabled } = require('../services/social/schedule')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')

const getConfig = () => {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_BUSINESS_REDIRECT_URI,
    CLIENT_URL,
    JWT_SECRET,
  } = process.env

  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !JWT_SECRET
  ) {
    throw new ApiError(
      500,
      'Google Business integration configuration is incomplete'
    )
  }

  // Fall back to the public backend URL when the dedicated env var is not set.
  const redirectUri =
    GOOGLE_BUSINESS_REDIRECT_URI ||
    `${(process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '')}/api/social/google-business/callback`

  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri,
    clientUrl: CLIENT_URL || 'http://localhost:5173',
    jwtSecret: JWT_SECRET,
  }
}

const connectGoogleBusiness = asyncHandler(async (req, res) => {
  const config = getConfig()

  const state = jwt.sign(
    {
      userId: req.user._id.toString(),
      purpose: 'google-business-connect',
    },
    config.jwtSecret,
    { expiresIn: '10m' }
  )

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  const loginUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return res.status(200).json(
    ApiResponse(
      200,
      { loginUrl },
      'Google Business authorization URL created'
    )
  )
})

const googleBusinessCallback = asyncHandler(async (req, res) => {
  const config = getConfig()
  const { code, state, error } = req.query

  if (error) {
    return res.redirect(
      `${config.clientUrl.replace(/\/$/, '')}/social?google-business=error`
    )
  }

  if (!code || !state) {
    throw new ApiError(400, 'Authorization code or state is missing')
  }

  let stateData

  try {
    stateData = jwt.verify(state, config.jwtSecret)
  } catch {
    throw new ApiError(400, 'Invalid or expired Google authorization state')
  }

  if (
    stateData.purpose !== 'google-business-connect' ||
    !stateData.userId
  ) {
    throw new ApiError(400, 'Invalid Google Business authorization state')
  }

  const tokenResponse = await fetch(
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: String(code),
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    }
  )

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error(
      'Google OAuth token exchange failed:',
      tokenData.error || 'Unknown error'
    )
    throw new ApiError(400, 'Google authorization token exchange failed')
  }

  // Fetch the authenticated Google account identity.
  const userInfoResponse = await fetch(
    'https://openidconnect.googleapis.com/v1/userinfo',
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    }
  )

  const userInfo = await userInfoResponse.json()

  if (!userInfoResponse.ok || !userInfo.sub) {
    console.error('Google user info lookup failed')
    throw new ApiError(400, 'Could not identify the connected Google account')
  }

  const accountData = {
    userId: stateData.userId,
    platform: 'google-business',
    platformUserId: userInfo.sub,
  }

  const updateData = {
    $set: {
      username: userInfo.email || null,
      accessToken: tokenData.access_token,
      tokenExpiresAt: tokenData.expires_in
        ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
        : null,
      connected: true,
    },
  }

  // Google may not return a new refresh token on every authorization.
  // Preserve the previously stored refresh token if no new one is returned.
  if (tokenData.refresh_token) {
    updateData.$set.refreshToken = tokenData.refresh_token
  }

  await SocialAccount.findOneAndUpdate(
    accountData,
    updateData,
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  )

  await autoScheduleIfEnabled(stateData.userId)

  return res.redirect(
    `${config.clientUrl.replace(/\/$/, '')}/social?google-business=authorized`
  )
})

module.exports = {
  connectGoogleBusiness,
  googleBusinessCallback,
}
