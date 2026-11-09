const mongoose = require('mongoose')
const Lead = require('../models/Lead')
const Link = require('../models/Link')
const User = require('../models/User')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')

const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Won', 'Lost']

const list = asyncHandler(async (req, res) => {
  const { source, search, status, from, to, page = 1, limit = 50 } = req.query

  const query = { userId: req.user._id }

  if (source) query.source = source
  if (status) {
    if (!LEAD_STATUSES.includes(status)) throw new ApiError(400, 'Invalid status filter')
    query.status = status
  }
  if (from || to) {
    query.date = {}
    if (from) query.date.$gte = from
    if (to) query.date.$lte = to
  }
  if (search && search.trim()) {
    const term = search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(term, 'i')
    query.$or = [{ name: re }, { service: re }, { req: re }, { email: re }, { phone: re }]
  }

  const pageNum = Math.max(1, parseInt(page, 10))
  const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10)))
  const skip = (pageNum - 1) * pageSize

  const [leads, total, statusCounts] = await Promise.all([
    Lead.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .populate('linkId', 'name slug')
      .lean(),
    Lead.countDocuments(query),
    Lead.aggregate([
      { $match: { userId: req.user._id, ...(source ? { source } : {}) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ])

  const counts = { New: 0, Contacted: 0, Qualified: 0, Won: 0, Lost: 0 }
  statusCounts.forEach((s) => {
    counts[s._id] = s.count
  })

  res.json(
    ApiResponse(200, {
      leads,
      counts,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageSize),
    })
  )
})

const clean = (v, max = 500) => String(v || '').trim().slice(0, max)

const create = asyncHandler(async (req, res) => {
  if (req.body.website || req.body.hp || req.body.company_url || req.body.url_check) {
    return res.status(200).json(ApiResponse(200, { ok: true }, 'Received'))
  }

  const { source = 'chatbot', name, service = '', req: request = '', phone = '', email = '', slug, botId } = req.body

  if (!['chatbot', 'link'].includes(source)) throw new ApiError(400, 'Invalid source')

  const safeName = clean(name, 80)
  const safePhone = clean(phone, 25)
  const safeEmail = clean(email, 120)
  if (!safeName) throw new ApiError(400, 'Name is required')
  if (!safePhone && !safeEmail) throw new ApiError(400, 'Phone or email is required')

  let userId = null
  let linkId = null

  if (source === 'link') {
    if (!slug) throw new ApiError(400, 'Link slug is required')
    const link = await Link.findOne({ slug })
    if (!link) throw new ApiError(404, 'Link not found')
    userId = link.userId
    linkId = link._id
    await Link.updateOne({ _id: link._id }, { $inc: { leadsCount: 1 } }, { timestamps: false })
  } else {
    if (!botId || !mongoose.isValidObjectId(botId)) throw new ApiError(400, 'Valid botId is required')
    const owner = await User.findOne({ _id: botId, isActive: true }).select('_id')
    if (!owner) throw new ApiError(404, 'Chatbot not found')
    userId = owner._id
  }

  const lead = await Lead.create({
    userId,
    source,
    name: safeName,
    service: clean(service, 120),
    req: clean(request, 2000),
    phone: safePhone,
    email: safeEmail,
    linkId,
  })
  res.status(201).json(ApiResponse(201, lead, 'Lead captured'))
})

const update = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id })
  if (!lead) throw new ApiError(404, 'Lead not found')

  const allowed = ['name', 'service', 'req', 'phone', 'email', 'status']
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'status' && !LEAD_STATUSES.includes(req.body[key])) {
        throw new ApiError(400, 'Invalid status value')
      }
      lead[key] = req.body[key]
    }
  }

  await lead.save()
  res.json(ApiResponse(200, lead, 'Lead updated'))
})

const remove = asyncHandler(async (req, res) => {
  const lead = await Lead.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
  if (!lead) throw new ApiError(404, 'Lead not found')
  res.json(ApiResponse(200, { id: req.params.id }, 'Lead deleted'))
})

const exportCSV = asyncHandler(async (req, res) => {
  const query = { userId: req.user._id }
  if (req.query.source) {
    if (!['chatbot', 'link'].includes(req.query.source)) throw new ApiError(400, 'Invalid source filter')
    query.source = req.query.source
  }
  const leads = await Lead.find(query).sort({ createdAt: -1 }).lean()

  const header = ['Name', 'Service', 'Requirement', 'Date', 'Source', 'Status', 'Phone', 'Email']
  const rows = leads.map((l) => [
    `"${String(l.name || '').replace(/"/g, '""')}"`,
    `"${String(l.service || '').replace(/"/g, '""')}"`,
    `"${String(l.req || '').replace(/"/g, '""')}"`,
    l.date,
    l.source,
    l.status,
    `"${String(l.phone || '').replace(/"/g, '""')}"`,
    `"${String(l.email || '').replace(/"/g, '""')}"`,
  ])

  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename=leads-${new Date().toISOString().slice(0, 10)}.csv`)
  res.send('\uFEFF' + csv)
})

module.exports = { list, create, update, remove, exportCSV, LEAD_STATUSES }