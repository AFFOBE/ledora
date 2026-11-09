import { useState } from 'react'
import { useApp } from '../context/AppContext'
import PageHead from '../components/ui/PageHead'

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function Dashboard() {
  const { go, chatData, linkLeads, sm, subscriptions } = useApp()
  const allLeads = [...chatData, ...linkLeads]
  const totalLeads = allLeads.length

  const [today] = useState(() => new Date())
  const monthKey = iso(today).slice(0, 7)
  const monthLeads = allLeads.filter((l) => String(l.date || '').startsWith(monthKey)).length

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (13 - i))
    const key = iso(d)
    return { key, label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }
  })
  const counts = days.map((d) => allLeads.filter((l) => String(l.date || '').startsWith(d.key)).length)
  const maxCount = Math.max(...counts, 1)
  const bars = counts.map((c) => (c ? Math.max(8, Math.round((c / maxCount) * 100)) : 4))

  const primarySub = subscriptions[0]
  const planPrice = (primarySub && primarySub.price) || (sm.plan && sm.plan.price) || 0
  const planBilling = primarySub && primarySub.billing === 'month' ? 'Month' : 'Year'
  const renewal = (primarySub && primarySub.validTill) || '—'
  const subStatus = primarySub
    ? (primarySub.validRaw && new Date(`${primarySub.validRaw}T23:59:59`) < today ? 'Expired' : 'Active')
    : 'No plan'

  return (
    <section className="page active">
      <PageHead title="Dashboard" sub="Website, chatbot and lead overview.">
        <button className="btn primary" onClick={() => go('bot')}>Preview Chatbot</button>
      </PageHead>
      <div className="cards">
        <div className="card"><div className="label">Website</div><div className="num" style={{ fontSize: 20, color: '#4ade80' }}>● Active</div></div>
        <div className="card"><div className="label">Total Leads</div><div className="num">{totalLeads}</div><div className="green">{monthLeads} this month</div></div>
        <div className="card"><div className="label">Chatbot Leads</div><div className="num">{chatData.length}</div></div>
        <div className="card"><div className="label">Link Leads</div><div className="num">{linkLeads.length}</div></div>
      </div>
      <div className="grid">
        <div className="card">
          <h3>Leads — Last 14 Days</h3>
          <div style={{ height: 210, display: 'flex', alignItems: 'end', gap: 8 }}>
            {bars.map((h, i) => (
              <div key={i} title={`${days[i].label}: ${counts[i]} lead${counts[i] === 1 ? '' : 's'}`} style={{ flex: 1, height: `${h}%`, background: 'linear-gradient(180deg,#6D33E7,#384FE7)', borderRadius: '5px 5px 0 0' }} />
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Account</h3>
          <div className="line"><span>Plan</span><b>{planPrice ? `₹${planPrice.toLocaleString('en-IN')} / ${planBilling}` : 'Not active'}</b></div>
          <div className="line"><span>Status</span><span className={`badge ${primarySub ? 'active' : 'off'}`}>{subStatus}</span></div>
          <div className="line"><span>Renewal</span><b>{renewal}</b></div>
          <div className="line"><span>Chatbot</span><span className="badge active">Live</span></div>
          <div className="line"><span>Meeting Time</span><span className="badge blue">Set</span></div>
        </div>
      </div>
    </section>
  )
}