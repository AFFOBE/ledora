const express = require('express')
const router = express.Router()
const { register, login, me, getUserState, authValidators } = require('../controllers/auth.controller')
const validate = require('../middlewares/validate.middleware')
const protect = require('../middlewares/auth.middleware')
const rateLimit = require('../middlewares/rateLimit.middleware')

router.post('/register', rateLimit(8, 10 * 60 * 1000), authValidators.register, validate, register)
router.post('/login', rateLimit(12, 10 * 60 * 1000), authValidators.login, validate, login)
router.get('/me', protect, me)
router.get('/state', protect, getUserState)

module.exports = router