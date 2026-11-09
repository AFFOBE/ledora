import { useState } from 'react'
import { useApp } from '../../context/AppContext'

const STATUSES = ['New', 'Contacted', 'Qualified', 'Won', 'Lost']

export default function LeadDrawer() {
  const { leadDrawer, closeLead, chatData, linkLeads, updateLeadStatus, deleteLead } = useApp()
  const [confirm, setConfirm] = useState(false)

  if (!leadDrawer.open) return null
  const { type, id } = leadDrawer
  const d = type === 'chat' ? chatData.find((x) => x.id === id) : linkLeads.find((x) => x.id === id)
  if (!d) return null

  const status = d.status || 'New'

  return (
    <>
      <div className="overlay show" onClick={closeLead} />
      <div className="drawer open">
        <button className="btn" onClick={closeLead}>×</button>
        <h2 id="dn">{d.name}</h2>
        <div className="line"><span>Source</span><b>{type === 'chat' ? 'Chatbot' : d.link}</b></div>
        {type === 'chat' ? (
          <>
            <div className="line"><span>Service / Link</span><b>{d.service}</b></div>
            <div className="line"><span>Requirement</span><b>{d.req}</b></div>
          </>
        ) : (
          <div className="line"><span>Requirement</span><b>Lead from {d.link}</b></div>
        )}
        <div className="line"><span>Name</span><b>{d.name}</b></div>
        <div className="line">
          <span>Status</span>
          <select value={status} onChange={(e) => updateLeadStatus(type, id, e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="line"><span>Phone</span><b>{d.phone || '—'}</b></div>
        <div className="line"><span>Email</span><b>{d.email || '—'}</b></div>
        {d.meeting ? <div className="line"><span>Meeting</span><b>{d.meeting}</b></div> : null}
        <button
          className="btn danger"
          style={{ marginTop: 20 }}
          onClick={() => setConfirm(true)}
        >
          Delete Lead
        </button>
      </div>
      {confirm && (
        <div className="modal show">
          <div className="modalbox">
            <h3>Delete lead?</h3>
            <p className="sub">This will remove the selected lead from the list.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
              <button
                className="btn danger"
                onClick={() => {
                  deleteLead(type, id)
                  setConfirm(false)
                  closeLead()
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}