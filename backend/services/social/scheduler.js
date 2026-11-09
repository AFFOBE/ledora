const SocialPost = require('../../models/SocialPost')
const { processDuePosts } = require('./publisher')
const { recoverStuckGenerations } = require('./generation')

const INTERVAL_MS = Number(process.env.SOCIAL_SCHEDULER_INTERVAL_MS || 60 * 1000)
const STALE_MS = Number(process.env.SOCIAL_PUBLISH_TIMEOUT_MS || 20 * 60 * 1000)

let timer = null
let running = false

async function recoverStalePosts() {
  try {
    const result = await SocialPost.updateMany(
      {
        status: 'publishing',
        lockedAt: { $lt: new Date(Date.now() - STALE_MS) },
      },
      {
        $set: {
          status: 'failed',
          lockedAt: null,
          error: 'Publishing timed out. Please retry from the publishing queue.',
        },
      }
    )
    if (result.modifiedCount) {
      console.warn(`[social-scheduler] Recovered ${result.modifiedCount} stale publishing post(s)`)
    }
  } catch (error) {
    console.error('[social-scheduler] Stale post recovery failed:', error.message)
  }
}

async function tick() {
  if (running) return
  running = true
  try {
    await processDuePosts(5)
  } catch (error) {
    console.error('[social-scheduler] Tick failed:', error.message)
  } finally {
    running = false
  }
}

function startScheduler() {
  if (timer) return timer

  recoverStalePosts()
  recoverStuckGenerations()
  // First run shortly after boot so due posts are not delayed a full minute.
  setTimeout(tick, 5 * 1000)
  timer = setInterval(tick, INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()

  console.log(`[social-scheduler] Auto-publishing scheduler started (every ${Math.round(INTERVAL_MS / 1000)}s)`)
  return timer
}

function stopScheduler() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

module.exports = { startScheduler, stopScheduler, recoverStalePosts }
