import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { leadIntent, botReply, escapeHtml } from '../../utils/chatbot'
import { SM_PLANS } from '../../data/mock'
import { sanitizeHtml } from '../../utils/safeHtml'

const DEFAULT_FIELDS = [
  { id: 1, name: 'Name', type: 'text', required: true },
  { id: 2, name: 'Phone Number', type: 'phone', required: true },
  { id: 3, name: 'Email', type: 'email', required: false },
  { id: 4, name: 'Requirement', type: 'text', required: true },
]

export default function ChatPreview() {
  const { bot, services, sm, fields, captureChatLead } = useApp()
  const biz = sm.biz || {}
  const bizName = escapeHtml(biz.name || 'ABC Business')
  const activeServices = services.filter((s) => s.enabled !== false)
  const serviceNames = activeServices.length ? activeServices.map((s) => s.name) : ['Website Development', 'Digital Marketing']
  const activeFields = fields.filter((f) => f.enabled !== false)

  const [messages, setMessages] = useState(() => [
    { from: 'bot', html: escapeHtml(bot.welcomeMessage) },
    { from: 'bot', html: 'Please select a service:' },
    { from: 'choices', choices: serviceNames },
  ])
  const [input, setInput] = useState('')
  const flowRef = useRef(null)
  const leadCapturedRef = useRef(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages])

  function alreadyCaptured(service) {
    const list = escapeHtml(serviceNames.join(' · '))
    return `We already have your details ✅ — our team will contact you soon${service ? ' about ' + escapeHtml(service) : ''}.<br>Our services: ${list} + AI Chatbot, Social Media Management & Lead Links.<br>Ask me anything else about ${bizName}.`
  }

  function startLead(r) {
    const list = serviceNames.map((s) => escapeHtml(s))
    const plans = SM_PLANS.map((p) => `${escapeHtml(p.name)} ₹${p.price.toLocaleString('en-IN')} (${p.posts} posts + ${p.reels} reels)`).join(' · ')
    const s = r && r.service && r.service !== 'General Enquiry' ? ' about ' + escapeHtml(r.service) : ''
    return `Great${s}! ${bizName} services:<br>• ${list.join('<br>• ')}<br>• AI Chatbot, Social Media Management & Lead Links<br><br>Yearly plans: ${plans} (+18% GST).`
  }

  function unknownLead() {
    return `Sorry, I don't have this exact detail about ${bizName} right now.<br>Let me connect you with our team.`
  }

  function replyAndSet(html) {
    setMessages((m) => [...m, { from: 'bot', html }])
  }

  function questionFor(field) {
    return `Please share your <b>${escapeHtml(field.name)}</b>:`
  }

  async function handleFlow(value) {
    const f = flowRef.current
    if (!f) return ''
    const q = f.questions[f.step]
    if (!q) return ''

    const v = String(value).trim()
    if (q.required && !v) return `This field is required. ${questionFor(q)}`

    if (q.type === 'phone' && v && !/^[0-9+\-\s()]{6,25}$/.test(v)) {
      return `Please enter a valid phone number.<br>${questionFor(q)}`
    }
    if (q.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return `Please enter a valid email address.<br>${questionFor(q)}`
    }

    f.data[q.id] = v
    f.step += 1

    if (f.step < f.questions.length) return questionFor(f.questions[f.step])

    const phone = f.questions.find((x) => x.type === 'phone')
    const email = f.questions.find((x) => x.type === 'email')
    const nameField = f.questions.find((x) => /name/i.test(x.name)) || f.questions[0]
    const reqFields = f.questions.filter((x) => x !== phone && x !== email && x !== nameField)
    const reqText = reqFields.map((x) => `${x.name}: ${f.data[x.id] || ''}`).join(' | ')

    flowRef.current = null
    leadCapturedRef.current = true

    try {
      const info = await captureChatLead({
        name: f.data[nameField.id] || 'Chatbot Visitor',
        phone: phone ? f.data[phone.id] : '',
        email: email ? f.data[email.id] : '',
        req: reqText,
        service: f.service,
      })

      return `Thank you <b>${escapeHtml(f.data[nameField.id] || 'there')}</b>! ✅ Your details are saved in <b>Chatbot Leads</b> and the meeting is set in <b>Meeting Time</b>.<br>📅 Meeting: <b>${escapeHtml(info.slot.day)}, ${escapeHtml(info.slot.date)} at ${escapeHtml(info.slot.time)}</b> (${escapeHtml(info.slot.dur)}).<br>📩 WhatsApp reminder message: <i>${escapeHtml(info.text)}</i>`
    } catch (e) {
      leadCapturedRef.current = false
      flowRef.current = { step: 0, service: f.service, questions: f.questions, data: {} }
      return `Sorry, I could not save your details right now. ${escapeHtml(e.message || 'Please try again.')}<br>${questionFor(f.questions[0])}`
    }
  }

  async function choice(value) {
    setMessages((m) => [...m, { from: 'user', text: value }])
    let replyHtml = ''
    if (flowRef.current) {
      replyHtml = await handleFlow(value)
    } else {
      const chosen = serviceNames.find((s) => s.toLowerCase() === value.toLowerCase())
      const r = chosen ? { service: chosen } : leadIntent(value)
      if (r) {
        if (leadCapturedRef.current) replyHtml = alreadyCaptured(r.service)
        else {
          const questions = activeFields.length ? activeFields : DEFAULT_FIELDS
          flowRef.current = { step: 0, service: r.service, questions, data: {} }
          replyHtml = `${startLead(r)}<br><br>${questionFor(questions[0])}`
        }
      } else {
        const a = botReply(value, biz, activeServices)
        if (a === null) {
          if (leadCapturedRef.current) replyHtml = alreadyCaptured('')
          else {
            const questions = activeFields.length ? activeFields : DEFAULT_FIELDS
            flowRef.current = { step: 0, service: 'General Enquiry', questions, data: {} }
            replyHtml = `${unknownLead()}<br>${questionFor(questions[0])}`
          }
        } else replyHtml = a
      }
    }
    setTimeout(() => replyAndSet(replyHtml), 350)
  }

  function send() {
    if (input.trim()) { choice(input.trim()); setInput('') }
  }

  return (
    <div className="card">
      <h3>Website Preview</h3>
      <div className="phone">
        <div className="chathead">
          <div className="bot">AI</div>
          <div>
            <b>{escapeHtml(bot.chatbotName)}</b>
            <div style={{ fontSize: 10 }}>Online</div>
          </div>
        </div>
        <div className="chatbody" id="cb" ref={bodyRef}>
          {messages.map((msg, i) => {
            if (msg.from === 'choices') {
              return (
                <div className="choices" key={i}>
                  {msg.choices.map((c) => (
                    <button key={c} onClick={() => choice(c)}>{c}</button>
                  ))}
                </div>
              )
            }
            if (msg.from === 'user') return <div className="msg user" key={i}>{msg.text}</div>
            return <div className="msg" key={i} dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.html) }} />
          })}
        </div>
        <div className="chatinput">
          <input
            id="ci"
            placeholder="Type..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button className="btn primary" onClick={send}>Send</button>
        </div>
      </div>
    </div>
  )
}
