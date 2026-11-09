const express = require('express')
const router = express.Router()
const { list, create, getBySlug, remove } = require('../controllers/link.controller')
const protect = require('../middlewares/auth.middleware')
const validateObjectId = require('../middlewares/validateObjectId')

router.get('/slug/:slug', getBySlug)

router.use(protect)

router.get('/', list)
router.post('/', create)
router.delete('/:id', validateObjectId('id'), remove)

module.exports = router