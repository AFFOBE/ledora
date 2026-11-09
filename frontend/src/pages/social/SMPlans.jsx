import { useApp } from '../../context/AppContext'
import { SM_DELIVERABLES, smPlanPrice, smPlanPeriod, smPlanUnits, SM_YEARLY_FREE_MONTHS } from '../../data/mock'

export default function SMPlans() {
  const { smPlans, sm, smChoosePlan, smSetBilling, smSetStep } = useApp()
  const billing = sm.billing || 'monthly'
  const period = smPlanPeriod(billing)
  const pn = (n) => n.toLocaleString('en-IN')

  return (
    <>
      <div className="head">
        <div>
          <h1>Social Media Management</h1>
          <div className="sub">Pick a plan. We write the content, captions, hashtags and schedule everything for you.</div>
        </div>
        <div className="billseg" role="tablist" aria-label="Billing period">
          <button role="tab" className={billing === 'monthly' ? 'on' : ''} onClick={() => smSetBilling('monthly')}>Monthly</button>
          <button role="tab" className={billing === 'yearly' ? 'on' : ''} onClick={() => smSetBilling('yearly')}>Yearly</button>
        </div>
      </div>
      {sm.paid && sm.plan && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'rgba(3,152,85,0.45)', background: 'rgba(3,152,85,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="label">CURRENT PLAN</div>
              <h3 style={{ margin: '6px 0 2px' }}>{sm.plan.name} is active</h3>
              <div className="sub">You can keep using your current plan, or choose a new one below to upgrade or change it.</div>
            </div>
            <button className="btn" onClick={() => smSetStep('dash')}>Go to Content Dashboard →</button>
          </div>
        </div>
      )}
      <div className="smsteps">
        <span className="smstep on">1. Choose Plan</span>
        <span style={{ color: 'rgba(255,255,255,.45)' }}>→</span>
        <span className="smstep">2. Payment</span>
        <span style={{ color: 'rgba(255,255,255,.45)' }}>→</span>
        <span className="smstep">3. 30 Day Content</span>
      </div>
      <div className="planwrap" id="planWrap">
        {smPlans.map((p) => {
          const u = smPlanUnits(p, billing)
          return (
            <div key={p.id} className={`plan ${sm.planId === p.id ? 'sel' : ''}`}>
              <div className="ptag" style={{ background: p.tone }}>{p.tag.toUpperCase()}</div>
              <div className="pname">{p.name}</div>
              <div className="sub">Social Media Management</div>
              <div className="pprice">₹{pn(smPlanPrice(p, billing))} <span>/ {period}</span></div>
              {billing === 'yearly' && <div className="psave">Save ₹{pn(p.price * SM_YEARLY_FREE_MONTHS)} · {SM_YEARLY_FREE_MONTHS} months free</div>}
              <div className="pquota">
                <div className="pq"><b>{pn(u.posts)}</b><div>Posts / mo</div></div>
                <div className="pq"><b>{pn(u.reels)}</b><div>Reels / mo</div></div>
                <div className="pq"><b>{u.days}</b><div>Days / batch</div></div>
              </div>
              {billing === 'yearly' && (
                <div className="sub" style={{ fontSize: 10.5, marginTop: -4 }}>
                  {u.months} monthly batches · refreshed month by month
                </div>
              )}
              <ul className="pf">{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
              <button className={`btn ${p.id === 'advance' ? 'primary' : ''}`} onClick={() => smChoosePlan(p.id)}>
                {sm.planId === p.id ? 'Selected' : `Choose ${p.name}`}
              </button>
            </div>
          )
        })}
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Full Plan Comparison</h3>
        <div style={{ overflow: 'auto' }}>
          <table className="table" id="cmpTable">
            <thead>
              <tr><th>FEATURE</th>{smPlans.map((p) => <th key={p.id} style={{ textAlign: 'center' }}>{p.name.toUpperCase()}</th>)}</tr>
            </thead>
            <tbody>
              <tr><td><b>{billing === 'yearly' ? 'Yearly Price' : 'Monthly Price'}</b></td>{smPlans.map((p) => <td key={p.id} style={{ textAlign: 'center' }}><b>₹{pn(smPlanPrice(p, billing))}</b>{billing === 'yearly' && <div className="sub" style={{ fontSize: 10 }}>₹{pn(p.price)}/mo</div>}</td>)}</tr>
              <tr><td><b>Posts / month</b></td>{smPlans.map((p) => <td key={p.id} style={{ textAlign: 'center' }}>{p.posts}</td>)}</tr>
              <tr><td><b>Reels / month</b></td>{smPlans.map((p) => <td key={p.id} style={{ textAlign: 'center' }}>{p.reels}</td>)}</tr>
              <tr><td><b>Content Calendar</b></td>{smPlans.map((p) => <td key={p.id} style={{ textAlign: 'center' }}>30 days</td>)}</tr>
              <tr>
                <td><b>Reel Script + Shot List</b></td>
                <td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center' }}>Yes</td><td style={{ textAlign: 'center' }}>Yes</td>
              </tr>
              <tr><td><b>Platforms</b></td><td style={{ textAlign: 'center' }}>4</td><td style={{ textAlign: 'center' }}>6</td><td style={{ textAlign: 'center' }}>All</td></tr>
              <tr><td><b>Hashtag Research</b></td><td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center' }}>Yes</td><td style={{ textAlign: 'center' }}>Yes</td></tr>
              <tr><td><b>Competitor Analysis</b></td><td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center' }}>Yes</td></tr>
              <tr><td><b>Design / Thumbnail</b></td><td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center' }}>—</td><td style={{ textAlign: 'center' }}>Yes</td></tr>
              <tr><td><b>Support</b></td><td style={{ textAlign: 'center' }}>Email (24h)</td><td style={{ textAlign: 'center' }}>Priority chat</td><td style={{ textAlign: 'center' }}>Dedicated manager</td></tr>
              <tr><td><b>Turnaround</b></td><td style={{ textAlign: 'center' }}>48 hours</td><td style={{ textAlign: 'center' }}>24 hours</td><td style={{ textAlign: 'center' }}>12 hours</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="pubshead">
          <div>
            <h3 style={{ margin: 0 }}>What&apos;s Included</h3>
            <div className="sub" style={{ marginTop: 4 }}>Everything you get once you choose a plan — fully done for you, so you only post and grow.</div>
          </div>
          <span className="badge blue">Included in every plan</span>
        </div>
        <div className="deliver-grid">
          {SM_DELIVERABLES.map((x) => (
            <div className="deliver" key={x.t}>
              <div className="dc-ic">{x.ic}</div>
              <b>{x.t}</b>
              <p>{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}