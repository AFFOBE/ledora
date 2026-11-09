
const mongoose = require('mongoose')

const socialAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    platform: {
      type: String,
      enum: [
        'instagram',
        'facebook',
        'linkedin',
        'youtube',
        'google-business',
      ],
      required: true,
    },

    platformUserId: {
      type: String,
      default: null,
    },

    username: {
      type: String,
      default: null,
    },

    accessToken: {
      type: String,
      required: true,
      select: false,
    },

    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    tokenExpiresAt: {
      type: Date,
      default: null,
    },

    connected: {
      type: Boolean,
      default: true,
    },

    // Platform specific cached identifiers (Google Business location, etc.)
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

socialAccountSchema.index(
  { userId: 1, platform: 1, platformUserId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      platformUserId: { $type: 'string' },
    },
  }
)

module.exports = mongoose.model('SocialAccount', socialAccountSchema)
