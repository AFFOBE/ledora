import { AppProvider, useApp } from './context/AppContext'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Toast from './components/ui/Toast'
import LeadDrawer from './components/leads/LeadDrawer'
import SocialAccountsDrawer from './components/social/SocialAccountsDrawer'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import Chatbot from './pages/Chatbot'
import ChatbotLeads from './pages/ChatbotLeads'
import LeadLinks from './pages/LeadLinks'
import LinkLeads from './pages/LinkLeads'
import Integration from './pages/Integration'
import MeetingTime from './pages/MeetingTime'
import Subscription from './pages/Subscription'
import BusinessOnboard from './pages/BusinessOnboard'
import SocialMedia from './pages/social/SocialMedia'

function ActivePage() {
  const { page } = useApp()
  switch (page) {
    case 'dash': return <Dashboard />
    case 'social': return <SocialMedia />
    case 'bot': return <Chatbot />
    case 'chatleads': return <ChatbotLeads />
    case 'links': return <LeadLinks />
    case 'linkleads': return <LinkLeads />
    case 'integration': return <Integration />
    case 'meeting': return <MeetingTime />
    case 'subscription': return <Subscription />
    case 'onboard': return <BusinessOnboard />
    default: return <Dashboard />
  }
}

function Shell() {
  return (
    <>
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className="content">
          <ActivePage />
        </div>
      </main>
      <Toast />
      <LeadDrawer />
      <SocialAccountsDrawer />
    </>
  )
}

function Root() {
  const { authReady, user } = useApp()

  if (!authReady) {
    return (
      <div className="splash">
        <div className="authlogo">◉</div>
        <div className="sub">Loading your workspace…</div>
      </div>
    )
  }

  return user ? <Shell /> : <AuthPage />
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  )
}
