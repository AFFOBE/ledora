const path = require('path')
const { body } = require('express-validator')
const Business = require('../models/Business')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')
const { UPLOAD_DIR } = require('../middlewares/upload.middleware')
const { localUrl } = require('../services/media/store')

const businessValidators = {
  save: [
    body('name').trim().notEmpty().withMessage('Business name is required').isLength({ max: 120 }),
    body('accounts').optional().isArray().withMessage('accounts must be an array'),
  ],
}

const get = asyncHandler(async (req, res) => {
  const business = await Business.findOne({ userId: req.user._id })
  res.json(ApiResponse(200, business ? business.toClient() : null))
})

const save = asyncHandler(async (req, res) => {
  const data = req.body
  const mapping = {
    name: 'name',
    cat: 'category',
    owner: 'owner',
    email: 'email',
    phone: 'phone',
    city: 'city',
    site: 'website',
    logo: 'logoPath',
    logoPath: 'logoPath',
    year: 'establishedYear',
    about: 'about',
    aud: 'audience',
    tone: 'tone',
    goal: 'goal',
    product: 'product',
    time: 'postingTime',
    avoid: 'avoid',
    accounts: 'accounts',
  }

  const update = {}
  for (const [clientKey, modelKey] of Object.entries(mapping)) {
    if (data[clientKey] !== undefined) update[modelKey] = data[clientKey]
  }

  if (typeof update.accounts !== 'undefined') {
    update.accounts = Array.isArray(data.accounts) ? data.accounts : []
  }

  let business = await Business.findOne({ userId: req.user._id })
  if (business) {
    Object.assign(business, update)
    await business.save()
  } else {
    update.userId = req.user._id
    update.name = update.name || `${req.user.name.split(' ')[0]} Business`
    business = await Business.create(update)
  }

  res.json(ApiResponse(200, business.toClient(), 'Business saved'))
})

/**
 * Stores the uploaded logo and returns its relative path + public URL. The
 * client keeps the path in the onboarding form and saves it with the rest of
 * the business profile, so a logo upload never creates a half-empty profile.
 */
const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Please choose a logo image')
  const relative = path.relative(UPLOAD_DIR, req.file.path).replace(/\\/g, '/')
  res.json(
    ApiResponse(
      200,
      { path: relative, url: localUrl(relative) },
      'Logo uploaded'
    )
  )
})

module.exports = { get, save, uploadLogo, businessValidators }