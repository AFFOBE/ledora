import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { api } from '../api/client'
import PageHead from '../components/ui/PageHead'
import { DEFAULT_NOTIFY_PHONE } from '../data/mock'

const daysUntil = (isoStr) => Math.ceil((new Date(isoStr + 'T23:59:59').getTime() - new Date().getTime()) / 86400000)
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')

export default function Subscription() {
  const { subscriptions, notifications, toggleAutoRenew, sm, showToast, refreshBilling } = useApp()
  const phone = (sm.biz && sm.biz.phone) || DEFAULT_NOTIFY_PHONE

  const [plans, setPlans] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    api('/subscription/plans')
      .then((data) => { if (live) setPlans(data || []) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  const withDays = subscriptions.map((s) => ({ ...s, days: s.validRaw ? daysUntil(s.validRaw) : null }))
  const expiring = withDays.filter((s) => s.days !== null && s.days >= 0 && s.days <= 5)
  const chatbotSub = withDays.find((s) => s.id === 'chatbot')
  const chatbotPlan = plans[0]

  const base = chatbotPlan ? chatbotPlan.price : 0
  const gst = Math.round(base * 0.18)
  const total = base + gst

  const activateChatbot = async () => {
    if (!chatbotPlan || busy) return
    setBusy(true)
    try {
      await api('/subscription/create', {
        method: 'POST',
        body: { plan: chatbotPlan.id },
      })
      await refreshBilling()
      showToast(chatbotSub ? 'Chatbot plan renewed' : 'Chatbot plan activated')
    } catch (e) {
      showToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page active">
      <PageHead title="Subscription" sub="All your active plans in one place." />

      {expiring.map((s) => (
        <div className="alert-warn" key={s.id}>
          <span className="ai">⚠</span>
          <div className="grow">
            <b>{s.name} plan is expiring soon</b>
            <div className="sub">Only {s.days} day{s.days === 1 ? '' : 's'} left (valid till {s.validTill}). An expiry reminder has been added for your number {phone}.</div>
          </div>
        </div>
      ))}

      {chatbotPlan && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(109,51,231,0.5)', background: 'rgba(109,51,231,0.10)' }}>
          <div className="pubshead">
            <div>
              <h3 style={{ margin: 0 }}>{chatbotPlan.name}</h3>
              <div className="sub" style={{ marginTop: 4 }}>AI chatbot for your website — leads, bookings and replies 24/7.</div>
            </div>
            <span className={`badge ${chatbotSub ? 'active' : 'blue'}`}>{chatbotSub ? 'Active' : 'Not active'}</span>
          </div>

          {chatbotSub && (
            <div className="sub" style={{ marginBottom: 6 }}>
              Current plan is valid till <b>{chatbotSub.validTill}</b>. Activating again adds another 12 months.
            </div>
          )}

          <div className="kv"><span>Chatbot plan · 1 year</span><b>{money(base)}</b></div>
          <div className="kv"><span>GST (18%)</span><b>{money(gst)}</b></div>
          <div className="kv" style={{ borderBottom: 0, paddingTop: 12 }}>
            <span style={{ fontWeight: 700, color: '#fff' }}>Total payable</span>
            <b style={{ fontSize: 20, color: '#9d7bff' }}>{money(total)}</b>
          </div>

          <button className="btn primary" style={{ width: '100%', padding: 13, marginTop: 14, fontSize: 14 }} onClick={activateChatbot} disabled={busy}>
            {busy ? 'Processing…' : `${chatbotSub ? 'Renew' : 'Activate'} for ${money(total)}`}
          </button>
          <div className="sub" style={{ textAlign: 'center', marginTop: 10 }}>
            Your chatbot plan stays active for 12 months from activation.
          </div>
        </div>
      )}

      {!withDays.length && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>No active plan yet</h3>
          <div className="sub">Choose a chatbot or social media plan to see your billing details here.</div>
        </div>
      )}

      <div className="subgrid">
        {withDays.map((s) => (
          <div className="card subcard" key={s.id}>
            <div className="sub-top">
              <div className="sub-ic">{s.icon}</div>
              <div className="grow">
                <b>{s.name}</b>
                <div className="sub">{s.plan}</div>
              </div>
              <span className={`badge ${s.days === null ? 'blue' : s.days < 0 ? 'off' : s.days <= 5 ? 'demo' : 'active'}`}>
                {s.days === null ? 'Active' : s.days < 0 ? 'Expired' : `${s.days} days left`}
              </span>
            </div>
            <div className="num">{money(s.price)} <span style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>/ {s.billing}</span></div>
            <div className="line"><span>Status</span><span className={`badge ${s.days !== null && s.days < 0 ? 'off' : 'active'}`}>{s.days !== null && s.days < 0 ? 'Expired' : 'Active'}</span></div>
            <div className="line"><span>Started</span><b>{s.started}</b></div>
            <div className="line"><span>Valid Till</span><b>{s.validTill}</b></div>
            <div className="sub-foot">
              <button
                className={`btn ${s.autoRenew ? 'primary' : ''}`}
                onClick={() => toggleAutoRenew(s.id)}
              >
                {s.autoRenew ? '✓ Auto Renew On' : 'Auto Renew'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {notifications.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Reminder History</h3>
          {notifications.map((n) => (
            <div className="kv" key={n.id}><span>{n.sub} · to {n.phone}</span><b>{n.at}</b></div>
          ))}
        </div>
      )}
    </section>
  )
}
