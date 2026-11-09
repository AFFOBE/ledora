const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found - ${req.method} ${req.originalUrl}`)
  error.statusCode = 404
  next(error)
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'
  let details = err.details || null

  if (err.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation error'
    details = Object.values(err.errors).map((e) => e.message)
  } else if (err.name === 'CastError') {
    statusCode = 400
    message = `Invalid ${err.path}: ${err.value}`
  } else if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyPattern || {})[0] || 'field'
    message = `${field} already exists`
  }

  if (statusCode === 500 && process.env.NODE_ENV === 'production') message = 'Internal server error'

  if (process.env.NODE_ENV !== 'production') {
    console.error(err)
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(details ? { details } : {}),
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
  })
}

module.exports = { notFoundHandler, errorHandler }