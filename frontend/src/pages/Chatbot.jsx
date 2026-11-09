import { useState } from 'react'
import { useApp } from '../context/AppContext'
import ChatPreview from '../components/chatbot/ChatPreview'
import PageHead from '../components/ui/PageHead'

function ServiceRow({ id, name, enabled }) {
  const { removeService, toggleService } = useApp()
  return (
    <div className="service">
      <div><b>{name}</b><div className="sub">Shown in chatbot</div></div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className={`sw ${enabled ? 'on' : ''}`} role="switch" aria-checked={enabled} tabIndex={0}
          onClick={() => toggleService(id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleService(id) } }}>
          <i />
        </span>
        <button className="btn danger iconbtn" onClick={() => removeService(id)}>Delete</button>
      </div>
    </div>
  )
}

export default function Chatbot() {
  const { bot, saveBotConfig, services, addService, fields, addField, removeField, toggleField } = useApp()
  const [name, setName] = useState(bot.chatbotName)
  const [welcome, setWelcome] = useState(bot.welcomeMessage)
  const [autoOpen, setAutoOpen] = useState(bot.autoOpen)
  const [newService, setNewService] = useState('')
  const [newField, setNewField] = useState('')
  const [saving, setSaving] = useState(false)

  const add = (kind) => {
    const value = (kind === 'service' ? newService : newField).trim()
    if (!value) return
    if (kind === 'service') {
      addService(value)
      setNewService('')
    } else {
      addField(value)
      setNewField('')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await saveBotConfig({ chatbotName: name.trim() || 'AI Assistant', welcomeMessage: welcome.trim(), autoOpen })
    } catch { /* toast shown by context */ } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page active">
      <PageHead title="AI Chatbot Customization" sub="Create your own services and choose exactly what customer information the chatbot collects.">
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </PageHead>
      <div className="chatgrid">
        <ChatPreview key={`${bot.chatbotName}|${bot.welcomeMessage}|${services.map((s) => `${s.name}:${s.enabled}`).join(',')}|${fields.map((f) => `${f.name}:${f.enabled}`).join(',')}`} />
        <div className="card">
          <div className="field">
            <label>Chatbot Name</label>
            <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Welcome Message</label>
            <textarea rows={3} value={welcome} maxLength={300} onChange={(e) => setWelcome(e.target.value)} />
          </div>
          <div className="field">
            <label>Auto Open</label>
            <select value={autoOpen} onChange={(e) => setAutoOpen(e.target.value)}>
              <option>Immediately</option>
              <option>After 3 seconds</option>
              <option>After 5 seconds</option>
            </select>
          </div>
          <div className="field">
            <label>Services Shown in Chatbot — create your own</label>
            <div id="services">
              {services.map((s) => <ServiceRow key={s.id} id={s.id} name={s.name} enabled={s.enabled !== false} />)}
              {!services.length && <div className="sub" style={{ marginBottom: 8 }}>No services yet. Add your first service below.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="Enter your service name" value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add('service') }} />
              <button className="btn primary" onClick={() => add('service')}>+ Add Service</button>
            </div>
          </div>
          <div className="field">
            <label>Lead Information — create your own fields</label>
            <div id="leadfields">
              {fields.map((f) => (
                <div className="service" key={f.id}>
                  <div>
                    <b>{f.name}</b>
                    <div className="sub">Type: {f.type || 'text'} · {f.required ? 'Required' : 'Optional'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span className={`sw ${f.enabled !== false ? 'on' : ''}`} role="switch" aria-checked={f.enabled !== false} tabIndex={0}
                      onClick={() => toggleField(f.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleField(f.id) } }}>
                      <i />
                    </span>
                    <button className="btn danger iconbtn" onClick={() => removeField(f.id)}>Delete</button>
                  </div>
                </div>
              ))}
              {!fields.length && <div className="sub" style={{ marginBottom: 8 }}>No fields yet. Add what the chatbot should collect.</div>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="Example: Budget, City, Company Name" value={newField}
                onChange={(e) => setNewField(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') add('field') }} />
              <button className="btn primary" onClick={() => add('field')}>+ Add Field</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
