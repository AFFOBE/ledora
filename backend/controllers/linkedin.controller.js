
const jwt = require('jsonwebtoken')
const SocialAccount = require('../models/SocialAccount')
const { autoScheduleIfEnabled } = require('../services/social/schedule')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')

const getConfig = () => {
  const {
    LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET,
    LINKEDIN_REDIRECT_URI,
    LINKEDIN_SCOPES,
    JWT_SECRET,
    CLIENT_URL,
  } = process.env

  if (
    !LINKEDIN_CLIENT_ID ||
    !LINKEDIN_CLIENT_SECRET ||
    !LINKEDIN_REDIRECT_URI ||
    !JWT_SECRET
  ) {
    throw new ApiError(500, 'LinkedIn integration configuration is incomplete')
  }

  return {
    clientId: LINKEDIN_CLIENT_ID,
    clientSecret: LINKEDIN_CLIENT_SECRET,
    redirectUri: LINKEDIN_REDIRECT_URI,
    scopes: (LINKEDIN_SCOPES || 'openid profile w_member_social')
      .trim()
      .split(/\s+/),
    jwtSecret: JWT_SECRET,
    clientUrl: CLIENT_URL || 'http://localhost:5173',
  }
}

const connectLinkedIn = asyncHandler(async (req, res) => {
  const config = getConfig()

  const state = jwt.sign(
    {
      userId: req.user._id.toString(),
      purpose: 'linkedin-connect',
    },
    config.jwtSecret,
    { expiresIn: '10m' }
  )

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: config.scopes.join(' '),
  })

  const loginUrl =
    `https://www.linkedin.com/oauth/v2/authorization?${params}`

  res.json({
    status: 'success',
    data: { loginUrl },
    message: 'LinkedIn authorization URL created',
  })
})

const linkedinCallback = asyncHandler(async (req, res) => {
  const config = getConfig()
  const { code, state, error, error_description } = req.query

  const failureUrl =
    `${config.clientUrl.replace(/\/$/, '')}/social?linkedin=error`

  if (error) {
    console.error('LinkedIn authorization failed:', String(error))
    return res.redirect(failureUrl)
  }

  if (!code || !state) {
    throw new ApiError(400, 'LinkedIn authorization code or state is missing')
  }

  let stateData

  try {
    stateData = jwt.verify(String(state), config.jwtSecret)
  } catch {
    throw new ApiError(400, 'Invalid or expired LinkedIn authorization state')
  }

  if (
    stateData.purpose !== 'linkedin-connect' ||
    !stateData.userId
  ) {
    throw new ApiError(400, 'Invalid LinkedIn authorization state')
  }

  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(code),
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  })

  const tokenResponse = await fetch(
    'https://www.linkedin.com/oauth/v2/accessToken',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    }
  )

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error(
      'LinkedIn token exchange failed:',
      tokenData.error || 'Unknown error'
    )
    throw new ApiError(400, 'LinkedIn token exchange failed')
  }

  // Get the authorized member's profile.
  const profileResponse = await fetch(
    'https://api.linkedin.com/v2/userinfo',
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    }
  )

  const profileData = await profileResponse.json()

  if (!profileResponse.ok || !profileData.sub) {
    console.error(
      'LinkedIn profile lookup failed:',
      profileData.error || 'Unknown error'
    )
    throw new ApiError(400, 'Could not retrieve LinkedIn profile')
  }

  const platformUserId = String(profileData.sub)
  const username =
    profileData.name ||
    profileData.email ||
    `LinkedIn member ${platformUserId}`

  const updateData = {
    $set: {
      username,
      accessToken: tokenData.access_token,
      tokenExpiresAt: tokenData.expires_in
        ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
        : null,
      connected: true,
    },
  }

  if (tokenData.refresh_token) {
    updateData.$set.refreshToken = tokenData.refresh_token
  }

  await SocialAccount.findOneAndUpdate(
    {
      userId: stateData.userId,
      platform: 'linkedin',
      platformUserId,
    },
    updateData,
    { upsert: true, new: true, runValidators: true }
  )

  await autoScheduleIfEnabled(stateData.userId)

  return res.redirect(
    `${config.clientUrl.replace(/\/$/, '')}/social?linkedin=authorized`
  )
})

module.exports = {
  connectLinkedIn,
  linkedinCallback,
}
