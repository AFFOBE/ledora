const express = require('express')
const router = express.Router()
const { get, save, uploadLogo, businessValidators } = require('../controllers/business.controller')
const validate = require('../middlewares/validate.middleware')
const protect = require('../middlewares/auth.middleware')
const { singleLogo } = require('../middlewares/upload.middleware')

router.use(protect)

router.get('/', get)
router.post('/logo', singleLogo, uploadLogo)
router.post('/', businessValidators.save, validate, save)

module.exports = router