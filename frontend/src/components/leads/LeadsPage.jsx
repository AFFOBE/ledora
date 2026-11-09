import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import PageHead from '../ui/PageHead'
import { StatusBadge } from '../ui/PageHead'
import { escapeHtml } from '../../utils/helpers'
import { downloadFile } from '../../api/client'

const STATUSES = ['New', 'Contacted', 'Qualified', 'Won', 'Lost']
const PAGE_SIZE = 5

export default function LeadsPage({ type }) {
  const { chatData, linkLeads, openLead, showToast } = useApp()
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [st, setSt] = useState('')
  const [cur, setCur] = useState(1)

  const data = type === 'chat' ? chatData : linkLeads
  const isChat = type === 'chat'

  const filtered = useMemo(() => {
    const text = q.toLowerCase()
    return data.filter((x) => {
      const all = Object.values(x).join(' ').toLowerCase()
      return (!text || all.includes(text)) && (!from || x.date >= from) && (!to || x.date <= to) && (!st || x.status === st)
    })
  }, [data, q, from, to, st])

  const rows = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)
  const start = filtered.length ? (cur - 1) * PAGE_SIZE + 1 : 0
  const end = Math.min(cur * PAGE_SIZE, filtered.length)

  const clear = () => { setQ(''); setFrom(''); setTo(''); setSt(''); setCur(1) }

  const downloadAll = async () => {
    try {
      const source = isChat ? 'chatbot' : 'link'
      await downloadFile(`/leads/export?source=${source}`, `${type}-leads.csv`)
      showToast('Leads downloaded')
    } catch (e) {
      showToast(e.message)
    }
  }

  return (
    <section className="page active">
      <PageHead
        title={isChat ? 'Chatbot Leads' : 'Link Leads'}
        sub={isChat ? 'Leads captured directly by the website chatbot.' : 'Every generated link keeps its leads separately.'}
      >
        <button className="btn" onClick={downloadAll}>↓ Download All Leads</button>
      </PageHead>
      <div className="card">
        <div className="toolbar">
          <input className="search" placeholder={isChat ? 'Search name, email, phone...' : 'Search name, link name...'}
            value={q} onChange={(e) => { setQ(e.target.value); setCur(1) }} />
          <input className="date" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setCur(1) }} />
          <input className="date" type="date" value={to} onChange={(e) => { setTo(e.target.value); setCur(1) }} />
          <select className="date" value={st} onChange={(e) => { setSt(e.target.value); setCur(1) }}>
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={clear}>Clear</button>
        </div>
        <div style={{ overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>NAME</th>
                {isChat && <th>SERVICE</th>}
                {isChat ? <th>REQUIREMENT</th> : <th>LINK NAME</th>}
                <th>DATE</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id}>
                  <td><b>{escapeHtml(x.name)}</b></td>
                  {isChat && <td>{escapeHtml(x.service)}</td>}
                  {isChat ? <td>{escapeHtml(x.req)}</td> : <td>{escapeHtml(x.link)}</td>}
                  <td>{x.date}</td>
                  <td><StatusBadge s={x.status} /></td>
                  <td><button className="btn" onClick={() => openLead(type, x.id)}>View</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={isChat ? 6 : 5} style={{ textAlign: 'center', padding: 30 }}>No leads found</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span className="sub">Showing {start}–{end} of {filtered.length} leads</span>
          <div className="pages">
            {Array.from({ length: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`btn ${p === cur ? 'sel' : ''}`} onClick={() => setCur(p)}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}