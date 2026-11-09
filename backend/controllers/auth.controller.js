const { body } = require('express-validator')
const User = require('../models/User')
const Business = require('../models/Business')
const ChatbotConfig = require('../models/ChatbotConfig')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')
const { generateToken } = require('../utils/token')

const authValidators = {
  register: [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 80 }).withMessage('Name too long'),
    body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone too long'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  login: [
    body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
}

const publicUser = (user, token) => {
  const out = {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
  }
  if (token) out.token = token
  return out
}

const register = asyncHandler(async (req, res) => {
  const { name, email, phone = '', password } = req.body

  const existing = await User.findOne({ email })
  if (existing) throw new ApiError(409, 'An account with this email already exists')

  const user = await User.create({ name, email, phone, password })

  await ChatbotConfig.create({
    userId: user._id,
    chatbotName: `${name.split(' ')[0]} Assistant`,
    welcomeMessage: `Hi! Welcome to ${name.split(' ')[0]}'s business. How can I help you today?`,
    services: [
      { id: 1, name: 'Website Development', enabled: true },
      { id: 2, name: 'Digital Marketing', enabled: true },
    ],
    fields: [
      { id: 1, name: 'Name', type: 'text', required: true, enabled: true },
      { id: 2, name: 'Phone Number', type: 'phone', required: true, enabled: true },
      { id: 3, name: 'Email', type: 'email', required: false, enabled: true },
      { id: 4, name: 'Requirement', type: 'text', required: true, enabled: true },
    ],
  })

  res.status(201).json(ApiResponse(201, publicUser(user, generateToken({ id: user._id })), 'Account created'))
})

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email }).select('+password')
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password')
  }
  if (user.isActive === false) throw new ApiError(403, 'Account is disabled')

  res.json(ApiResponse(200, publicUser(user, generateToken({ id: user._id })), 'Logged in successfully'))
})

const me = asyncHandler(async (req, res) => {
  res.json(ApiResponse(200, publicUser(req.user, req.user.token), 'User profile'))
})

const getUserState = asyncHandler(async (req, res) => {
  const [business, chatbot, subscription] = await Promise.all([
    Business.findOne({ userId: req.user._id }),
    ChatbotConfig.findOne({ userId: req.user._id }).lean(),
    require('../models/Subscription').findOne({ userId: req.user._id, type: 'chatbot', status: 'active' }).sort({ createdAt: -1 }).lean(),
  ])
  res.json(
    ApiResponse(200, {
      user: publicUser(req.user),
      business: business ? business.toClient() : null,
      chatbot: chatbot || null,
      subscription: subscription || null,
    })
  )
})

module.exports = { register, login, me, getUserState, authValidators }