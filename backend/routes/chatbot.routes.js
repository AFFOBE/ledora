const express = require('express')
const router = express.Router()
const { get, save, chatbotValidators } = require('../controllers/chatbot.controller')
const validate = require('../middlewares/validate.middleware')
const protect = require('../middlewares/auth.middleware')

router.use(protect)

router.get('/config', get)
router.put('/config', chatbotValidators.save, validate, save)

module.exports = router