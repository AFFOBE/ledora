
const express = require('express')
const router = express.Router()

const {
  getPlans,
  getDashboard,
  generate,
  generationStatus,
  retryGeneration,
  scheduleAll,
  setAutoPublish,
  pay,
  updateCreative,
  updateVideo,
} = require('../controllers/social.controller')

const protect = require('../middlewares/auth.middleware')

const {
  connectInstagram,
  instagramCallback,
} = require('../controllers/instagram.controller')

const {
  connectFacebook,
  facebookCallback,
} = require('../controllers/facebook.controller')

const {
  connectLinkedIn,
  linkedinCallback,
} = require('../controllers/linkedin.controller')

const {
  connectYouTube,
  youtubeCallback,
} = require('../controllers/youtube.controller')

const {
  connectGoogleBusiness,
  googleBusinessCallback,
} = require('../controllers/googleBusiness.controller')

const {
  getConnectedAccounts,
} = require('../controllers/socialAccounts.controller')

const {
  uploadMedia,
  listPosts,
  createPost,
  publishPost,
  cancelPost,
  deletePost,
  getPublishSummary,
} = require('../controllers/socialPublish.controller')

const { singleMedia } = require('../middlewares/upload.middleware')

router.get('/plans', getPlans)

// OAuth callbacks: public routes
router.get('/instagram/callback', instagramCallback)
router.get('/facebook/callback', facebookCallback)
router.get('/linkedin/callback', linkedinCallback)
router.get('/youtube/callback', youtubeCallback)
router.get('/google-business/callback', googleBusinessCallback)

// Protected routes
router.use(protect)

router.get('/instagram/connect', connectInstagram)
router.get('/facebook/connect', connectFacebook)
router.get('/linkedin/connect', connectLinkedIn)
router.get('/youtube/connect', connectYouTube)
router.get('/google-business/connect', connectGoogleBusiness)

router.get('/accounts', getConnectedAccounts)

// Real publishing + auto-posting
router.get('/publishing', getPublishSummary)
router.post('/media', singleMedia, uploadMedia)
router.get('/posts', listPosts)
router.post('/posts', createPost)
router.post('/posts/:id/publish', publishPost)
router.patch('/posts/:id/cancel', cancelPost)
router.delete('/posts/:id', deletePost)

router.get('/dashboard', getDashboard)
router.get('/generation', generationStatus)
router.post('/generate', generate)
router.post('/generation/retry', retryGeneration)
router.post('/schedule-all', scheduleAll)
router.patch('/auto-publish', setAutoPublish)
router.post('/pay', pay)
router.patch('/video', updateVideo)
router.patch('/creatives/:id', updateCreative)

module.exports = router
