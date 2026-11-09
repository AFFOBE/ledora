const mongoose = require('mongoose')
const ApiError = require('../utils/ApiError')

module.exports = (param = 'id') => (req, res, next) => {
  const value = req.params[param]
  if (!value) return next()
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return next(new ApiError(400, 'Invalid ID format'))
  }
  next()
}
