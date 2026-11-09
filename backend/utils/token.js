const jwt = require('jsonwebtoken')
const env = require('../config/env')

const generateToken = (payload) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })

const verifyToken = (token) => jwt.verify(token, env.JWT_SECRET)

module.exports = { generateToken, verifyToken }