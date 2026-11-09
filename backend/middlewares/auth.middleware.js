const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const { verifyToken } = require('../utils/token')
const User = require('../models/User')

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new ApiError(401, 'Not authorized, no token provided')

  let decoded
  try {
    decoded = verifyToken(token)
  } catch (err) {
    throw new ApiError(401, 'Not authorized, invalid or expired token')
  }

  const user = await User.findById(decoded.id).select('-password')
  if (!user) throw new ApiError(401, 'User no longer exists')
  if (user.isActive === false) throw new ApiError(403, 'Account is disabled')

  req.user = user
  next()
})

module.exports = protect