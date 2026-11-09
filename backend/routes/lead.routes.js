const express = require('express')
const router = express.Router()
const { list, create, update, remove, exportCSV } = require('../controllers/lead.controller')
const protect = require('../middlewares/auth.middleware')
const rateLimit = require('../middlewares/rateLimit.middleware')
const validateObjectId = require('../middlewares/validateObjectId')

router.get('/export', protect, exportCSV)

router.post('/capture', rateLimit(20, 60 * 1000), create)

router.use(protect)

router.get('/', list)
router.patch('/:id', validateObjectId('id'), update)
router.delete('/:id', validateObjectId('id'), remove)

module.exports = router