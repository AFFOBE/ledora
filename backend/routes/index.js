const express = require('express')
const router = express.Router()

router.use('/health', require('./health.routes'))
router.use('/public', require('./public.routes'))
router.use('/auth', require('./auth.routes'))
router.use('/business', require('./business.routes'))
router.use('/chatbot', require('./chatbot.routes'))
router.use('/leads', require('./lead.routes'))
router.use('/links', require('./link.routes'))
router.use('/meetings', require('./meeting.routes'))
router.use('/subscription', require('./subscription.routes'))
router.use('/social', require('./social.routes'))

module.exports = router