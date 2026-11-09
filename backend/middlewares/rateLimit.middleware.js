const buckets = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of buckets) {
    if (entry.reset <= now) buckets.delete(key)
  }
}, 60 * 1000).unref()

module.exports = (max = 30, windowMs = 60 * 1000) => (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown'
  const key = `${ip}:${req.baseUrl}${req.path}`
  const now = Date.now()
  let entry = buckets.get(key)

  if (!entry || entry.reset <= now) {
    entry = { count: 0, reset: now + windowMs }
    buckets.set(key, entry)
  }

  entry.count += 1

  if (entry.count > max) {
    res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000))
    res.setHeader('X-RateLimit-Limit', max)
    res.setHeader('X-RateLimit-Remaining', 0)
    res.setHeader('X-RateLimit-Reset', Math.floor(entry.reset / 1000))
    return res.status(429).json({
      success: false,
      statusCode: 429,
      message: 'Too many requests. Please try again later.',
    })
  }

  res.setHeader('X-RateLimit-Limit', max)
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count))
  res.setHeader('X-RateLimit-Reset', Math.floor(entry.reset / 1000))
  next()
}
