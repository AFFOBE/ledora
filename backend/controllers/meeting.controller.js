const { MeetingConfig, Meeting } = require('../models/Meeting')
const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')

const DEFAULT_SCHEDULE = [
  { day: 'Mon', start: '10:00', end: '18:00', closed: false },
  { day: 'Tue', start: '10:00', end: '18:00', closed: false },
  { day: 'Wed', start: '10:00', end: '18:00', closed: false },
  { day: 'Thu', start: '10:00', end: '18:00', closed: false },
  { day: 'Fri', start: '10:00', end: '18:00', closed: false },
  { day: 'Sat', start: '11:00', end: '15:00', closed: false },
  { day: 'Sun', start: '', end: '', closed: true },
]

const getConfig = asyncHandler(async (req, res) => {
  let config = await MeetingConfig.findOne({ userId: req.user._id })
  if (!config) {
    config = await MeetingConfig.create({ userId: req.user._id, weekly: DEFAULT_SCHEDULE, duration: '30 minutes' })
  }
  res.json(ApiResponse(200, config))
})

const saveConfig = asyncHandler(async (req, res) => {
  let config = await MeetingConfig.findOne({ userId: req.user._id })
  if (!config) config = new MeetingConfig({ userId: req.user._id })

  if (req.body.weekly) config.weekly = req.body.weekly
  if (req.body.duration) config.duration = req.body.duration

  await config.save()
  res.json(ApiResponse(200, config, 'Meeting schedule saved'))
})

const list = asyncHandler(async (req, res) => {
  const meetings = await Meeting.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean()
  res.json(ApiResponse(200, meetings))
})

const reschedule = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ _id: req.params.id, userId: req.user._id })
  if (!meeting) throw new ApiError(404, 'Meeting not found')

  const { day, date, time, duration } = req.body
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'New date is required')
  if (!time || !/^\d{2}:\d{2}$/.test(time)) throw new ApiError(400, 'Valid time is required')
  if (Number.isNaN(new Date(`${date}T00:00:00`).getTime())) throw new ApiError(400, 'Invalid date')

  meeting.day = day || meeting.day
  meeting.date = date
  meeting.time = time
  if (duration) meeting.duration = duration
  meeting.status = 'Rescheduled'

  await meeting.save()
  res.json(ApiResponse(200, meeting, 'Meeting rescheduled'))
})

const cancel = asyncHandler(async (req, res) => {
  const meeting = await Meeting.findOne({ _id: req.params.id, userId: req.user._id })
  if (!meeting) throw new ApiError(404, 'Meeting not found')
  meeting.status = 'Cancelled'
  await meeting.save()
  res.json(ApiResponse(200, meeting, 'Meeting cancelled'))
})

module.exports = { getConfig, saveConfig, list, reschedule, cancel }