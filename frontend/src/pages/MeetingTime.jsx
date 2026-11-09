import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import PageHead from '../components/ui/PageHead'
import { fmt12 } from '../utils/helpers'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const meetISO = (m) => m.raw || toISO(new Date(m.date))
const initialsOf = (name) => String(name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
const dayLabel = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short' })
const monthLabel = (key) => new Date(key + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
const getAutoStatus = (m, todayISO) => {
  if (m.status === 'Rescheduled' || m.status === 'Cancelled') return m.status
  const iso = m.raw || meetISO(m)
  if (!iso) return m.status || 'Upcoming'
  const md = new Date(iso + 'T00:00:00')
  const td = new Date(todayISO + 'T00:00:00')
  md.setHours(0, 0, 0, 0)
  if (md < td) return 'Completed'
  if (md.getTime() === td.getTime()) return 'Today'
  return 'Upcoming'
}

export default function MeetingTime() {
  const { meetings, rescheduleMeeting, showToast, sm } = useApp()
  const [search, setSearch] = useState('')
  const [view, setView] = useState('upcoming')
  const [histMonth, setHistMonth] = useState('')
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [picked, setPicked] = useState(null)
  const [preview, setPreview] = useState(null)
  const [resched, setResched] = useState({ open: false, id: null, name: '', phone: '', date: '', time: '', day: '' })

  const [todayISO] = useState(() => toISO(new Date()))
  const q = search.trim().toLowerCase()

  const sorted = useMemo(() => {
    return [...meetings]
      .map((m) => {
        const _iso = m.raw || meetISO(m)
        const autoStatus = getAutoStatus(m, todayISO)
        return { ...m, _iso, status: autoStatus }
      })
      .sort((a, b) => `${a._iso}${a.time}`.localeCompare(`${b._iso}${b.time}`))
  }, [meetings, todayISO])

  const matches = (m) => !q || [m.name, m.service, m.phone, m.date, m.day].join(' ').toLowerCase().includes(q)
  const filtered = sorted.filter(matches)
  const upcoming = filtered.filter((m) => m.status === 'Upcoming')
  const today = filtered.filter((m) => m.status === 'Today')
  const rescheduled = filtered.filter((m) => m.status === 'Rescheduled')
  const completed = filtered.filter((m) => m.status === 'Completed')
  const past = filtered.filter((m) => m.status === 'Completed' || m.status === 'Rescheduled').sort((a, b) => `${b._iso}${b.time}`.localeCompare(`${a._iso}${a.time}`))

  const y = cursor.getFullYear()
  const mo = cursor.getMonth()
  const lead = new Date(y, mo, 1).getDay()
  const totalDays = new Date(y, mo + 1, 0).getDate()
  const monthMeetings = filtered.filter((m) => m._iso.slice(0, 7) === `${y}-${String(mo + 1).padStart(2, '0')}`)
  const byDay = {}
  monthMeetings.forEach((m) => { (byDay[m._iso] ||= []).push(m) })
  const shift = (delta) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  const dayList = picked ? (byDay[picked] || []) : []

  const pastMonths = []
  past.forEach((m) => { const k = m._iso.slice(0, 7); if (!pastMonths.some((p) => p.key === k)) pastMonths.push({ key: k, count: 0 }) })
  past.forEach((m) => { const p = pastMonths.find((x) => x.key === m._iso.slice(0, 7)); if (p) p.count += 1 })
  const histList = histMonth ? past.filter((m) => m._iso.slice(0, 7) === histMonth) : past
  const histGroups = []
  histList.forEach((m) => {
    const k = m._iso.slice(0, 7)
    let g = histGroups.find((x) => x.key === k)
    if (!g) { g = { key: k, items: [] }; histGroups.push(g) }
    g.items.push(m)
  })

  const openPreview = (m) => setPreview(m)

  const getStatusClass = (s) => {
    if (s === 'Completed') return 'active'
    if (s === 'Rescheduled') return 'demo'
    if (s === 'Today') return 'demo'
    if (s === 'Upcoming') return 'blue'
    return 'blue'
  }

  const closeResched = () => setResched({ open: false, id: null, name: '', phone: '', date: '', time: '', day: '' })

  const waLink = (phone, text) => {
    let p = String(phone || '').replace(/[^0-9]/g, '')
    if (p.length === 10) p = '91' + p
    return `https://wa.me/${p}?text=${encodeURIComponent(text)}`
  }

  const openReschedule = (m) => {
    const d = new Date(todayISO + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    setResched({
      open: true,
      id: m.id,
      name: m.name,
      phone: m.phone || '',
      date: toISO(d),
      time: '11:00',
      day: days[d.getDay()],
    })
  }

  const saveReschedule = () => {
    if (!resched.id) return
    if (!resched.date || !resched.time) { showToast('Please select a new date and time'); return }
    if (resched.date < todayISO) { showToast('Please choose today or a future date'); return }
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const d = new Date(resched.date + 'T00:00:00')
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    const day = resched.day || days[d.getDay()]
    rescheduleMeeting(resched.id, {
      day,
      date: label,
      time: resched.time,
      raw: resched.date,
    })
    const bizName = (sm.biz && sm.biz.name) || 'our team'
    const text = `Hello ${resched.name}, your meeting with ${bizName} has been rescheduled to ${day}, ${label} at ${fmt12(resched.time)}. Please reply to confirm. Thank you.`
    if (resched.phone) {
      window.open(waLink(resched.phone, text), '_blank', 'noopener,noreferrer')
      showToast('Meeting rescheduled — WhatsApp reminder ready')
    } else {
      showToast('Meeting rescheduled — no phone number for reminder')
    }
    closeResched()
  }

  const row = (m) => (
    <div className="service" key={m.id}>
      <div>
        <b>{m.name}</b> · {m.service}
        <div className="sub">{m.day}, {m.date} at {m.time} · {m.phone || 'No phone'}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`badge ${getStatusClass(m.status)}`}>{m.status}</span>
        <button className="btn" onClick={() => openReschedule(m)}>Reschedule</button>
        <button className="btn" onClick={() => openPreview(m)}>View</button>
      </div>
    </div>
  )

  return (
    <section className="page active">
      <PageHead title="Meetings" sub="Track every meeting your chatbot books." />

      <div className="cards">
        <div className="card"><div className="label">Upcoming</div><div className="num">{upcoming.length}</div></div>
        <div className="card"><div className="label">Today</div><div className="num" style={{ color: '#f59e0b' }}>{today.length}</div></div>
        <div className="card"><div className="label">Completed</div><div className="num" style={{ color: '#4ade80' }}>{completed.length}</div></div>
        <div className="card"><div className="label">Rescheduled</div><div className="num" style={{ color: '#a78bfa' }}>{rescheduled.length}</div></div>
        <div className="card"><div className="label">Total</div><div className="num">{filtered.length}</div></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="mt-head">
          <div>
            <h3 style={{ margin: 0 }}>Booked Meetings</h3>
            <div className="sub" style={{ marginTop: 4 }}>Status updates automatically based on meeting date</div>
          </div>
          <div className="mt-tools">
            <input className="search" placeholder="Search by name, service or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="billseg" role="tablist" aria-label="Meetings view">
              <button role="tab" className={view === 'upcoming' ? 'on' : ''} onClick={() => setView('upcoming')}>All</button>
              <button role="tab" className={view === 'scheduled' ? 'on' : ''} onClick={() => setView('scheduled')}>Upcoming</button>
              <button role="tab" className={view === 'history' ? 'on' : ''} onClick={() => setView('history')}>History</button>
              <button role="tab" className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}>Calendar</button>
            </div>
          </div>
        </div>

        {view === 'upcoming' && (
          <div>
            {!filtered.length
              ? <div className="sub">{q ? 'No meetings match your search.' : 'No meetings yet.'}</div>
              : filtered.map((m) => row(m))}
          </div>
        )}

        {view === 'scheduled' && (
          <div>
            {![...upcoming, ...today].length
              ? <div className="sub">{q ? 'No upcoming meetings match your search.' : 'No upcoming meetings yet.'}</div>
              : [...upcoming, ...today].filter(matches).map((m) => row(m))}
          </div>
        )}

        {view === 'history' && (
          <div>
            {!past.length
              ? <div className="sub">{q ? 'No past meetings match your search.' : 'No past meetings yet.'}</div>
              : (
                <>
                  <div className="histbar">
                    <span className="sub">Month</span>
                    <select className="input" value={histMonth} onChange={(e) => setHistMonth(e.target.value)}>
                      <option value="">All Months</option>
                      {pastMonths.map((p) => <option key={p.key} value={p.key}>{monthLabel(p.key)} ({p.count})</option>)}
                    </select>
                  </div>
                  {!histList.length
                    ? <div className="sub">No meetings in this month.</div>
                    : histGroups.map((g) => (
                      <div key={g.key} className="histgrp">
                        <div className="histgrp-h">{monthLabel(g.key)}<span className="badge blue">{g.items.length}</span></div>
                        {g.items.map((m) => row(m))}
                      </div>
                    ))}
                </>
              )}
          </div>
        )}

      {resched.open && (
        <div className={`modal show`} onClick={(e) => { if (e.target === e.currentTarget) closeResched() }}>
          <div className="modalbox" style={{ width: 'min(440px, 92vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Reschedule Meeting</h3>
              <button className="btn" style={{ padding: '5px 10px' }} onClick={closeResched}>✕</button>
            </div>
            <div className="sub" style={{ marginBottom: 12 }}>Client: <b>{resched.name}</b></div>
            <div className="field">
              <label>New Date</label>
              <input type="date" className="input" min={todayISO} value={resched.date} onChange={(e) => {
                const val = e.target.value
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                const d = val ? new Date(val + 'T00:00:00') : null
                setResched((r) => ({ ...r, date: val, day: d ? days[d.getDay()] : r.day }))
              }} />
            </div>
            <div className="field">
              <label>New Time</label>
              <input type="time" className="input" value={resched.time} onChange={(e) => setResched((r) => ({ ...r, time: e.target.value }))} />
            </div>
            <div className="sub" style={{ marginBottom: 12 }}>
              New schedule: <b>{resched.day || '—'}</b>{resched.time ? ` at ${fmt12(resched.time)}` : ''}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={closeResched}>Cancel</button>
              <button className="btn primary" onClick={saveReschedule}>Save & Mark as Rescheduled</button>
            </div>
          </div>
        </div>
      )}

      {view === 'calendar' && (
        <div className="mcal">
            <div className="mcal-top">
              <button className="btn iconbtn" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
              <b>{MONTHS[mo]} {y}</b>
              <button className="btn iconbtn" onClick={() => shift(1)} aria-label="Next month">›</button>
              <span className="sub" style={{ marginLeft: 'auto' }}>{monthMeetings.length} meetings this month</span>
            </div>
            <div className="mcal-grid">
              {WEEK.map((d) => <div className="mcal-h" key={d}>{d}</div>)}
              {Array.from({ length: lead }).map((_, i) => <div className="mcal-d empty" key={`e${i}`} />)}
              {Array.from({ length: totalDays }).map((_, i) => {
                const day = i + 1
                const isoD = toISO(new Date(y, mo, day))
                const list = byDay[isoD] || []
                return (
                  <div
                    key={isoD}
                    className={`mcal-d ${list.length ? 'has' : ''} ${isoD === todayISO ? 'today' : ''} ${isoD === picked ? 'picked' : ''}`}
                    onClick={() => setPicked(list.length ? isoD : null)}
                  >
                    <span>{day}</span>
                    {list.length > 0 && <div className="mcal-dots">{list.slice(0, 4).map((_, j) => <i key={j} />)}</div>}
                    {list.length > 0 && <div className="mcal-cnt">{list.length}</div>}
                  </div>
                )
              })}
            </div>
            {picked && (
              <div className="mcal-daylist">
                <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>
                  {dayLabel(picked)}
                </h3>
                {dayList.map((m) => row(m))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`modal ${preview ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setPreview(null) }}>
        <div className="modalbox" style={{ width: 'min(430px, 94vw)' }}>
          {preview && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div className="mprev-av">{initialsOf(preview.name)}</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{preview.name}</h3>
                  <div className="sub" style={{ marginTop: 2 }}>{preview.service}</div>
                </div>
                <button className="btn" style={{ marginLeft: 'auto', padding: '6px 10px' }} onClick={() => setPreview(null)}>×</button>
              </div>
              <div className="kv"><span>Date</span><b>{preview.day}, {preview.date}</b></div>
              <div className="kv"><span>Time</span><b>{preview.time}</b></div>
              <div className="kv"><span>Duration</span><b>{preview.dur || '30 minutes'}</b></div>
              <div className="kv"><span>Phone</span><b>{preview.phone || 'Not provided'}</b></div>
              <div className="kv" style={{ borderBottom: 0 }}><span>Status</span><span className={`badge ${getStatusClass(preview.status)}`}>{preview.status}</span></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {meetISO(preview) >= todayISO && <button className="btn primary" style={{ flex: 1 }} onClick={() => {
                  const bizName = (sm.biz && sm.biz.name) || 'our team'
                  const text = `Hello ${preview.name}, this is a reminder for your meeting with ${bizName} on ${preview.day}, ${preview.date} at ${preview.time}. Please reply to confirm. Thank you.`
                  if (preview.phone) {
                    window.open(waLink(preview.phone, text), '_blank', 'noopener,noreferrer')
                    showToast('WhatsApp reminder ready')
                  } else {
                    showToast('No phone number for this client')
                  }
                  setPreview(null)
                }}>Send Reminder</button>}
                <button className="btn" style={{ flex: 1 }} onClick={() => setPreview(null)}>×</button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
