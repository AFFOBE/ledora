const mongoose = require('mongoose')
const User = require('../models/User')
const Business = require('../models/Business')
const ChatbotConfig = require('../models/ChatbotConfig')
const Lead = require('../models/Lead')
const Link = require('../models/Link')
const { MeetingConfig, Meeting } = require('../models/Meeting')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const DEFAULT_WEEKLY = [
  { day: 'Mon', start: '10:00', end: '18:00', closed: false },
  { day: 'Tue', start: '10:00', end: '18:00', closed: false },
  { day: 'Wed', start: '10:00', end: '18:00', closed: false },
  { day: 'Thu', start: '10:00', end: '18:00', closed: false },
  { day: 'Fri', start: '10:00', end: '18:00', closed: false },
  { day: 'Sat', start: '11:00', end: '15:00', closed: false },
  { day: 'Sun', start: '', end: '', closed: true },
]

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmt12 = (t) => {
  const [hRaw, m] = String(t).split(':')
  const h = Number(hRaw)
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`
}

const clean = (v, max = 500) => String(v || '').trim().slice(0, max)

const getBot = asyncHandler(async (req, res) => {
  const { botId } = req.params
  if (!mongoose.isValidObjectId(botId)) throw new ApiError(404, 'Chatbot not found')

  const [user, business, config] = await Promise.all([
    User.findOne({ _id: botId, isActive: true }).select('name').lean(),
    Business.findOne({ userId: botId }).lean(),
    ChatbotConfig.findOne({ userId: botId }).lean(),
  ])
  if (!user) throw new ApiError(404, 'Chatbot not found')

  res.setHeader('Cache-Control', 'public, max-age=60')
  res.json(
    ApiResponse(200, {
      botId,
      business: business
        ? {
            name: business.name,
            cat: business.category,
            owner: business.owner,
            city: business.city,
            about: business.about,
            email: business.email,
            phone: business.phone,
            site: business.website,
            year: business.establishedYear,
          }
        : { name: user.name },
      chatbot: {
        chatbotName: (config && config.chatbotName) || `${user.name} Assistant`,
        welcomeMessage: (config && config.welcomeMessage) || `Hi! Welcome to ${user.name}. How can I help you?`,
        autoOpen: (config && config.autoOpen) || 'Immediately',
        services: ((config && config.services) || []).filter((s) => s.enabled !== false),
        fields: ((config && config.fields) || []).filter((f) => f.enabled !== false),
      },
    })
  )
})

const nextSlot = async (userId) => {
  const config = await MeetingConfig.findOne({ userId }).lean()
  const weekly = config && config.weekly && config.weekly.length ? config.weekly : DEFAULT_WEEKLY
  const duration = (config && config.duration) || '30 minutes'

  for (let offset = 1; offset <= 14; offset += 1) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offset)
    const short = SHORT[d.getDay()]
    const rule = weekly.find((w) => w.day === short)
    if (!rule || rule.closed || !rule.start) continue

    return {
      day: FULL[d.getDay()],
      date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      raw: isoOf(d),
      time: rule.start,
      timeLabel: fmt12(rule.start),
      dur: duration,
    }
  }

  const d = new Date()
  d.setDate(d.getDate() + 1)
  return {
    day: FULL[d.getDay()],
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    raw: isoOf(d),
    time: '10:00',
    timeLabel: '10:00 AM',
    dur: duration,
  }
}

const captureLead = asyncHandler(async (req, res) => {
  if (req.body.website || req.body.hp || req.body.company_url || req.body.url_check) {
    return res.status(200).json(ApiResponse(200, { ok: true }, 'Received'))
  }

  const { botId } = req.params
  if (!mongoose.isValidObjectId(botId)) throw new ApiError(404, 'Chatbot not found')

  const [user, business] = await Promise.all([
    User.findOne({ _id: botId, isActive: true }).select('name').lean(),
    Business.findOne({ userId: botId }).lean(),
  ])
  if (!user) throw new ApiError(404, 'Chatbot not found')

  const name = clean(req.body.name, 80)
  const phone = clean(req.body.phone, 25)
  const email = clean(req.body.email, 120)
  const request = clean(req.body.req, 2000)
  const service = clean(req.body.service, 120) || 'General Enquiry'

  if (!name) throw new ApiError(400, 'Name is required')
  if (!phone && !email) throw new ApiError(400, 'Phone or email is required')
  if (phone && !/^[0-9+\-\s()]{6,25}$/.test(phone)) throw new ApiError(400, 'Please enter a valid phone number')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Please enter a valid email')

  const slot = await nextSlot(botId)
  const meeting = await Meeting.create({
    userId: botId,
    name,
    service,
    phone,
    day: slot.day,
    date: slot.raw,
    time: slot.time,
    duration: slot.dur,
    status: 'Booked',
  })

  const meetingSummary = `${slot.day}, ${slot.date} at ${slot.timeLabel} (${slot.dur})`
  const lead = await Lead.create({
    userId: botId,
    source: 'chatbot',
    name,
    service,
    req: request,
    phone,
    email,
    meetingSummary,
  })

  const bizName = (business && business.name) || user.name
  const reminder = `Hello ${name}, thank you for your interest in ${bizName}. Your meeting is booked on ${slot.day}, ${slot.date} at ${slot.timeLabel} (${slot.dur}) regarding your ${service} enquiry. ${bizName}`

  res.status(201).json(
    ApiResponse(
      201,
      {
        lead,
        meeting: {
          id: meeting._id,
          day: slot.day,
          date: slot.date,
          raw: slot.raw,
          time: slot.time,
          timeLabel: slot.timeLabel,
          dur: slot.dur,
          status: 'Booked',
        },
        reminder,
      },
      'Lead captured and meeting booked'
    )
  )
})

const getLink = asyncHandler(async (req, res) => {
  const link = await Link.findOne({ slug: req.params.slug }).lean()
  if (!link) throw new ApiError(404, 'Link not found')
  const business = await Business.findOne({ userId: link.userId }).select('name').lean()
  res.json(ApiResponse(200, { name: link.name, slug: link.slug, businessName: (business && business.name) || 'Business' }))
})

module.exports = { getBot, captureLead, getLink }
