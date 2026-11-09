import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function Topbar() {
  const { sm, user, logout } = useApp()
  const name = (sm.biz && sm.biz.name) || (user && user.name) || 'Your Business'
  const site = (sm.biz && sm.biz.site) || (user && user.email) || ''

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('ledora_theme') || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('ledora_theme', theme) } catch { /* ignore */ }
  }, [theme])

  const isDark = theme === 'dark'

  return (
    <header className="topbar">
      <div>
        <b>{name}</b>
        <div className="sub">{site}</div>
      </div>
      <div className="topbar-right">
        <span className="badge active">● Website Active</span>
        <button type="button" className="btn logout-btn" onClick={logout} title="Sign out">Sign out</button>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDark ? 'Light theme' : 'Dark theme'}
        >
          {isDark ? (
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}
