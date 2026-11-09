const express = require('express')
const mongoose = require('mongoose')

const router = express.Router()

router.get('/', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    message: dbReady ? 'Ledora API is running' : 'Ledora API is running but the database is unavailable',
    timestamp: new Date().toISOString(),
  })
})

module.exports = router
