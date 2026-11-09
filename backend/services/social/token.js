const SocialAccount = require('../../models/SocialAccount')
const ApiError = require('../../utils/ApiError')

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const META_GRAPH = 'https://graph.facebook.com'

const getGraphVersion = () => process.env.GRAPH_API_VERSION || 'v26.0'

async function loadAccount(userId, accountId, platform) {
  const query = { userId, connected: true }
  if (accountId) query._id = accountId
  if (platform) query.platform = platform

  const account = await SocialAccount.findOne(query)
    .select('+accessToken +refreshToken')
    .sort({ createdAt: -1 })

  if (!account) {
    throw new ApiError(
      400,
      'No connected social account found for this platform. Connect the account first from Manage Social Accounts.'
    )
  }

  return account
}

async function refreshGoogleAccount(account) {
  if (!account.refreshToken) {
    throw new ApiError(
      400,
      `${account.platform} access token expired and no refresh token is stored. Reconnect the account from Manage Social Accounts.`
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new ApiError(500, 'Google OAuth client credentials are not configured')
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.access_token) {
    throw new ApiError(
      400,
      `Could not refresh ${account.platform} access token. Reconnect the account. ${
        (data.error_description || data.error) ? `(${data.error_description || data.error})` : ''
      }`.trim()
    )
  }

  account.accessToken = data.access_token
  if (data.expires_in) {
    account.tokenExpiresAt = new Date(Date.now() + Number(data.expires_in) * 1000)
  }
  if (data.refresh_token) account.refreshToken = data.refresh_token
  await account.save()

  return account.accessToken
}

/**
 * Returns a usable access token and refreshes Google tokens when they are
 * close to expiry. Meta Page tokens are long lived once the user token has
 * been exchanged for a long lived token during connect.
 */
async function ensureAccessToken(account) {
  const expiresAt = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : 0
  const expiringSoon = expiresAt > 0 && expiresAt < Date.now() + 90 * 1000

  if (expiringSoon && (account.platform === 'youtube' || account.platform === 'google-business')) {
    return refreshGoogleAccount(account)
  }

  if (!account.accessToken) {
    throw new ApiError(400, `${account.platform} account has no access token. Reconnect it.`)
  }

  return account.accessToken
}

const graphUrl = (pathname) => `${META_GRAPH}/${getGraphVersion()}${pathname}`

module.exports = {
  loadAccount,
  ensureAccessToken,
  refreshGoogleAccount,
  graphUrl,
  getGraphVersion,
}
