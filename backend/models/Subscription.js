const mongoose = require('mongoose')

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['chatbot', 'social'], default: 'chatbot' },
    plan: { type: String, required: true },
    price: { type: Number, required: true },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
    autoRenew: { type: Boolean, default: false },
    startDate: { type: Date, default: Date.now },
    renewalDate: { type: Date },
  },
  { timestamps: true }
)

subscriptionSchema.index({ userId: 1, type: 1, status: 1 })

module.exports = mongoose.model('Subscription', subscriptionSchema)
