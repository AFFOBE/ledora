import { useState } from 'react'
import { useApp } from '../context/AppContext'

export default function AuthPage() {
  const { login, register, authBusy } = useApp()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password)
      } else {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    }
  }

  return (
    <div className="authwrap">
      <div className="authbrand">
        <div className="authlogo">◉</div>
        <h1>Ledora</h1>
        <p>Your AI chatbot, lead capture and social media command center.</p>
        <ul>
          <li>Capture leads 24/7 from your website</li>
          <li>Book meetings automatically</li>
          <li>Generate a month of social content</li>
        </ul>
      </div>

      <form className="authcard" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="sub">
          {mode === 'login' ? 'Sign in to manage your business.' : 'Start capturing leads in a few minutes.'}
        </p>

        {mode === 'register' && (
          <div className="field">
            <label>Full name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Your name" required maxLength={80} />
          </div>
        )}

        <div className="field">
          <label>Email</label>
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@business.com" required autoComplete="email" />
        </div>

        {mode === 'register' && (
          <div className="field">
            <label>Phone (optional)</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" maxLength={20} />
          </div>
        )}

        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="At least 6 characters"
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button className="btn primary auth-submit" type="submit" disabled={authBusy}>
          {authBusy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="auth-switch"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
          }}
        >
          {mode === 'login' ? "New here? Create an account" : 'Already have an account? Sign in'}
        </button>

        {mode === 'login' && import.meta.env.DEV && (
          <div className="auth-demo">
            Demo account: <b>demo@affobe.com</b> / <b>demo1234</b>
          </div>
        )}
      </form>
    </div>
  )
}
