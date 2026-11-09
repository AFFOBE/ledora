import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, getToken, setToken, clearToken } from '../api/client'
import { DEFAULT_NOTIFY_PHONE, SM_PLANS, SM_PLATFORMS } from '../data/mock'
import { fmt12 } from '../utils/helpers'

const AppContext = createContext(null)

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const prettyDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const rawDate = (iso) => {
  if (!iso) return ''
  if (iso instanceof Date) {
    if (Number.isNaN(iso.getTime())) return ''
    return `${iso.getFullYear()}-${String(iso.getMonth() + 1).padStart(2, '0')}-${String(iso.getDate()).padStart(2, '0')}`
  }
  return String(iso).slice(0, 10)
}

const autoMeetingStatus = (iso) => {
  if (!iso) return 'Upcoming'
  const d = new Date(`${rawDate(iso)}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  if (d < today) return 'Completed'
  if (d.getTime() === today.getTime()) return 'Today'
  return 'Upcoming'
}

const mapLead = (l) => ({
  id: l._id,
  name: l.name,
  service: l.service,
  req: l.req,
  date: rawDate(l.date || l.createdAt),
  status: l.status || 'New',
  phone: l.phone || '',
  email: l.email || '',
  meeting: l.meetingSummary || '',
  link: (l.linkId && l.linkId.name) || 'Lead Link',
})

const mapMeeting = (m) => ({
  id: m._id,
  name: m.name,
  service: m.service,
  phone: m.phone || '',
  day: m.day,
  date: prettyDate(m.date),
  raw: rawDate(m.date),
  time: fmt12(m.time),
  rawTime: m.time,
  dur: m.duration || '30 minutes',
  status: m.status === 'Rescheduled' || m.status === 'Cancelled' ? m.status : autoMeetingStatus(m.date),
})

const mapLink = (l) => ({
  id: l._id,
  name: l.name,
  url: l.url,
  slug: l.slug,
  leads: l.leadsCount || 0,
})

const mapSubscription = (sub, social) => {
  const out = []

  if (sub) {
    out.push({
      id: 'chatbot',
      name: 'Ledora Chatbot',
      icon: 'AI',
      plan: sub.plan === 'yearly' ? 'AI Chatbot - Yearly' : 'AI Chatbot - Monthly',
      price: sub.price,
      billing: sub.plan === 'yearly' ? 'year' : 'month',
      started: prettyDate(sub.startDate),
      validTill: prettyDate(sub.renewalDate),
      validRaw: rawDate(sub.renewalDate),
      autoRenew: Boolean(sub.autoRenew),
    })
  }

  if (social) {
    const created = social.createdAt || social.startDate
    const renewal = new Date(created)
    renewal.setFullYear(renewal.getFullYear() + 1)
    const billing = social.billing === 'monthly' ? 'month' : 'year'
    const paid = Number.isFinite(social.amountPaid) ? social.amountPaid : social.price
    out.push({
      id: 'social',
      name: 'Social Media Management',
      icon: 'SM',
      plan: `${social.name} - ${billing === 'year' ? 'Yearly' : 'Monthly'}`,
      price: paid,
      billing,
      started: prettyDate(created),
      validTill: prettyDate(renewal),
      validRaw: rawDate(renewal),
      autoRenew: Boolean(social.autoRenew),
    })
  }

  return out
}

const inferFieldType = (name) => {
  const n = String(name).toLowerCase()
  if (/(phone|mobile|whatsapp|contact)/.test(n)) return 'phone'
  if (n.includes('email') || n.includes('mail')) return 'email'
  return 'text'
}

export function AppProvider({ children }) {
  const [page, setPage] = useState('dash')
  const [toastMsg, setToastMsg] = useState('')
  const [toastShow, setToastShow] = useState(false)
  const toastTimer = useRef(null)

  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [expiryDone, setExpiryDone] = useState(false)

  const [bot, setBot] = useState({
    chatbotName: 'AI Assistant',
    welcomeMessage: 'Hi! Welcome. How can I help you today?',
    autoOpen: 'Immediately',
  })
  const [services, setServices] = useState([])
  const [fields, setFields] = useState([])
  const [chatData, setChatData] = useState([])
  const [linkData, setLinkData] = useState([])
  const [linkLeads, setLinkLeads] = useState([])
  const [meetings, setMeetings] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [notifications, setNotifications] = useState([])

  const [sm, setSm] = useState({
    planId: null,
    plan: null,
    biz: null,
    items: [],
    video: true,
    paid: false,
    socialStep: 'plans',
    billing: 'monthly',
    resumeCheckout: false,
    generation: null,
    brand: null,
    autoPublish: true,
  })

  const [accountsOpen, setAccountsOpen] = useState(false)
  const [accChecked, setAccChecked] = useState([])
  const [accHandles, setAccHandles] = useState({})

  const [leadDrawer, setLeadDrawer] = useState({ open: false, type: null, id: null })

  const showToast = useCallback((msg) => {
    setToastMsg(msg)
    setToastShow(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastShow(false), 2200)
  }, [])

  const go = useCallback((p) => setPage(p), [])

  const applyBot = useCallback((config) => {
    if (!config) return
    setBot({
      chatbotName: config.chatbotName || 'AI Assistant',
      welcomeMessage: config.welcomeMessage || 'Hi! Welcome. How can I help you today?',
      autoOpen: config.autoOpen || 'Immediately',
    })
    setServices(
      (config.services || []).map((s, i) => ({ id: s.id || i + 1, name: s.name, enabled: s.enabled !== false }))
    )
    setFields(
      (config.fields || []).map((f, i) => ({
        id: f.id || i + 1,
        name: f.name,
        type: f.type || inferFieldType(f.name),
        required: f.required !== false,
        enabled: f.enabled !== false,
      }))
    )
  }, [])

  const applyBusiness = useCallback((biz) => {
    const accounts = (biz && biz.accounts) || []
    setAccChecked(accounts.map((a) => a.platformId))
    setAccHandles(Object.fromEntries(accounts.map((a) => [a.platformId, a.handle || ''])))
  }, [])

  const loadLeads = useCallback(async () => {
    const [chat, link] = await Promise.all([
      api('/leads?source=chatbot&limit=200'),
      api('/leads?source=link&limit=200'),
    ])
    setChatData(((chat && chat.leads) || []).map(mapLead))
    setLinkLeads(((link && link.leads) || []).map(mapLead))
  }, [])

  const loadLinks = useCallback(async () => {
    const links = await api('/links')
    setLinkData((links || []).map(mapLink))
  }, [])

  const loadMeetings = useCallback(async () => {
    const list = await api('/meetings')
    setMeetings((list || []).map(mapMeeting))
  }, [])

  const applySocial = useCallback((social) => {
    if (!social) return
    const saved = social.plan
    const meta = saved ? SM_PLANS.find((p) => p.id === saved.id) : null
    setSm((s) => ({
      ...s,
      planId: saved ? saved.id : s.planId,
      plan: saved ? { ...(meta || {}), ...saved, tag: (meta && meta.tag) || '', feats: (meta && meta.feats) || [] } : s.plan,
      items: Array.isArray(social.creatives) ? social.creatives : s.items,
      video: saved ? Boolean(saved.video) : s.video,
      paid: saved ? Boolean(saved.paid) : s.paid,
      billing: saved && saved.billing ? saved.billing : s.billing,
      generation: social.generation || s.generation,
      brand: social.brand || s.brand,
      autoPublish: social.autoPublish !== false,
    }))
  }, [])

  const hydrate = useCallback(async () => {
    setDataLoading(true)
    try {
      const state = await api('/auth/state')
      setUser(state.user)
      applyBot(state.chatbot)
      applyBusiness(state.business)

      if (state.business) setSm((s) => ({ ...s, biz: state.business }))

      const [social, sub] = await Promise.all([
        api('/social/dashboard').catch(() => null),
        api('/subscription').catch(() => null),
      ])

      applySocial(social)
      setSubscriptions(mapSubscription(sub, social && social.plan))

      await Promise.allSettled([loadLeads(), loadLinks(), loadMeetings()])
    } finally {
      setDataLoading(false)
    }
  }, [applyBot, applyBusiness, applySocial, loadLeads, loadLinks, loadMeetings])

  const refreshBilling = useCallback(async () => {
    const [social, sub] = await Promise.all([
      api('/social/dashboard').catch(() => null),
      api('/subscription').catch(() => null),
    ])
    applySocial(social)
    setSubscriptions(mapSubscription(sub, social && social.plan))
    return { social, sub }
  }, [applySocial])

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null)
      setPage('dash')
    }
    window.addEventListener('ledora:unauthorized', onUnauthorized)
    return () => window.removeEventListener('ledora:unauthorized', onUnauthorized)
  }, [])

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      if (!getToken()) {
        setAuthReady(true)
        return
      }
      try {
        await hydrate()
      } catch {
        clearToken()
        setUser(null)
      } finally {
        if (!cancelled) setAuthReady(true)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [hydrate])

  const login = useCallback(async (email, password) => {
    setAuthBusy(true)
    try {
      const data = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false })
      setToken(data.token)
      setUser(data)
      setExpiryDone(false)
      await hydrate()
      showToast('Welcome back')
      return data
    } finally {
      setAuthBusy(false)
    }
  }, [hydrate, showToast])

  const register = useCallback(async (payload) => {
    setAuthBusy(true)
    try {
      const data = await api('/auth/register', { method: 'POST', body: payload, auth: false })
      setToken(data.token)
      setUser(data)
      setExpiryDone(false)
      await hydrate()
      showToast('Account created')
      return data
    } finally {
      setAuthBusy(false)
    }
  }, [hydrate, showToast])

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setPage('dash')
    setExpiryDone(false)
    setBot({ chatbotName: 'AI Assistant', welcomeMessage: 'Hi! Welcome. How can I help you today?', autoOpen: 'Immediately' })
    setServices([])
    setFields([])
    setChatData([])
    setLinkData([])
    setLinkLeads([])
    setMeetings([])
    setSubscriptions([])
    setNotifications([])
    setSm({ planId: null, plan: null, biz: null, items: [], video: true, paid: false, socialStep: 'plans', billing: 'monthly', resumeCheckout: false, generation: null, brand: null, autoPublish: true })
    setAccChecked([])
    setAccHandles({})
    showToast('Logged out')
  }, [showToast])

  const persistBot = useCallback(async (next = {}) => {
    const payload = {
      chatbotName: next.chatbotName !== undefined ? next.chatbotName : bot.chatbotName,
      welcomeMessage: next.welcomeMessage !== undefined ? next.welcomeMessage : bot.welcomeMessage,
      autoOpen: next.autoOpen !== undefined ? next.autoOpen : bot.autoOpen,
      services: next.services !== undefined ? next.services : services,
      fields: next.fields !== undefined ? next.fields : fields,
    }
    const config = await api('/chatbot/config', { method: 'PUT', body: payload })
    applyBot(config)
    return config
  }, [applyBot, bot, fields, services])

  const addService = useCallback((name) => {
    const next = [...services, { id: Date.now(), name, enabled: true }]
    setServices(next)
    persistBot({ services: next }).then(() => showToast('Service added')).catch((e) => showToast(e.message))
  }, [persistBot, services, showToast])

  const removeService = useCallback((id) => {
    const next = services.filter((x) => x.id !== id)
    setServices(next)
    persistBot({ services: next }).then(() => showToast('Service removed')).catch((e) => showToast(e.message))
  }, [persistBot, services, showToast])

  const toggleService = useCallback((id) => {
    const next = services.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x))
    setServices(next)
    persistBot({ services: next }).then(() => showToast('Service updated')).catch((e) => showToast(e.message))
  }, [persistBot, services, showToast])

  const addField = useCallback((name) => {
    const next = [...fields, { id: Date.now(), name, type: inferFieldType(name), required: true, enabled: true }]
    setFields(next)
    persistBot({ fields: next }).then(() => showToast('Lead field added')).catch((e) => showToast(e.message))
  }, [fields, persistBot, showToast])

  const removeField = useCallback((id) => {
    const next = fields.filter((x) => x.id !== id)
    setFields(next)
    persistBot({ fields: next }).then(() => showToast('Lead field removed')).catch((e) => showToast(e.message))
  }, [fields, persistBot, showToast])

  const toggleField = useCallback((id) => {
    const next = fields.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x))
    setFields(next)
    persistBot({ fields: next }).then(() => showToast('Field updated')).catch((e) => showToast(e.message))
  }, [fields, persistBot, showToast])

  const saveBotConfig = useCallback(async (patch) => {
    try {
      await persistBot(patch)
      showToast('Chatbot settings saved')
    } catch (e) {
      showToast(e.message)
      throw e
    }
  }, [persistBot, showToast])

  const nextMeetingSlot = useCallback(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    let g = 0
    while (d.getDay() === 0 && g++ < 7) d.setDate(d.getDate() + 1)
    const day = d.getDay()
    const pref = String((sm.biz && sm.biz.time) || '').toLowerCase()
    const pool = day === 6
      ? ['11:00', '12:00', '13:00', '14:00']
      : pref.indexOf('morning') > -1
        ? ['10:00', '10:30', '11:00']
        : pref.indexOf('evening') > -1
          ? ['16:00', '17:00', '17:30']
          : ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00']
    const t = pool[chatData.length % pool.length]
    return {
      day: DAYS[day],
      date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: fmt12(t),
      raw: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      dur: '30 minutes',
    }
  }, [sm.biz, chatData.length])

  const captureChatLead = useCallback(async ({ name, phone, email, req, service }) => {
    if (!user || !user.id) throw new Error('Chatbot is not ready yet')
    const data = await api(`/public/bots/${user.id}/leads`, {
      method: 'POST',
      auth: false,
      body: { name, phone, email, req, service },
    })
    await Promise.all([loadLeads(), loadMeetings()])
    showToast('Lead saved + meeting set in Meeting Time')
    return {
      slot: { ...data.meeting, time: data.meeting.timeLabel },
      text: data.reminder,
      fallbackSlot: nextMeetingSlot(),
    }
  }, [user, loadLeads, loadMeetings, showToast, nextMeetingSlot])

  const updateLeadStatus = useCallback(async (type, id, status) => {
    if (type === 'chat') setChatData((d) => d.map((x) => (x.id === id ? { ...x, status } : x)))
    else setLinkLeads((l) => l.map((x) => (x.id === id ? { ...x, status } : x)))
    try {
      await api(`/leads/${id}`, { method: 'PATCH', body: { status } })
      showToast('Lead status updated')
    } catch (e) {
      await loadLeads()
      showToast(e.message)
    }
  }, [loadLeads, showToast])

  const updateMeetingStatus = useCallback((id, status) => {
    setMeetings((m) => m.map((x) => (x.id === id ? { ...x, status } : x)))
    showToast('Meeting status updated')
  }, [showToast])

  const rescheduleMeeting = useCallback(async (id, updates) => {
    setMeetings((m) => m.map((x) => (
      x.id === id
        ? { ...x, ...updates, time: fmt12(updates.time), rawTime: updates.time, status: 'Rescheduled' }
        : x
    )))
    if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
      try {
        await api(`/meetings/${id}/reschedule`, {
          method: 'PATCH',
          body: { day: updates.day, date: updates.raw, time: updates.time },
        })
        await loadMeetings()
      } catch (e) {
        await loadMeetings()
        showToast(e.message)
        return
      }
    }
    showToast('Meeting rescheduled')
  }, [loadMeetings, showToast])

  const deleteLead = useCallback(async (type, id) => {
    if (type === 'chat') setChatData((d) => d.filter((x) => x.id !== id))
    else setLinkLeads((l) => l.filter((x) => x.id !== id))
    try {
      await api(`/leads/${id}`, { method: 'DELETE' })
      showToast('Lead deleted')
    } catch (e) {
      await loadLeads()
      showToast(e.message)
    }
  }, [loadLeads, showToast])

  const createLink = useCallback(async (name) => {
    const link = await api('/links', { method: 'POST', body: { name } })
    const mapped = mapLink(link)
    setLinkData((d) => [mapped, ...d])
    showToast('Link created')
    return mapped.url
  }, [showToast])

  const smChoosePlan = useCallback((id) => {
    const plan = SM_PLANS.find((p) => p.id === id)
    setSm((s) => ({ ...s, planId: id, plan, socialStep: 'form' }))
  }, [])

  const smSetStep = useCallback((step) => setSm((s) => ({ ...s, socialStep: step })), [])
  const smSetBilling = useCallback((billing) => setSm((s) => ({ ...s, billing })), [])
  const smSetResumeCheckout = useCallback((resumeCheckout) => setSm((s) => ({ ...s, resumeCheckout })), [])

  const toggleAutoRenew = useCallback(async (id) => {
    const target = subscriptions.find((s) => s.id === id)
    if (!target) return
    const next = !target.autoRenew
    setSubscriptions((list) => list.map((s) => (s.id === id ? { ...s, autoRenew: next } : s)))
    try {
      await api('/subscription/auto-renew', { method: 'PATCH', body: { type: id, autoRenew: next } })
      showToast(`Auto renew ${next ? 'enabled' : 'disabled'}`)
    } catch (e) {
      setSubscriptions((list) => list.map((s) => (s.id === id ? { ...s, autoRenew: !next } : s)))
      showToast(e.message)
    }
  }, [subscriptions, showToast])

  const notifyExpiry = useCallback((sub, phone) => {
    const to = phone || DEFAULT_NOTIFY_PHONE
    const at = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    setNotifications((n) => [{
      id: Date.now() + Math.random(),
      sub: sub.name,
      phone: to,
      at,
      msg: `${sub.name} plan expires on ${sub.validTill}. Renew now to stay active.`,
    }, ...n])
    showToast(`Expiry reminder added for ${to}`)
  }, [showToast])

  useEffect(() => {
    if (expiryDone || !subscriptions.length) return
    const timer = setTimeout(() => {
      const soon = subscriptions.filter((s) => {
        if (!s.validRaw) return false
        const d = Math.ceil((new Date(s.validRaw + 'T23:59:59').getTime() - Date.now()) / 86400000)
        return d >= 0 && d <= 5
      })
      if (soon.length) {
        const phone = (sm.biz && sm.biz.phone) || DEFAULT_NOTIFY_PHONE
        soon.forEach((s) => notifyExpiry(s, phone))
        showToast(`Reminder: ${soon[0].name} plan expires soon - added for ${phone}`)
      }
      setExpiryDone(true)
    }, 600)
    return () => clearTimeout(timer)
  }, [subscriptions, sm.biz, notifyExpiry, showToast, expiryDone])

  const smSaveBiz = useCallback(async (biz) => {
    const payload = {
      ...biz,
      accounts: (biz.accounts || []).map((a) => ({
        platformId: String(a.platformId || a.id || ''),
        name: a.name,
        icon: a.icon,
        color: a.color,
        handle: a.handle,
      })),
    }
    const saved = await api('/business', { method: 'POST', body: payload })
    setSm((s) => ({ ...s, biz: saved }))
    applyBusiness(saved)
    return saved
  }, [applyBusiness])

  const smGenerateItems = useCallback(async (biz, planId, opts = {}) => {
    const target = biz || sm.biz
    if (target) {
      const payload = {
        ...target,
        accounts: (target.accounts || []).map((a) => ({
          platformId: String(a.platformId || a.id || ''),
          name: a.name,
          icon: a.icon,
          color: a.color,
          handle: a.handle,
        })),
      }
      const saved = await api('/business', { method: 'POST', body: payload })
      setSm((s) => ({ ...s, biz: saved }))
      applyBusiness(saved)
    }
    const data = await api('/social/generate', {
      method: 'POST',
      body: {
        planId: planId || sm.planId || 'advance',
        video: opts.video !== undefined ? Boolean(opts.video) : sm.video,
        billing: opts.billing || sm.billing || 'monthly',
        autoRenew: Boolean(opts.autoRenew),
      },
    })
    setSm((s) => ({
      ...s,
      items: data.items || s.items,
      plan: { ...s.plan, ...data.plan },
      generation: data.generation || s.generation,
      paid: true,
      socialStep: 'dash',
    }))
    showToast('AI content generation started')
    refreshBilling().catch(() => {})
    return data
  }, [applyBusiness, sm.biz, sm.planId, sm.video, sm.billing, showToast, refreshBilling])

  const refreshGeneration = useCallback(async () => {
    try {
      const data = await api('/social/generation')
      const generation = (data && data.generation) || null
      setSm((s) => ({ ...s, generation: generation || s.generation }))
      return generation
    } catch {
      return null
    }
  }, [])

  const smRetryMissing = useCallback(async () => {
    try {
      const data = await api('/social/generation/retry', { method: 'POST' })
      await refreshGeneration()
      showToast((data && data.retried ? `${data.retried} missing creatives are rendering` : 'All creatives are already ready'))
      refreshBilling().catch(() => {})
      return data
    } catch (e) {
      showToast(e.message)
      return null
    }
  }, [refreshGeneration, refreshBilling, showToast])

  const smScheduleAll = useCallback(async () => {
    try {
      const data = await api('/social/schedule-all', { method: 'POST' })
      showToast(
        data && data.scheduled
          ? `${data.scheduled} post${data.scheduled === 1 ? '' : 's'} added to the auto-publish queue`
          : 'Nothing new to schedule. Connect an account first.'
      )
      await refreshBilling()
      return data
    } catch (e) {
      showToast(e.message)
      return null
    }
  }, [refreshBilling, showToast])

  const smToggleAutoPublish = useCallback(async () => {
    const next = !sm.autoPublish
    setSm((s) => ({ ...s, autoPublish: next }))
    try {
      await api('/social/auto-publish', { method: 'PATCH', body: { autoPublish: next } })
      showToast(`Auto-publish ${next ? 'enabled' : 'disabled'}`)
    } catch (e) {
      setSm((s) => ({ ...s, autoPublish: !next }))
      showToast(e.message)
    }
  }, [sm.autoPublish, showToast])

  const smToggleVideo = useCallback(async () => {
    const next = !sm.video
    setSm((s) => ({ ...s, video: next }))
    if (sm.planId) {
      try {
        await api('/social/video', { method: 'PATCH', body: { video: next } })
      } catch (e) {
        setSm((s) => ({ ...s, video: sm.video }))
        showToast(e.message)
      }
    }
  }, [sm.video, sm.planId, showToast])

  const smToggleSchedule = useCallback(async (id) => {
    const target = sm.items.find((x) => x.id === id)
    if (!target) return
    const nextStatus = target.status === 'Scheduled' ? 'Draft' : 'Scheduled'
    setSm((s) => ({
      ...s,
      items: s.items.map((x) => (x.id === id ? { ...x, status: nextStatus, note: '' } : x)),
    }))
    if (typeof id === 'string') {
      try {
        await api(`/social/creatives/${id}`, { method: 'PATCH', body: { status: nextStatus } })
      } catch (e) {
        setSm((s) => ({
          ...s,
          items: s.items.map((x) => (x.id === id ? { ...x, status: target.status, note: target.note } : x)),
        }))
        showToast(e.message)
      }
    }
  }, [sm.items, showToast])

  const saveAccounts = useCallback(async () => {
    if (!sm.biz) {
      showToast('Please complete your business profile first')
      return false
    }
    const accounts = SM_PLATFORMS
      .filter((p) => accChecked.includes(p.id))
      .map((p) => ({
        platformId: p.id,
        name: p.name,
        icon: p.icon,
        color: p.color,
        handle: (accHandles[p.id] || '').trim(),
      }))
    try {
      await smSaveBiz({ ...sm.biz, accounts })
      showToast('Social accounts saved')
      return true
    } catch (e) {
      showToast(e.message)
      return false
    }
  }, [accChecked, accHandles, showToast, sm.biz, smSaveBiz])

  const toggleAccount = useCallback((id, checked) => {
    setAccChecked((c) => (checked ? [...new Set([...c, id])] : c.filter((x) => x !== id)))
  }, [])

  const setAccountHandle = useCallback((id, handle) => {
    setAccHandles((h) => ({ ...h, [id]: handle }))
  }, [])

  const openLead = useCallback((type, id) => setLeadDrawer({ open: true, type, id }), [])
  const closeLead = useCallback(() => setLeadDrawer({ open: false, type: null, id: null }), [])

  const value = useMemo(() => ({
    user,
    authReady,
    authBusy,
    dataLoading,
    refreshBilling,
    login,
    register,
    logout,
    page,
    go,
    toastMsg,
    toastShow,
    showToast,
    bot,
    saveBotConfig,
    services,
    addService,
    removeService,
    toggleService,
    fields,
    addField,
    removeField,
    toggleField,
    chatData,
    linkData,
    createLink,
    linkLeads,
    meetings,
    updateMeetingStatus,
    rescheduleMeeting,
    subscriptions,
    notifications,
    toggleAutoRenew,
    notifyExpiry,
    captureChatLead,
    updateLeadStatus,
    deleteLead,
    sm,
    smChoosePlan,
    smSetStep,
    smSetBilling,
    smSetResumeCheckout,
    smSaveBiz,
    smGenerateItems,
    refreshGeneration,
    smRetryMissing,
    smScheduleAll,
    smToggleAutoPublish,
    smToggleVideo,
    smToggleSchedule,
    accountsOpen,
    openAccounts: () => setAccountsOpen(true),
    closeAccounts: () => setAccountsOpen(false),
    accChecked,
    accHandles,
    toggleAccount,
    setAccountHandle,
    saveAccounts,
    leadDrawer,
    openLead,
    closeLead,
    smPlatforms: SM_PLATFORMS,
    smPlans: SM_PLANS,
    getHandle: (id) => accHandles[id] || '',
  }), [
    user, authReady, authBusy, dataLoading, refreshBilling, login, register, logout,
    page, go, toastMsg, toastShow, showToast,
    bot, saveBotConfig, services, addService, removeService, toggleService,
    fields, addField, removeField, toggleField,
    chatData, linkData, createLink, linkLeads, meetings, updateMeetingStatus, rescheduleMeeting,
    subscriptions, notifications, toggleAutoRenew, notifyExpiry, captureChatLead,
    updateLeadStatus, deleteLead, sm, smChoosePlan, smSetStep, smSetBilling, smSetResumeCheckout, smSaveBiz,
    smGenerateItems, smToggleVideo, smToggleSchedule, accountsOpen, accChecked,
    refreshGeneration, smRetryMissing, smScheduleAll, smToggleAutoPublish,
    accHandles, toggleAccount, setAccountHandle, saveAccounts, leadDrawer, openLead, closeLead,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
