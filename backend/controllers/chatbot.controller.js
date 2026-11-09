const { body } = require('express-validator')
const ChatbotConfig = require('../models/ChatbotConfig')
const asyncHandler = require('../utils/asyncHandler')
const ApiResponse = require('../utils/ApiResponse')

const chatbotValidators = {
  save: [
    body('chatbotName').optional().trim().isLength({ max: 60 }),
    body('welcomeMessage').optional().trim().isLength({ max: 300 }),
    body('autoOpen').optional().isIn(['Immediately', 'After 3 seconds', 'After 5 seconds']).withMessage('Invalid autoOpen value'),
    body('services').optional().isArray(),
    body('fields').optional().isArray(),
  ],
}

const get = asyncHandler(async (req, res) => {
  let config = await ChatbotConfig.findOne({ userId: req.user._id })
  if (!config) {
    config = await ChatbotConfig.create({ userId: req.user._id })
  }
  res.json(ApiResponse(200, config))
})

const save = asyncHandler(async (req, res) => {
  let config = await ChatbotConfig.findOne({ userId: req.user._id })
  const data = req.body
  if (!config) config = new ChatbotConfig({ userId: req.user._id })

  if (data.chatbotName !== undefined) config.chatbotName = data.chatbotName
  if (data.welcomeMessage !== undefined && data.welcomeMessage.trim() !== '') config.welcomeMessage = data.welcomeMessage
  if (data.autoOpen !== undefined) config.autoOpen = data.autoOpen
  if (data.services !== undefined) {
    config.services = (Array.isArray(data.services) ? data.services : [])
      .slice(0, 20)
      .map((s, i) => ({
        id: Number(s.id) || i + 1,
        name: String(s.name || '').trim().slice(0, 80),
        enabled: s.enabled !== false,
      }))
      .filter((s) => s.name)
  }
  if (data.fields !== undefined) {
    config.fields = (Array.isArray(data.fields) ? data.fields : [])
      .slice(0, 20)
      .map((f, i) => ({
        id: Number(f.id) || i + 1,
        name: String(f.name || '').trim().slice(0, 80),
        type: ['text', 'phone', 'email'].includes(f.type) ? f.type : 'text',
        required: f.required !== false,
        enabled: f.enabled !== false,
      }))
      .filter((f) => f.name)
  }

  await config.save()
  res.json(ApiResponse(200, config, 'Chatbot config saved'))
})

module.exports = { get, save, chatbotValidators }