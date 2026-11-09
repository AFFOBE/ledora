const SocialPlan = require('../models/SocialPlan')
const Business = require('../models/Business')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')
const { SM_PLANS } = require('../data/socialContent')
const { startGeneration, recoverMedia, isRunning } = require('../services/social/generation')
const { scheduleGeneratedContent } = require('../services/social/schedule')

const emptyGeneration = () => ({
  status: 'idle',
  phase: '',
  total: 0,
  completed: 0,
  failed: 0,
  message: '',
  startedAt: null,
  finishedAt: null,
})

const getPlans = asyncHandler(async (req, res) => {
  res.json(ApiResponse(200, SM_PLANS))
})

const getDashboard = asyncHandler(async (req, res) => {
  const record = await SocialPlan.findOne({ userId: req.user._id }).lean()
  const generation = (record && record.generation) || emptyGeneration()
  res.json(
    ApiResponse(200, {
      chosen: null,
      creatives: (record && record.items) || [],
      generation,
      brand: (record && record.brand) || null,
      autoPublish: record ? record.autoPublish !== false : true,
      plan: record
        ? {
            id: record.planId,
            name: record.planName,
            price: record.price,
            video: record.video,
            paid: record.paid,
            autoRenew: record.autoRenew,
            autoPublish: record.autoPublish !== false,
            billing: record.billing || 'yearly',
            amountPaid: typeof record.amountPaid === 'number' ? record.amountPaid : null,
            createdAt: record.createdAt,
          }
        : null,
    })
  )
})

const generate = asyncHandler(async (req, res) => {
  const { planId = 'advance', video = true, billing = 'monthly', autoRenew = false } = req.body
  const normalizedBilling = billing === 'yearly' ? 'yearly' : 'monthly'

  const plan = SM_PLANS.find((p) => p.id === planId)
  if (!plan) throw new ApiError(400, 'Invalid plan id')

  const business = await Business.findOne({ userId: req.user._id })
  if (!business) throw new ApiError(400, 'Please complete your business profile first')

  if (isRunning(req.user._id)) {
    const current = await SocialPlan.findOne({ userId: req.user._id }).lean()
    return res.status(202).json(
      ApiResponse(
        202,
        {
          plan: current ? { ...current, id: current.planId } : plan,
          items: (current && current.items) || [],
          generation: (current && current.generation) || emptyGeneration(),
        },
        'Your content is already being generated'
      )
    )
  }

  const baseAmount = plan.price * (normalizedBilling === 'yearly' ? 10 : 1)
  const amountPaid = baseAmount + Math.round(baseAmount * 0.18)

  const { started, record } = await startGeneration(req.user._id, {
    planId: plan.id,
    billing: normalizedBilling,
    video: Boolean(video),
    amountPaid,
    autoRenew,
  })

  const fresh = record && record.toObject ? record.toObject() : record
  res.status(202).json(
    ApiResponse(
      202,
      {
        plan: {
          id: plan.id,
          name: plan.name,
          price: plan.price,
          video: Boolean(video),
          paid: true,
          billing: normalizedBilling,
          amountPaid,
        },
        items: (fresh && fresh.items) || [],
        generation: (fresh && fresh.generation) || emptyGeneration(),
      },
      started ? 'AI content generation started' : 'Generation already running'
    )
  )
})

const generationStatus = asyncHandler(async (req, res) => {
  const record = await SocialPlan.findOne({ userId: req.user._id })
    .select('generation planId planName paid items.no items.mediaStatus')
    .lean()
  if (!record) {
    return res.json(ApiResponse(200, { generation: emptyGeneration(), itemCount: 0 }))
  }
  res.json(
    ApiResponse(200, {
      generation: record.generation || emptyGeneration(),
      itemCount: (record.items || []).length,
      planId: record.planId,
      paid: record.paid,
    })
  )
})

const retryGeneration = asyncHandler(async (req, res) => {
  if (isRunning(req.user._id)) throw new ApiError(409, 'Generation is already running')
  const record = await SocialPlan.findOne({ userId: req.user._id }).lean()
  if (!record) throw new ApiError(404, 'No content plan found')
  if (!record.items || !record.items.length) throw new ApiError(400, 'Generate the content plan first')

  const count = await recoverMedia(req.user._id)
  res.json(ApiResponse(200, { retried: count }, count ? 'Missing creatives are being rendered' : 'All creatives are already ready'))
})

const scheduleAll = asyncHandler(async (req, res) => {
  const count = await scheduleGeneratedContent(req.user._id)
  res.json(
    ApiResponse(
      200,
      { scheduled: count },
      count
        ? `${count} post${count === 1 ? '' : 's'} added to the auto-publish queue`
        : 'Nothing new to schedule. Connect an account or generate creatives first.'
    )
  )
})

const setAutoPublish = asyncHandler(async (req, res) => {
  const record = await SocialPlan.findOne({ userId: req.user._id })
  if (!record) throw new ApiError(404, 'No content plan found')
  record.autoPublish = Boolean(req.body.autoPublish)
  await record.save()
  res.json(ApiResponse(200, { autoPublish: record.autoPublish }, `Auto-publish ${record.autoPublish ? 'enabled' : 'disabled'}`))
})

const pay = asyncHandler(async (req, res) => {
  const { planId, name = 'offline' } = req.body
  const plan = SM_PLANS.find((p) => p.id === planId)
  if (!plan) throw new ApiError(400, 'Invalid plan id')

  let record = await SocialPlan.findOne({ userId: req.user._id })
  if (!record) {
    record = await SocialPlan.create({
      userId: req.user._id,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      paid: true,
      video: true,
      items: [],
      status: 'active',
    })
  }
  res.json(ApiResponse(200, record, `Payment received for ${plan.name} (${name})`))
})

const updateCreative = asyncHandler(async (req, res) => {
  const { id } = req.params
  const record = await SocialPlan.findOne({ userId: req.user._id })
  if (!record) throw new ApiError(404, 'No social plan found')

  const item = record.items.find((it) => it.id === id)
  if (!item) throw new ApiError(404, 'Creative not found')

  if (req.body.status) {
    if (!['Scheduled', 'Draft'].includes(req.body.status)) throw new ApiError(400, 'Invalid status')
    item.status = req.body.status
  }
  if (req.body.note !== undefined) item.note = String(req.body.note).slice(0, 300)
  if (req.body.title !== undefined) item.title = String(req.body.title).slice(0, 80)
  if (req.body.caption !== undefined) item.caption = String(req.body.caption).slice(0, 2200)
  if (req.body.hashtags !== undefined) item.hashtags = String(req.body.hashtags).slice(0, 500)
  if (req.body.cta !== undefined) item.cta = String(req.body.cta).slice(0, 160)

  await record.save()
  res.json(ApiResponse(200, item, 'Creative updated'))
})

const updateVideo = asyncHandler(async (req, res) => {
  const record = await SocialPlan.findOne({ userId: req.user._id })
  if (!record) throw new ApiError(404, 'No social plan found')
  record.video = Boolean(req.body.video)
  await record.save()
  res.json(ApiResponse(200, { video: record.video }, 'Video mode updated'))
})

module.exports = {
  getPlans,
  getDashboard,
  generate,
  generationStatus,
  retryGeneration,
  scheduleAll,
  setAutoPublish,
  pay,
  updateCreative,
  updateVideo,
}
