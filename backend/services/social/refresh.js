/**
 * Yearly plans are sold as 12 monthly batches. This job starts the next 30-day
 * batch automatically once the previous one has been live for ~30 days, so the
 * customer keeps getting fresh content without buying again.
 */

const SocialPlan = require('../../models/SocialPlan')
const generation = require('./generation')

const BATCH_MS = Number(process.env.SOCIAL_MONTHLY_REFRESH_MS || 30 * 24 * 60 * 60 * 1000)
const CHECK_MS = Number(process.env.SOCIAL_REFRESH_CHECK_MS || 6 * 60 * 60 * 1000)
const PLAN_LIFETIME_MS = 366 * 24 * 60 * 60 * 1000

let timer = null
let running = false

async function refreshDuePlans({ force = false } = {}) {
  const now = Date.now()
  const cutoff = new Date(now - BATCH_MS)
  const due = await SocialPlan.find({
    billing: 'yearly',
    paid: true,
    'generation.status': { $in: ['done', 'partial'] },
    'generation.finishedAt': { $lte: cutoff },
  })
    .select('userId planId video amountPaid autoRenew createdAt items generation')
    .lean()

  let started = 0
  for (const record of due) {
    if (!record.items || !record.items.length) continue
    if (generation.isRunning(record.userId)) continue
    if (!force && record.createdAt && now - new Date(record.createdAt).getTime() > PLAN_LIFETIME_MS) {
      continue
    }

    await generation.startGeneration(record.userId, {
      planId: record.planId,
      billing: 'yearly',
      video: record.video !== false,
      amountPaid: typeof record.amountPaid === 'number' ? record.amountPaid : 0,
      autoRenew: record.autoRenew !== false,
    })
    started += 1
  }

  return started
}

async function tick() {
  if (running) return
  running = true
  try {
    const started = await refreshDuePlans()
    if (started) console.log(`[social-refresh] Started ${started} new monthly content batch(es)`)
  } catch (error) {
    console.error('[social-refresh] Check failed:', error.message)
  } finally {
    running = false
  }
}

function startMonthlyRefresh() {
  if (timer) return timer

  // Delay the first check so boot stays fast.
  setTimeout(tick, 20 * 1000)
  timer = setInterval(tick, CHECK_MS)
  if (typeof timer.unref === 'function') timer.unref()

  console.log(`[social-refresh] Monthly yearly-plan refresh started (check every ${Math.round(CHECK_MS / 3600000)}h)`)
  return timer
}

function stopMonthlyRefresh() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

module.exports = { startMonthlyRefresh, stopMonthlyRefresh, refreshDuePlans }
