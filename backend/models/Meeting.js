const mongoose = require('mongoose')

const weeklyDaySchema = new mongoose.Schema(
  {
    day: String,
    start: String,
    end: String,
    closed: Boolean,
  },
  { _id: false }
)

const meetingConfigSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    weekly: { type: [weeklyDaySchema], default: [] },
    duration: { type: String, enum: ['30 minutes', '45 minutes', '60 minutes'], default: '30 minutes' },
  },
  { timestamps: true }
)

const meetingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, trim: true, default: '' },
    service: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    day: { type: String, default: '' },
    date: { type: String, default: '' },
    time: { type: String, default: '' },
    duration: { type: String, default: '30 minutes' },
    status: { type: String, enum: ['Booked', 'Rescheduled', 'Completed', 'Cancelled'], default: 'Booked' },
  },
  { timestamps: true }
)

module.exports = {
  MeetingConfig: mongoose.model('MeetingConfig', meetingConfigSchema),
  Meeting: mongoose.model('Meeting', meetingSchema),
}