import { useEffect, useState } from 'react'
import { api } from '../api/client'

const START_OPTIONS = [
  'Website',
  'Mobile App',
  'Digital Marketing',
  'Social Media Management',
  'SEO',
  'E-commerce',
  'Other',
]

const getSlug = () => {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] === 'l' && parts.length >= 2) return decodeURIComponent(parts[1])
  return decodeURIComponent(parts[parts.length - 1] || '')
}

export default function PublicLeadForm() {
  const slug = getSlug()
  const params = new URLSearchParams(window.location.search)
  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [metaLoading, setMetaLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api(`/public/links/${encodeURIComponent(slug)}`, { auth: false })
      .then((data) => {
        if (!cancelled) setMeta(data)
      })
      .catch((e) => {
        if (!cancelled) setMetaError(e.message || 'This link is invalid or has been removed.')
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const bizName = (meta && meta.businessName) || params.get('b') || 'Business'

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    budget: '',
    start: '',
  })
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState('')

  const set = (k) => (e) => {
    const val = e.target.value
    setForm((f) => ({ ...f, [k]: val }))
    setErrors((er) => ({ ...er, [k]: '' }))
  }

  const validate = () => {
    const er = {}
    if (!form.name.trim()) er.name = 'Please enter your name'
    if (!form.phone.trim()) er.phone = 'Please enter your phone number'
    else if (!/^[0-9+\-\s()]{6,20}$/.test(form.phone.trim())) er.phone = 'Please enter a valid phone number'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) er.email = 'Please enter a valid email'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSending(true)
    setServerError('')

    const reqParts = []
    if (form.budget.trim()) reqParts.push(`Budget: ${form.budget.trim()}`)
    if (form.start) reqParts.push(`Start with: ${form.start}`)
    const req = reqParts.join(' | ')

    try {
      await api('/leads/capture', {
        method: 'POST',
        auth: false,
        body: {
          source: 'link',
          slug,
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          service: form.start || 'General Enquiry',
          req,
          website: '',
        },
      })
      setDone(true)
    } catch (e) {
      setServerError(e.message || 'Could not submit your details. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.banner}>
          <div style={styles.logo}>{(bizName || 'B').charAt(0).toUpperCase()}</div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={styles.bizName}>{bizName}</div>
            <div style={styles.bannerSub}>We would love to hear about your project</div>
          </div>
        </div>

        {metaLoading ? (
          <div style={styles.note}>
            <h2 style={styles.noteTitle}>Loading…</h2>
            <p style={styles.noteText}>Checking this enquiry link.</p>
          </div>
        ) : metaError ? (
          <div style={styles.note}>
            <h2 style={styles.noteTitle}>Link unavailable</h2>
            <p style={styles.noteText}>{metaError}</p>
          </div>
        ) : done ? (
          <div style={styles.success}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={{ margin: '0 0 8px' }}>Thank you, {form.name.trim().split(' ')[0]}!</h2>
            <p style={{ margin: 0, color: '#667085' }}>
              Your details have been sent to {bizName}. Our team will contact you soon.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={styles.form} autoComplete="off">
            <h2 style={styles.title}>Share your details</h2>
            <p style={styles.subtitle}>Fill the form below and our team will get back to you.</p>

            <input type="text" name="website" tabIndex="-1" autoComplete="off" style={{ position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true" />

            <div style={styles.field}>
              <label style={styles.label}>Full Name *</label>
              <input style={styles.input} placeholder="Enter your name" value={form.name} onChange={set('name')} />
              {errors.name && <div style={styles.error}>{errors.name}</div>}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Phone Number *</label>
              <input style={styles.input} placeholder="Enter your phone number" value={form.phone} onChange={set('phone')} />
              {errors.phone && <div style={styles.error}>{errors.phone}</div>}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" placeholder="Enter your email" value={form.email} onChange={set('email')} />
              {errors.email && <div style={styles.error}>{errors.email}</div>}
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Budget</label>
              <input style={styles.input} placeholder="e.g. ₹25,000 - ₹50,000" value={form.budget} onChange={set('budget')} />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Where do you want to start your project?</label>
              <select style={styles.input} value={form.start} onChange={set('start')}>
                <option value="">Select an option</option>
                {START_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {serverError && <div style={{ ...styles.error, marginBottom: 10 }}>{serverError}</div>}

            <button type="submit" style={styles.submit} disabled={sending}>
              {sending ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        )}

        <div style={styles.footer}>
          Powered by <b style={{ color: '#6D33E7' }}>Ledora</b>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: 'linear-gradient(135deg, #1a1033 0%, #2b1a55 45%, #12203f 100%)',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: 460,
    background: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,.35)',
  },
  banner: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '26px 24px',
    background: 'linear-gradient(135deg, #6D33E7 0%, #384FE7 100%)',
    color: '#fff',
    overflow: 'hidden',
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: 'rgba(255,255,255,.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    position: 'relative',
    zIndex: 1,
    flexShrink: 0,
  },
  bizName: {
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.2,
    wordBreak: 'break-word',
  },
  bannerSub: {
    fontSize: 12.5,
    opacity: 0.85,
    marginTop: 3,
  },
  form: {
    padding: '24px 24px 8px',
  },
  title: {
    margin: '0 0 4px',
    fontSize: 19,
    color: '#101828',
  },
  subtitle: {
    margin: '0 0 18px',
    fontSize: 13,
    color: '#667085',
  },
  field: {
    marginBottom: 14,
  },
  label: {
    display: 'block',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#344054',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 13px',
    fontSize: 14,
    color: '#101828',
    background: '#f9fafb',
    border: '1px solid #d0d5dd',
    borderRadius: 10,
    outline: 'none',
  },
  error: {
    marginTop: 5,
    fontSize: 12,
    color: '#d92d20',
  },
  submit: {
    width: '100%',
    marginTop: 6,
    padding: '13px 16px',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    background: 'linear-gradient(135deg, #6D33E7 0%, #384FE7 100%)',
    border: 0,
    borderRadius: 10,
    cursor: 'pointer',
  },
  success: {
    padding: '40px 26px',
    textAlign: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    margin: '0 auto 16px',
    borderRadius: '50%',
    background: '#e7f8ef',
    color: '#12b76a',
    fontSize: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: '14px 24px 20px',
    textAlign: 'center',
    fontSize: 12.5,
    color: '#98a2b3',
  },
  note: {
    padding: '36px 26px',
    textAlign: 'center',
  },
  noteTitle: {
    margin: '0 0 8px',
    fontSize: 19,
    color: '#101828',
  },
  noteText: {
    margin: 0,
    fontSize: 13.5,
    color: '#667085',
    lineHeight: 1.5,
  },
}
