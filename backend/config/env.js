require('dotenv').config()

if (!process.env.TZ) process.env.TZ = 'Asia/Kolkata'

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ledora',
  JWT_SECRET: process.env.JWT_SECRET || 'ledora_demo_secret_change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
}

module.exports = env