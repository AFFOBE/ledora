import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { smPlanPrice, smPlanPeriod, smPlanUnits } from '../../data/mock'
import { missingBizFields, RECOMMENDED_BIZ_FIELDS } from '../../utils/helpers'

export default function SMPayment() {
  const { sm, smSetStep, smSetResumeCheckout, smGenerateItems, accChecked, accHandles, smPlatforms, showToast, go } = useApp()
  const [payMethod, setPayMethod] = useState('upi')
  const [busy, setBusy] = useState(false)
  const plan = sm.plan
  const biz = sm.biz

  const missing = missingBizFields(biz)
  const incomplete = missing.length > 0
  const optionalMissing = RECOMMENDED_BIZ_FIELDS.filter((f) => !String((biz || {})[f.key] || '').trim())
  const optionalFilled = RECOMMENDED_BIZ_FIELDS.length - optionalMissing.length

  const goOnboard = () => {
    smSetResumeCheckout(true)
    go('onboard')
  }

  if (!plan) {
    return (
      <div className="card">
        <h3>No plan selected</h3>
        <div className="sub">Please choose a plan first.</div>
        <button className="btn primary" onClick={() => smSetStep('plans')} style={{ marginTop: 12 }}>Back to plans</button>
      </div>
    )
  }

  const billing = sm.billing || 'monthly'
  const base = smPlanPrice(plan, billing)
  const period = smPlanPeriod(billing)
  const units = smPlanUnits(plan, billing)
  const gst = Math.round(base * 0.18)
  const total = base + gst
  const fmt = (n) => '₹' + n.toLocaleString('en-IN')

  const isChecked = (id) => accChecked.includes(id)

  const buildAccounts = () => smPlatforms
    .filter((p) => isChecked(p.id))
    .map((p) => ({ platformId: p.id, name: p.name, icon: p.icon, color: p.color, handle: (accHandles[p.id] || '').trim() || '@' + p.name.toLowerCase().replace(/\W+/g, '') }))

  const start = async (requireAccounts) => {
    if (busy) return
    if (!plan) { showToast('Please choose a plan first'); return }
    if (incomplete) {
      goOnboard()
      showToast('Please complete your business details before payment')
      return
    }
    const accs = buildAccounts()
    if (requireAccounts && !accs.length) { go('integration'); showToast('Connect at least one social account'); return }
    setBusy(true)
    try {
      await smGenerateItems({ ...biz, accounts: accs.length ? accs : (biz.accounts || []) }, plan.id, { billing })
      smSetResumeCheckout(false)
    } catch (e) {
      showToast(e.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = () => start(false)

  const payNow = () => start(false)

  return (
    <>
      <div className="head">
        <div>
          <h1>Payment</h1>
          <div className="sub">Your plan is selected. Make the payment to activate social media management.</div>
        </div>
        <button className="backlink" onClick={() => smSetStep('plans')}>← Back to plans</button>
      </div>
      <div className="smsteps">
        <span className="smstep" style={{ cursor: 'pointer' }} onClick={() => smSetStep('plans')}>1. Choose Plan</span>
        <span style={{ color: 'rgba(255,255,255,.45)' }}>→</span>
        <span className="smstep on">2. Payment</span>
        <span style={{ color: 'rgba(255,255,255,.45)' }}>→</span>
        <span className="smstep">3. 30 Day Content</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }} id="chosenPlanBar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="label">SELECTED PLAN</div>
            <h3 style={{ margin: '6px 0 2px' }}>{plan.name} · ₹{base.toLocaleString('en-IN')} / {period}</h3>
            <div className="sub">
              {units.posts} posts + {units.reels} reels per 30-day batch · {billing === 'yearly' ? `${units.months} monthly batches (refreshed each month)` : '30 day calendar'} · {plan.feats.filter((f) => /platforms/.test(f))[0].replace(/Up to |All platforms supported/, '')} platforms
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge active">{units.posts} Posts / mo</span>
            <span className="badge demo">{units.reels} Reels / mo</span>
            <span className="badge blue">{units.days} Days</span>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 16,
          ...(incomplete ? { borderColor: 'rgba(245,158,11,0.55)', background: 'rgba(245,158,11,0.09)' } : {}),
        }}
        id="bizProfileBar"
      >
        {incomplete ? (
          <div>
            <div className="label">BUSINESS PROFILE · INCOMPLETE</div>
            <h3 style={{ margin: '6px 0 2px' }}>Add your business name to continue</h3>
            <div className="sub" style={{ marginTop: 4 }}>Missing: {missing.join(', ')}.</div>
            <div className="sub" style={{ marginTop: 6 }}>
              Only the business name is required. Category, contact and content details are optional — you can add them anytime. After saving you will come back here automatically.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={goOnboard}>Add Business Name →</button>
              <button className="btn" onClick={() => smSetStep('plans')}>Change Plan</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="label">BUSINESS PROFILE · READY</div>
              <h3 style={{ margin: '6px 0 2px' }}>{biz.name}{biz.cat ? ` · ${biz.cat}` : ''}</h3>
              <div className="sub">{biz.owner || 'Contact person not set'} · {biz.city || 'Location not set'} · {biz.email || 'Email not set'}</div>
              <div className="sub" style={{ marginTop: 6 }}>
                {optionalMissing.length
                  ? `${optionalFilled} of ${RECOMMENDED_BIZ_FIELDS.length} optional details filled — you can pay now and add the rest later.`
                  : 'All details are filled — your content will be fully personalised.'}
              </div>
            </div>
            <button className="btn" onClick={goOnboard}>View / Edit Details</button>
          </div>
        )}
      </div>

      <div className="card" style={{ borderColor: 'rgba(109,51,231,0.5)', background: 'rgba(109,51,231,0.10)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Payment</h3><span className="badge blue">Secure Checkout · Test Mode</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {['upi', 'card', 'netbanking', 'emi'].map((m) => (
            <button
              key={m}
              className="btn"
              style={{ borderColor: payMethod === m ? '#6D33E7' : 'rgba(255,255,255,0.18)', color: payMethod === m ? '#b9a1ff' : 'rgba(255,255,255,0.75)', fontWeight: 700 }}
              onClick={() => setPayMethod(m)}
            >
              {m === 'upi' ? '₹ UPI' : m === 'card' ? 'Card' : m === 'netbanking' ? 'Net Banking' : 'EMI'}
            </button>
          ))}
        </div>
        <div className="kv"><span>{plan.name} plan · 1 {period}</span><b>{fmt(base)}</b></div>
        <div className="kv"><span>GST (18%)</span><b>{fmt(gst)}</b></div>
        <div className="kv" style={{ borderBottom: 0, paddingTop: 14 }}><span style={{ fontWeight: 700, color: '#fff' }}>Total payable</span><b style={{ fontSize: 20, color: '#9d7bff' }}>{fmt(total)}</b></div>
        <button className="btn primary" style={{ width: '100%', padding: 13, marginTop: 14, fontSize: 14 }} onClick={payNow} disabled={busy}>
          {busy ? 'Starting your content engine…' : `Pay ${fmt(total)} & Start`}
        </button>
        <div className="sub" style={{ textAlign: 'center', marginTop: 10 }}>
          {incomplete
            ? '⚠️ Business name is required before payment — you will be taken to Business Onboard when you click Pay. Other details are optional.'
            : 'Checkout is in test mode, so your plan activates instantly and AI content generation starts right away.'}
        </div>
        {incomplete && (
          <button className="btn" style={{ width: '100%', padding: 11, marginTop: 8 }} onClick={goOnboard}>
            Add Business Name
          </button>
        )}
      </div>

      <div className="card" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div><b>Continue to content</b><div className="sub">We will create 30 days of ready-to-post content from your saved business details.</div></div>
        <button className="btn primary" style={{ padding: '11px 20px' }} onClick={submit} disabled={busy}>Continue →</button>
      </div>
    </>
  )
}