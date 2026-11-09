const crypto = require('crypto')
const Link = require('../models/Link')
const Business = require('../models/Business')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')
const env = require('../config/env')

const publicBase = (env.CLIENT_URL || env.BASE_URL).split(',')[0].trim().replace(/\/+$/, '')

const makeSlug = (name) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
  const rand = crypto.randomBytes(3).toString('hex').slice(0, 5)
  return base ? `${base}-${rand}` : `link-${rand}`
}

const list = asyncHandler(async (req, res) => {
  const links = await Link.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean()
  res.json(ApiResponse(200, links.map((link) => ({ ...link, url: `${publicBase}/l/${link.slug}` }))))
})

const create = asyncHandler(async (req, res) => {
  const { name } = req.body
  if (!name || !name.trim()) throw new ApiError(400, 'Link name is required')

  const slug = makeSlug(name)
  const url = `${publicBase}/l/${slug}`

  const link = await Link.create({
    userId: req.user._id,
    name: name.trim().slice(0, 80),
    slug,
    url,
  })

  res.status(201).json(ApiResponse(201, link, 'Link created'))
})

const getBySlug = asyncHandler(async (req, res) => {
  const link = await Link.findOne({ slug: req.params.slug })
  if (!link) throw new ApiError(404, 'Link not found')

  const business = await Business.findOne({ userId: link.userId }).select('name').lean()

  res.json(
    ApiResponse(200, {
      name: link.name,
      slug: link.slug,
      businessName: (business && business.name) || 'Business',
    })
  )
})

const remove = asyncHandler(async (req, res) => {
  const link = await Link.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
  if (!link) throw new ApiError(404, 'Link not found')
  await require('../models/Lead').updateMany({ linkId: link._id }, { $set: { linkId: null } })
  res.json(ApiResponse(200, { id: req.params.id }, 'Link deleted'))
})

module.exports = { list, create, getBySlug, remove }
