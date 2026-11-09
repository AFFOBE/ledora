require('dotenv').config()
const mongoose = require('mongoose')
const env = require('../config/env')
const User = require('../models/User')
const Business = require('../models/Business')
const ChatbotConfig = require('../models/ChatbotConfig')
const Lead = require('../models/Lead')
const Link = require('../models/Link')
const { MeetingConfig, Meeting } = require('../models/Meeting')
const Subscription = require('../models/Subscription')

const DEMO = {
  name: 'AFFOBE',
  email: 'demo@affobe.com',
  password: 'demo1234',
  phone: '+91 98765 43210',
}

const leads = [
  { source: 'chatbot', name: 'Pooja Sharma', service: 'Website', req: 'Need a new website for my clinic', date: '2026-10-06', status: 'New', phone: '9898989801', email: 'pooja@gmail.com' },
  { source: 'link', name: 'Rahul Verma', service: 'CRM Setup', req: 'Want CRM for my dealership', date: '2026-10-05', status: 'Contacted', phone: '9876543211', email: 'rahul@gmail.com' },
  { source: 'chatbot', name: 'Amit Patel', service: 'Social Media', req: 'Monthly posts for my restaurant', date: '2026-10-04', status: 'Qualified', phone: '9823456712', email: 'amit@gmail.com' },
  { source: 'link', name: 'Sneha Singh', service: 'SEO', req: 'Rank my ecommerce store higher', date: '2026-10-03', status: 'Won', phone: '9654321098', email: 'sneha@gmail.com' },
  { source: 'chatbot', name: 'Karan Mehta', service: 'App', req: 'Android + iOS app for delivery', date: '2026-10-02', status: 'Lost', phone: '9012387654', email: 'karan@gmail.com' },
  { source: 'chatbot', name: 'Neha Gupta', service: 'Branding', req: 'Full branding kit', date: '2026-10-06', status: 'New', phone: '9988776655', email: 'neha@gmail.com' },
  { source: 'link', name: 'Vikas Rao', service: 'WhatsApp API', req: 'Bulk whatsapp integration', date: '2026-10-01', status: 'Contacted', phone: '9345678901', email: 'vikas@gmail.com' },
]

const weekly = [
  { day: 'Mon', start: '10:00', end: '18:00', closed: false },
  { day: 'Tue', start: '10:00', end: '18:00', closed: false },
  { day: 'Wed', start: '10:00', end: '18:00', closed: false },
  { day: 'Thu', start: '10:00', end: '18:00', closed: false },
  { day: 'Fri', start: '10:00', end: '18:00', closed: false },
  { day: 'Sat', start: '11:00', end: '15:00', closed: false },
  { day: 'Sun', start: '', end: '', closed: true },
]

const run = async () => {
  await mongoose.connect(env.MONGO_URI)
  console.log('Connected — seeding...')

  await Promise.all([
    User.deleteMany({}),
    Business.deleteMany({}),
    ChatbotConfig.deleteMany({}),
    Lead.deleteMany({}),
    Link.deleteMany({}),
    MeetingConfig.deleteMany({}),
    Meeting.deleteMany({}),
    Subscription.deleteMany({}),
    require('../models/SocialPlan').deleteMany({}),
  ])

  const user = await User.create(DEMO)

  const business = await Business.create({
    userId: user._id,
    name: 'AFFOBE',
    category: 'Software Development',
    owner: 'AFFOBE Team',
    email: 'hello@affobe.com',
    phone: '+91 98765 43210',
    city: 'Indore, MP',
    website: 'www.affobe.com',
    establishedYear: '2023',
    about: 'We build AI-powered websites, apps and marketing systems for growing businesses.',
    audience: 'Small business owners and startups (30-50)',
    tone: 'Professional & expert',
    goal: 'Brand awareness',
    product: 'AI-driven marketing',
    postingTime: '06:00 PM',
    avoid: 'Nobody',
    accounts: [
      { platformId: 'instagram', name: 'Instagram', icon: 'IG', color: '#e1306c', handle: '@affobe' },
      { platformId: 'facebook', name: 'Facebook', icon: 'FB', color: '#1877f2', handle: '@affobe' },
      { platformId: 'linkedin', name: 'LinkedIn', icon: 'IN', color: '#0a66c2', handle: '@affobe' },
      { platformId: 'x', name: 'X (Twitter)', icon: 'X', color: '#101828', handle: '@affobe' },
    ],
  })

  await ChatbotConfig.create({
    userId: user._id,
    chatbotName: 'AFFOBE Assistant',
    welcomeMessage: 'Hi 👋 Welcome to AFFOBE. How can I help you?',
    autoOpen: 'After 3 seconds',
    services: [
      { id: 1, name: 'AI Website Development', enabled: true },
      { id: 2, name: 'Digital Marketing', enabled: true },
      { id: 3, name: 'SEO & Google Ranking', enabled: true },
      { id: 4, name: 'WhatsApp / CRM Automation', enabled: true },
    ],
    fields: [
      { id: 1, name: 'Name', type: 'text', required: true, enabled: true },
      { id: 2, name: 'Phone Number', type: 'phone', required: true, enabled: true },
      { id: 3, name: 'Email', type: 'email', required: false, enabled: true },
      { id: 4, name: 'Requirement', type: 'text', required: true, enabled: true },
    ],
  })

  const link = await Link.create({
    userId: user._id,
    name: 'Website Enquiry',
    slug: 'website-enquiry',
    url: `${env.CLIENT_URL}/l/website-enquiry`,
    leadsCount: 2,
  })

  await Lead.insertMany(
    leads.map((l) => ({
      userId: user._id,
      linkId: l.source === 'link' ? link._id : null,
      ...l,
    }))
  )

  await MeetingConfig.create({ userId: user._id, weekly, duration: '30 minutes' })
  await Meeting.create({
    userId: user._id,
    name: 'Pooja Sharma',
    service: 'Website',
    phone: '9898989801',
    day: 'Tue',
    date: '2026-10-10',
    time: '11:30',
    duration: '30 minutes',
    status: 'Booked',
  })

  await Subscription.create({
    userId: user._id,
    type: 'chatbot',
    plan: 'yearly',
    price: 2999,
    status: 'active',
    renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  })

  console.log('Seed complete. Demo login:')
  console.log(`  Email: ${DEMO.email}`)
  console.log(`  Password: ${DEMO.password}`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})