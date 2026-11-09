const mongoose = require('mongoose')

const serviceSchema = new mongoose.Schema(
  {
    id: Number,
    name: String,
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
)

const fieldSchema = new mongoose.Schema(
  {
    id: Number,
    name: String,
    type: { type: String, enum: ['text', 'phone', 'email'], default: 'text' },
    required: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
)

const chatbotConfigSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    chatbotName: { type: String, default: 'AI Assistant' },
    welcomeMessage: { type: String, default: 'Hi! Welcome. How can I help you today?' },
    autoOpen: { type: String, enum: ['Immediately', 'After 3 seconds', 'After 5 seconds'], default: 'Immediately' },
    services: [serviceSchema],
    fields: [fieldSchema],
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatbotConfig', chatbotConfigSchema)
