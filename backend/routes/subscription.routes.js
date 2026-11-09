const express = require('express')
const router = express.Router()
const { getPlans, getMine, createOrUpgrade, toggleAutoRenew } = require('../controllers/subscription.controller')
const protect = require('../middlewares/auth.middleware')

router.get('/plans', getPlans)

router.use(protect)

router.get('/', getMine)
router.post('/create', createOrUpgrade)
router.patch('/auto-renew', toggleAutoRenew)

module.exports = router