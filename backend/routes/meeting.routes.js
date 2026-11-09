const express = require('express')
const router = express.Router()
const { getConfig, saveConfig, list, reschedule, cancel } = require('../controllers/meeting.controller')
const protect = require('../middlewares/auth.middleware')
const validateObjectId = require('../middlewares/validateObjectId')

router.use(protect)

router.get('/config', getConfig)
router.put('/config', saveConfig)
router.get('/', list)
router.patch('/:id/reschedule', validateObjectId('id'), reschedule)
router.patch('/:id/cancel', validateObjectId('id'), cancel)

module.exports = router