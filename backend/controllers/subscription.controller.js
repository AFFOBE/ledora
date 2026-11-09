const Subscription = require('../models/Subscription')
const SocialPlan = require('../models/SocialPlan')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')
const { CHATBOT_PLANS } = require('../data/socialContent')

const getPlans = asyncHandler(async (req, res) => {
  res.json(ApiResponse(200, CHATBOT_PLANS))
})

const getMine = asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({ userId: req.user._id, type: 'chatbot', status: 'active' })
    .sort({ createdAt: -1 })
    .lean()
  res.json(ApiResponse(200, sub || null))
})

const createOrUpgrade = asyncHandler(async (req, res) => {
  const { plan = 'yearly' } = req.body
  const meta = CHATBOT_PLANS.find((p) => p.id === plan)
  if (!meta) throw new ApiError(400, 'Invalid plan id')

  const existing = await Subscription.findOne({ userId: req.user._id, type: 'chatbot', status: 'active' })
  if (existing) {
    existing.plan = meta.id
    existing.price = meta.price
    existing.status = 'active'
    existing.renewalDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    await existing.save()
    return res.json(ApiResponse(200, existing, 'Subscription renewed'))
  }

  const sub = await Subscription.create({
    userId: req.user._id,
    type: 'chatbot',
    plan: meta.id,
    price: meta.price,
    status: 'active',
    startDate: new Date(),
    renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  })

  await sub.populate('userId', 'name email')
  res.status(201).json(ApiResponse(201, sub, 'Subscription created'))
})

const toggleAutoRenew = asyncHandler(async (req, res) => {
  const type = req.body.type === 'social' ? 'social' : 'chatbot'
  const autoRenew = Boolean(req.body.autoRenew)

  if (type === 'social') {
    const record = await SocialPlan.findOne({ userId: req.user._id })
    if (!record) throw new ApiError(404, 'No social plan found')
    record.autoRenew = autoRenew
    await record.save()
    return res.json(ApiResponse(200, { type, autoRenew }, 'Auto renew updated'))
  }

  const sub = await Subscription.findOne({ userId: req.user._id, type: 'chatbot', status: 'active' }).sort({ createdAt: -1 })
  if (!sub) throw new ApiError(404, 'No active subscription found')
  sub.autoRenew = autoRenew
  await sub.save()
  res.json(ApiResponse(200, { type, autoRenew }, 'Auto renew updated'))
})

module.exports = { getPlans, getMine, createOrUpgrade, toggleAutoRenew }