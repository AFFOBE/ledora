const ApiResponse = (statusCode, data = null, message = 'Success') => ({
  success: true,
  statusCode,
  message,
  data,
})

module.exports = ApiResponse