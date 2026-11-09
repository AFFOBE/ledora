import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PublicLeadForm from './pages/PublicLeadForm.jsx'
import WidgetChat from './pages/WidgetChat.jsx'

try {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('ledora_theme') || 'dark')
} catch { /* ignore */ }

const path = window.location.pathname
const isPublicLink = path.startsWith('/l/')
const widgetMatch = path.match(/^\/widget\/([^/]+)/)

let screen = <App />
if (widgetMatch) screen = <WidgetChat botId={decodeURIComponent(widgetMatch[1])} />
else if (isPublicLink) screen = <PublicLeadForm />

createRoot(document.getElementById('root')).render(<StrictMode>{screen}</StrictMode>)
