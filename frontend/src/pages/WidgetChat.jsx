import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { leadIntent, botReply, escapeHtml } from '../utils/chatbot'
import { sanitizeHtml } from '../utils/safeHtml'

const DEFAULT_FIELDS = [
  { id: 1, name: 'Name', type: 'text', required: true },
  { id: 2, name: 'Phone Number', type: 'phone', required: true },
  { id: 3, name: 'Email', type: 'email', required: false },
  { id: 4, name: 'Requirement', type: 'text', required: true },
]

const S = {
  wrap: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#071225', color: '#fff', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' },
  head: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'linear-gradient(135deg,#6D33E7,#384FE7)' },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: '#fff', color: '#6D33E7', display: 'grid', placeItems: 'center', fontWeight: 800 },
  body: { flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8, background: '#0b1526' },
  bot: { alignSelf: 'flex-start', maxWidth: '85%', background: '#1a2740', padding: '9px 12px', borderRadius: '12px 12px 12px 4px', fontSize: 13, lineHeight: 1.5 },
  user: { alignSelf: 'flex-end', maxWidth: '85%', background: '#6D33E7', padding: '9px 12px', borderRadius: '12px 12px 4px 12px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  choices: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  choice: { background: 'transparent', color: '#c4b5fd', border: '1px solid #6D33E7', borderRadius: 20, padding: '6px 11px', fontSize: 12, cursor: 'pointer' },
  inputBar: { display: 'flex', gap: 8, padding: 10, borderTop: '1px solid rgba(255,255,255,0.1)', background: '#071225' },
  input: { flex: 1, background: '#132038', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none' },
  send: { background: 'linear-gradient(135deg,#6D33E7,#384FE7)', border: 0, color: '#fff', borderRadius: 9, padding: '0 16px', fontWeight: 700, cursor: 'pointer' },
  close: { marginLeft: 'auto', background: 'rgba(255,255,255,0.16)', border: 0, color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: 16 },
  note: { padding: 24, color: 'rgba(255,255,255,0.6)', textAlign: 'center', fontSize: 13 },
}

export default function WidgetChat({ botId }) {
  const [config, setConfig] = useState(null)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const flowRef = useRef(null)
  const capturedRef = useRef(false)
  const bodyRef = useRef(null)
  const configRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    api(`/public/bots/${encodeURIComponent(botId)}`, { auth: false })
      .then((data) => {
        if (cancelled) return
        configRef.current = data
        setConfig(data)
        const services = (data.chatbot.services || []).filter((s) => s.enabled !== false)
        const names = services.length ? services.map((s) => s.name) : ['Website Development', 'Digital Marketing']
        const initial = [{ from: 'bot', html: escapeHtml(data.chatbot.welcomeMessage) }]
        if (names.length) initial.push({ from: 'choices', choices: names })
        setMessages(initial)
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'ledora:ready', autoOpen: data.chatbot.autoOpen }, '*')
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Chatbot not found')
      })
    return () => {
      cancelled = true
    }
  }, [botId])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages])

  const activeFields = () => {
    const fields = (configRef.current && configRef.current.chatbot.fields) || []
    const enabled = fields.filter((f) => f.enabled !== false)
    return enabled.length ? enabled : DEFAULT_FIELDS
  }

  const biz = (config && config.business) || {}
  const bizName = escapeHtml(biz.name || 'this business')

  const reply = (html) => setMessages((m) => [...m, { from: 'bot', html }])

  const questionFor = (field) => `Please share your <b>${escapeHtml(field.name)}</b>:`

  const alreadyCaptured = (service) => `We already have your details — our team will contact you soon${service ? ' about ' + escapeHtml(service) : ''}.<br>Ask me anything else about ${bizName}.`

  async function completeLead(f) {
    const phone = f.questions.find((x) => x.type === 'phone')
    const email = f.questions.find((x) => x.type === 'email')
    const nameField = f.questions.find((x) => /name/i.test(x.name)) || f.questions[0]
    const reqFields = f.questions.filter((x) => x !== phone && x !== email && x !== nameField)
    const reqText = reqFields.map((x) => `${x.name}: ${f.data[x.id] || ''}`).join(' | ')

    flowRef.current = null
    capturedRef.current = true

    try {
      const data = await api(`/public/bots/${encodeURIComponent(botId)}/leads`, {
        method: 'POST',
        auth: false,
        body: {
          name: f.data[nameField.id] || 'Chatbot Visitor',
          phone: phone ? f.data[phone.id] : '',
          email: email ? f.data[email.id] : '',
          req: reqText,
          service: f.service,
        },
      })
      return `Thank you <b>${escapeHtml(f.data[nameField.id] || 'there')}</b>! Your details are saved. Our team will contact you soon.<br>Meeting: <b>${escapeHtml(data.meeting.day)}, ${escapeHtml(data.meeting.date)} at ${escapeHtml(data.meeting.timeLabel)}</b>.`
    } catch (e) {
      capturedRef.current = false
      flowRef.current = { step: 0, service: f.service, questions: f.questions, data: {} }
      return `Sorry, I could not save your details. ${escapeHtml(e.message || '')}<br>${questionFor(f.questions[0])}`
    }
  }

  async function handleFlow(value) {
    const f = flowRef.current
    if (!f) return ''
    const q = f.questions[f.step]
    const v = String(value).trim()
    if (q.required && !v) return `This field is required. ${questionFor(q)}`
    if (q.type === 'phone' && v && !/^[0-9+\-\s()]{6,25}$/.test(v)) return `Please enter a valid phone number.<br>${questionFor(q)}`
    if (q.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `Please enter a valid email address.<br>${questionFor(q)}`

    f.data[q.id] = v
    f.step += 1
    if (f.step < f.questions.length) return questionFor(f.questions[f.step])
    return completeLead(f)
  }

  async function choice(value) {
    setMessages((m) => [...m, { from: 'user', text: value }])
    let html = ''
    if (flowRef.current) {
      html = await handleFlow(value)
    } else {
      const configured = ((configRef.current && configRef.current.chatbot.services) || [])
        .filter((s) => s.enabled !== false)
      const chosen = configured.find((s) => s.name.toLowerCase() === value.toLowerCase())
      const r = chosen ? { service: chosen.name } : leadIntent(value)
      if (r) {
        if (capturedRef.current) html = alreadyCaptured(r.service)
        else {
          const questions = activeFields()
          flowRef.current = { step: 0, service: r.service, questions, data: {} }
          html = `Great! Let's get you connected.<br>${questionFor(questions[0])}`
        }
      } else {
        const a = botReply(value, config ? config.business : {}, (config && config.chatbot.services) || [])
        if (a === null) {
          if (capturedRef.current) html = alreadyCaptured('')
          else {
            const questions = activeFields()
            flowRef.current = { step: 0, service: 'General Enquiry', questions, data: {} }
            html = `Let me connect you with our team.<br>${questionFor(questions[0])}`
          }
        } else html = a
      }
    }
    setTimeout(() => reply(html), 350)
  }

  const send = () => {
    if (input.trim()) {
      choice(input.trim())
      setInput('')
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.head}>
        <div style={S.avatar}>AI</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{config ? config.chatbot.chatbotName : 'Assistant'}</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>{config ? bizName : 'Loading…'}</div>
        </div>
        <button style={S.close} onClick={() => window.parent !== window && window.parent.postMessage({ type: 'ledora:close' }, '*')} aria-label="Close chat">×</button>
      </div>

      {error ? (
        <div style={S.note}>{error}</div>
      ) : (
        <>
          <div style={S.body} ref={bodyRef}>
            {messages.map((msg, i) => {
              if (msg.from === 'choices') {
                return (
                  <div style={S.choices} key={i}>
                    {msg.choices.map((c) => (
                      <button style={S.choice} key={c} onClick={() => choice(c)}>{c}</button>
                    ))}
                  </div>
                )
              }
              if (msg.from === 'user') return <div style={S.user} key={i}>{msg.text}</div>
              return <div style={S.bot} key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.html) }} />
            })}
          </div>
          <div style={S.inputBar}>
            <input style={S.input} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type your message…" />
            <button style={S.send} onClick={send}>Send</button>
          </div>
        </>
      )}
    </div>
  )
}
