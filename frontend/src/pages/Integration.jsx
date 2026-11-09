import { useApp } from '../context/AppContext'
import PageHead from '../components/ui/PageHead'
import { copyText } from '../utils/helpers'
import { APP_BASE_URL } from '../config'

export default function Integration() {
  const { user, sm, showToast, openAccounts, accChecked, accHandles, smPlatforms } = useApp()
  const installCode = `<script src="${APP_BASE_URL}/widget.js" data-bot-id="${(user && user.id) || ''}" async></script>`

  const connected = smPlatforms
    .filter((p) => accChecked.includes(p.id))
    .map((p) => `${p.name} ${accHandles[p.id] ? accHandles[p.id] : ''}`.trim())
    .join(' · ')

  return (
    <section className="page active">
      <PageHead title="Integration" sub="Install your AI chatbot on any website with one code snippet." />
      <div className="card" style={{ maxWidth: 900 }}>
        <div className="field">
          <label>Website URL</label>
          <input id="siteUrl" className="input" defaultValue={(sm.biz && sm.biz.site) || ''} placeholder="https://www.yourbusiness.com" />
        </div>
        <div className="line"><span>Chatbot Status</span><span className="badge active">● Ready to Install</span></div>
        <h3 style={{ marginTop: 22 }}>Installation Code</h3>
        <div className="linkbox" id="installCode">{installCode}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => { copyText(installCode); showToast('Installation code copied') }}>Copy Code</button>
          <button className="btn" onClick={() => window.open(`/widget/${(user && user.id) || ''}`, '_blank', 'noopener,noreferrer')}>Test Chatbot</button>
        </div>
        <div className="sub" style={{ marginTop: 16 }}>
          Works with HTML, PHP, Laravel, React, Next.js, Vue, Angular, WordPress, Shopify and other websites that allow JavaScript.
        </div>
      </div>
      <div className="card" style={{ maxWidth: 900, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div><h3 style={{ margin: 0 }}>Connect Social Media Accounts</h3><div className="sub">Connect the social profiles we publish to on your behalf.</div></div>
          <button className="btn primary" onClick={openAccounts}>Manage Social Accounts</button>
        </div>
        <div id="accSummary" className="sub" style={{ marginTop: 10 }}>
          <b>Connected:</b> {connected || 'none yet — click Manage Social Accounts to connect.'}
        </div>
      </div>
    </section>
  )
}