
import { useApp } from '../../context/AppContext'
import logo from '../../assets/logo.svg'

export default function Sidebar() {
  const { page, go, smSetStep } = useApp()

  const open = (id) => {
    if (id === 'social') smSetStep('plans')
    go(id)
  }

  const items = [
    { id: 'dash', label: 'Dashboard', icon: <i>▦</i> },
    {
      id: 'social',
      label: 'Social Media',
      icon: (
        <i className="navic">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </i>
      ),
    },
    { id: 'bot', label: 'AI Chatbot', icon: <i>◉</i> },
    { id: 'chatleads', label: 'Chatbot Leads', icon: <i>♧</i> },
    { id: 'links', label: 'Lead Links', icon: <i>↗</i> },
    { id: 'linkleads', label: 'Link Leads', icon: <i>☷</i> },
    { id: 'integration', label: 'Integration', icon: <i>⌘</i> },
    { id: 'meeting', label: 'Meetings', icon: <i>◷</i> },
    { id: 'subscription', label: 'Ledora Subscription', icon: <i>₹</i> },
    { id: 'onboard', label: 'Business Onboard', icon: <i>⚙</i> },
  ]

  return (
    <aside className="side">
      <div className="logo">
        <img className="logoimg" src={logo} alt="Ledora" />
        <b>Ledora</b>
      </div>

      <div className="nav">
        {items.map((it) => (
          <button
            key={it.id}
            className={page === it.id ? 'active' : ''}
            onClick={() => open(it.id)}
          >
            {it.icon}
            {it.label}
          </button>
        ))}
      </div>
    </aside>
  )
}
