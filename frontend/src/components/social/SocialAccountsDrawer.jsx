
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useApp } from '../../context/AppContext'

const OAUTH_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'google-business',
]

export default function SocialAccountsDrawer() {
  const {
    accountsOpen,
    closeAccounts,
    smPlatforms,
    accChecked,
    accHandles,
    toggleAccount,
    setAccountHandle,
    saveAccounts,
    showToast,
  } = useApp()

  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState('')
  const [connectedAccounts, setConnectedAccounts] = useState([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  const loadConnectedAccounts = useCallback(async () => {
    setLoadingAccounts(true)

    try {
      const result = await api('/social/accounts')

      const accounts = Array.isArray(result)
        ? result
        : Array.isArray(result?.accounts)
          ? result.accounts
          : Array.isArray(result?.data)
            ? result.data
            : Array.isArray(result?.data?.accounts)
              ? result.data.accounts
              : []

      setConnectedAccounts(accounts)
    } catch (error) {
      showToast?.(
        error.message || 'Connected accounts load nahi hue',
        'error'
      )
    } finally {
      setLoadingAccounts(false)
    }
  }, [showToast])

  useEffect(() => {
    if (accountsOpen) {
      loadConnectedAccounts()
    }
  }, [accountsOpen, loadConnectedAccounts])

  // OAuth callback ke baad status refresh aur URL cleanup.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    const statuses = [
      ['youtube', 'YouTube'],
      ['linkedin', 'LinkedIn'],
      ['facebook', 'Facebook'],
      ['instagram', 'Instagram'],
      ['google-business', 'Google Business Profile'],
    ]

    const callback = statuses.find(([key]) =>
      ['authorized', 'error'].includes(params.get(key))
    )

    if (!callback) return

    const [key, platformName] = callback
    const status = params.get(key)

    if (status === 'authorized') {
      showToast?.(`${platformName} authorization successful!`)
      loadConnectedAccounts()
    } else {
      showToast?.(
        `${platformName} authorization fail hua. Configuration aur permissions check karo.`,
        'error'
      )
    }

    statuses.forEach(([param]) => params.delete(param))

    const query = params.toString()
    const newUrl =
      window.location.pathname +
      (query ? `?${query}` : '') +
      window.location.hash

    window.history.replaceState({}, '', newUrl)
  }, [loadConnectedAccounts, showToast])

  const connectPlatform = async (platform) => {
    if (connecting) return

    setConnecting(platform)

    try {
      const result = await api(`/social/${platform}/connect`)

      const loginUrl =
        result?.loginUrl ||
        result?.data?.loginUrl

      if (!loginUrl) {
        throw new Error(
          `${platform} login URL nahi mila. Backend response check karo.`
        )
      }

      window.location.assign(loginUrl)
    } catch (error) {
      showToast?.(
        error.message || `${platform} connect nahi hua`,
        'error'
      )
      setConnecting('')
    }
  }

  const isConnected = (platform) =>
    connectedAccounts.some(
      (account) =>
        String(account.platform).toLowerCase() === platform &&
        account.connected === true
    )

  const getConnectedAccount = (platform) =>
    connectedAccounts.find(
      (account) =>
        String(account.platform).toLowerCase() === platform &&
        account.connected === true
    )

  const getProviderName = (platform) => {
    const names = {
      linkedin: 'LinkedIn',
      facebook: 'Facebook',
      instagram: 'Instagram',
      youtube: 'YouTube',
      'google-business': 'Google Business Profile',
    }

    return names[platform] || platform
  }

  return (
    <>
      <div
        className={`overlay ${accountsOpen ? 'show' : ''}`}
        id="accOv"
        onClick={closeAccounts}
      />

      <div
        className={`drawer ${accountsOpen ? 'open' : ''}`}
        id="accDr"
      >
        <button
          type="button"
          className="btn"
          onClick={closeAccounts}
          aria-label="Close social accounts"
        >
          ✕
        </button>

        <h2>Connect Social Media Accounts</h2>

        <div className="sub" style={{ margin: '-6px 0 14px' }}>
          Select the platforms you want to manage. Connect through
          each platform to authorize your real account. Saving a
          checkbox alone does not connect it.
        </div>

        <div className="accgrid" id="accGrid">
          {smPlatforms.map((p) => {
            const platform = String(p.id).toLowerCase()
            const supported = OAUTH_PLATFORMS.includes(platform)
            const connected = isConnected(platform)
            const connectedAccount = getConnectedAccount(platform)
            const providerName = getProviderName(platform)

            return (
              <div
                key={p.id}
                className={`acc ${
                  accChecked.includes(p.id) ? 'on' : ''
                }`}
                id={`acc_${p.id}`}
              >
                <div className="acch">
                  <div
                    className="accic"
                    style={{ background: p.color }}
                  >
                    {p.icon}
                  </div>

                  <div className="accname">{p.name}</div>

                  <input
                    className="chk"
                    type="checkbox"
                    checked={accChecked.includes(p.id)}
                    onChange={(e) =>
                      toggleAccount(p.id, e.target.checked)
                    }
                    aria-label={`Select ${p.name}`}
                  />
                </div>

                <input
                  className="accin"
                  placeholder="@handle (optional)"
                  value={accHandles[p.id] || ''}
                  onFocus={() => toggleAccount(p.id, true)}
                  onChange={(e) =>
                    setAccountHandle(p.id, e.target.value)
                  }
                  aria-label={`${p.name} handle`}
                />

                {supported ? (
                  <div style={{ marginTop: 10 }}>
                    <div
                      role="status"
                      style={{ fontSize: 13, marginBottom: 8 }}
                    >
                      {loadingAccounts
                        ? 'Checking connection…'
                        : connected
                          ? `Connected${
                              connectedAccount?.username
                                ? `: ${connectedAccount.username}`
                                : ''
                            }`
                          : `Not connected to ${providerName}`}
                    </div>

                    <button
                      type="button"
                      className="btn primary"
                      disabled={
                        Boolean(connecting) || loadingAccounts
                      }
                      onClick={() => {
                        if (!accChecked.includes(p.id)) {
                          toggleAccount(p.id, true)
                        }

                        connectPlatform(platform)
                      }}
                    >
                      {connecting === platform
                        ? `Opening ${providerName}…`
                        : connected
                          ? `Reconnect ${p.name}`
                          : `Connect ${p.name}`}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, marginTop: 8 }}>
                    Handle selection only — OAuth connection is not
                    configured for this platform.
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={closeAccounts}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true)

              try {
                const ok = await saveAccounts()

                if (ok) closeAccounts()
              } catch (error) {
                showToast?.(
                  error.message || 'Accounts save nahi hue',
                  'error'
                )
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? 'Saving…' : 'Save Selection'}
          </button>
        </div>
      </div>
    </>
  )
}
