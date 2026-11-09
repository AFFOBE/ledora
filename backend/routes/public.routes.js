const express = require('express')
const router = express.Router()
const { getBot, captureLead, getLink } = require('../controllers/public.controller')
const rateLimit = require('../middlewares/rateLimit.middleware')

router.get('/bots/:botId', rateLimit(60, 60 * 1000), getBot)
router.post('/bots/:botId/leads', rateLimit(12, 60 * 1000), captureLead)
router.get('/links/:slug', rateLimit(60, 60 * 1000), getLink)

module.exports = router
