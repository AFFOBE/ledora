const mongoose = require('mongoose')

const socialPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SocialAccount',
      default: null,
      index: true,
    },

    platform: {
      type: String,
      enum: ['instagram', 'facebook', 'linkedin', 'youtube', 'google-business'],
      required: true,
      index: true,
    },

    // post = image/text update, reel = short vertical video, video = long form video
    kind: {
      type: String,
      enum: ['post', 'reel', 'video'],
      default: 'post',
    },

    title: { type: String, default: '', trim: true },
    caption: { type: String, default: '', trim: true },
    hashtags: { type: String, default: '', trim: true },

    // Publicly reachable URL used by the platform while publishing.
    mediaUrl: { type: String, default: '', trim: true },
    // Local file path (relative to backend/uploads) so the scheduler can read bytes.
    mediaPath: { type: String, default: '' },
    mediaType: {
      type: String,
      enum: ['none', 'image', 'video'],
      default: 'none',
    },
    mimeType: { type: String, default: '' },

    scheduledAt: { type: Date, default: null, index: true },

    status: {
      type: String,
      enum: ['draft', 'scheduled', 'publishing', 'posted', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },

    externalId: { type: String, default: '' },
    externalUrl: { type: String, default: '' },
    error: { type: String, default: '' },

    attempts: { type: Number, default: 0 },
    lockedAt: { type: Date, default: null },
    postedAt: { type: Date, default: null },

    // Links back to the generated creative in SocialPlan (for example sma1b2c3).
    creativeId: { type: String, default: '' },
  },
  { timestamps: true }
)

socialPostSchema.index({ status: 1, scheduledAt: 1 })
socialPostSchema.index({ userId: 1, createdAt: -1 })

module.exports = mongoose.model('SocialPost', socialPostSchema)
