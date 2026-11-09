const mongoose = require('mongoose')

const creativeSchema = new mongoose.Schema(
  {
    id: String,
    day: Number,
    no: Number,
    title: String,
    dstr: String,
    dow: { type: String, default: '' },
    date: { type: String, default: '' },
    type: { type: String, enum: ['reel', 'post'] },
    caption: String,
    hashtags: String,
    media: String,
    script: String,
    voiceover: { type: String, default: '' },
    cta: String,
    platform: String,
    platforms: { type: [String], default: [] },
    handle: String,
    platformLabel: String,
    status: { type: String, enum: ['Scheduled', 'Draft'], default: 'Draft' },
    note: { type: String, default: '' },
    grad: String,
    bestTime: { type: String, default: '' },

    // Real generated media
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    imageUrl: { type: String, default: '' },
    imagePath: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    videoPath: { type: String, default: '' },
    publicImageUrl: { type: String, default: '' },
    publicVideoUrl: { type: String, default: '' },
    imagePrompt: { type: String, default: '' },
    videoPrompt: { type: String, default: '' },
    mediaStatus: {
      type: String,
      enum: ['pending', 'image', 'video', 'ready', 'failed'],
      default: 'pending',
    },
    mediaError: { type: String, default: '' },
  },
  { _id: false }
)

const generationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['idle', 'text', 'images', 'videos', 'done', 'partial', 'failed'],
      default: 'idle',
    },
    phase: { type: String, default: '' },
    total: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    message: { type: String, default: '' },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { _id: false }
)

const socialPlanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    planId: { type: String, enum: ['basic', 'advance', 'premium'], default: 'advance' },
    planName: { type: String, default: 'Advance' },
    price: { type: Number, default: 4999 },
    paid: { type: Boolean, default: true },
    autoRenew: { type: Boolean, default: false },
    autoPublish: { type: Boolean, default: true },
    video: { type: Boolean, default: true },
    billing: { type: String, enum: ['monthly', 'yearly'], default: 'yearly' },
    amountPaid: { type: Number, default: 0 },
    brand: {
      tagline: { type: String, default: '' },
      summary: { type: String, default: '' },
      palette: { type: [String], default: [] },
      website: { type: String, default: '' },
    },
    items: [creativeSchema],
    generation: { type: generationSchema, default: () => ({}) },
    status: { type: String, enum: ['active', 'expired'], default: 'active' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('SocialPlan', socialPlanSchema)
