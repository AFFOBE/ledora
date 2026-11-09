
const jwt = require('jsonwebtoken')
const SocialAccount = require('../models/SocialAccount')
const { autoScheduleIfEnabled } = require('../services/social/schedule')

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels'

const getConfig = () => {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    JWT_SECRET,
    CLIENT_URL,
  } = process.env

  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REDIRECT_URI ||
    !JWT_SECRET
  ) {
    throw new Error('Google YouTube OAuth environment variables are missing')
  }

  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_REDIRECT_URI,
    jwtSecret: JWT_SECRET,
    clientUrl: CLIENT_URL || 'http://localhost:5173',
  }
}

// GET /api/social/youtube/connect
const connectYouTube = async (req, res) => {
  try {
    const config = getConfig()

    const state = jwt.sign(
      {
        userId: String(req.user._id || req.user.id),
        purpose: 'youtube-connect',
      },
      config.jwtSecret,
      { expiresIn: '10m' }
    )

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope:
        'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    return res.status(200).json({
      statusCode: 200,
      data: {
        loginUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
      },
      message: 'YouTube authorization URL created',
      success: true,
    })
  } catch (error) {
    console.error('YouTube connect error:', error.message)

    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to start YouTube connection',
    })
  }
}

// GET /api/social/youtube/callback
const youtubeCallback = async (req, res) => {
  let clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'

  try {
    const config = getConfig()
    clientUrl = config.clientUrl

    const { code, state, error: googleError } = req.query

    if (googleError || !code || !state) {
      return res.redirect(
        `${clientUrl}/social?youtube=error`
      )
    }

    let decodedState

    try {
      decodedState = jwt.verify(state, config.jwtSecret)
    } catch {
      return res.redirect(
        `${clientUrl}/social?youtube=error`
      )
    }

    if (
      decodedState.purpose !== 'youtube-connect' ||
      !decodedState.userId
    ) {
      return res.redirect(
        `${clientUrl}/social?youtube=error`
      )
    }

    // Exchange authorization code for Google access token.
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
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
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('YouTube token exchange failed:', tokenData)

      return res.redirect(
        `${clientUrl}/social?youtube=error`
      )
    }

    // Get the authorized user's YouTube channel.
    const channelParams = new URLSearchParams({
      part: 'snippet',
      mine: 'true',
    })

    const channelResponse = await fetch(
      `${YOUTUBE_CHANNELS_URL}?${channelParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    )

    const channelData = await channelResponse.json()

    if (!channelResponse.ok) {
      console.error('YouTube channel lookup failed:', channelData)

      return res.redirect(
        `${clientUrl}/social?youtube=error`
      )
    }

    const channel = channelData.items?.[0]

    if (!channel) {
      console.error('No YouTube channel found for authorized account')

      return res.redirect(
        `${clientUrl}/social?youtube=error`
      )
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
      : null

    const updateData = {
      $set: {
        username: channel.snippet?.title || 'YouTube',
        accessToken: tokenData.access_token,
        tokenExpiresAt: expiresAt,
        connected: true,
      },
    }

    // Needed to refresh the access token before every scheduled upload.
    if (tokenData.refresh_token) {
      updateData.$set.refreshToken = tokenData.refresh_token
    }

    await SocialAccount.findOneAndUpdate(
      {
        userId: decodedState.userId,
        platform: 'youtube',
        platformUserId: String(channel.id),
      },
      updateData,
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    )

    await autoScheduleIfEnabled(decodedState.userId)

    return res.redirect(
      `${clientUrl}/social?youtube=authorized`
    )
  } catch (error) {
    console.error('YouTube callback error:', error.message)

    return res.redirect(
      `${clientUrl}/social?youtube=error`
    )
  }
}

module.exports = {
  connectYouTube,
  youtubeCallback,
}
