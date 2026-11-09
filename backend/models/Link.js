const mongoose = require('mongoose')

const linkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Link name is required'], trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, unique: true },
    url: { type: String, required: true, trim: true },
    leadsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
)

linkSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('Link', linkSchema)