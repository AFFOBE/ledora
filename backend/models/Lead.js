const mongoose = require('mongoose')

const leadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: { type: String, enum: ['chatbot', 'link'], required: true },
    name: { type: String, trim: true, default: 'Chatbot Visitor' },
    service: { type: String, trim: true, default: '' },
    req: { type: String, trim: true, default: '' },
    date: { type: String, default: () => new Date().toISOString().slice(0, 10), index: true },
    status: { type: String, enum: ['New', 'Contacted', 'Qualified', 'Won', 'Lost'], default: 'New' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    meetingSummary: { type: String, trim: true, default: '' },
    linkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', default: null },
  },
  { timestamps: true }
)

leadSchema.index({ userId: 1, source: 1 })
leadSchema.index({ userId: 1, date: -1 })

module.exports = mongoose.model('Lead', leadSchema)