require('dotenv').config()
const path = require('path')
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const mongoSanitize = require('express-mongo-sanitize')
const hpp = require('hpp')
const connectDB = require('./config/db')
const env = require('./config/env')
const routes = require('./routes')
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware')
const { startScheduler, stopScheduler } = require('./services/social/scheduler')
const { startMonthlyRefresh, stopMonthlyRefresh } = require('./services/social/refresh')

if (env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || env.JWT_SECRET.length < 32 || /replace|change_me|demo_secret/i.test(env.JWT_SECRET)) {
    console.error('Production requires a strong JWT_SECRET (32+ random characters).')
    process.exit(1)
  }
  if (!process.env.CLIENT_URL || /localhost/i.test(env.CLIENT_URL)) {
    console.warn('Warning: CLIENT_URL is not set to your public frontend domain.')
  }
}

const app = express()
const allowedOrigins = env.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean)

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
)
app.use(
  cors({
    origin: env.NODE_ENV === 'production'
      ? (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) callback(null, true)
          else callback(new Error('Origin not allowed by CORS'))
        }
      : true,
    credentials: true,
  })
)
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(mongoSanitize())
app.use(hpp())
if (env.NODE_ENV !== 'production') app.use(morgan('dev'))

// Uploaded social media (used by Facebook / Instagram while publishing).
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    fallthrough: true,
  })
)

app.use('/api', routes)

app.use(notFoundHandler)
app.use(errorHandler)

const start = async () => {
  try {
    await connectDB()
  } catch (err) {
    console.error('MongoDB connection failed:', err.message)
    console.error('Make sure MongoDB is running, e.g. mongod --dbpath <folder>')
    if (env.NODE_ENV === 'production') process.exit(1)
  }

  const server = app.listen(env.PORT, () => {
    console.log(`Ledora API running on http://localhost:${env.PORT}`)
    console.log(`Client allowed: ${env.CLIENT_URL}`)
    startScheduler()
    startMonthlyRefresh()
  })

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`)
    stopScheduler()
    stopMonthlyRefresh()
    server.close(async () => {
      await mongoose.connection.close()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start()

module.exports = app