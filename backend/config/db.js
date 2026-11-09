const mongoose = require('mongoose')

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ledora'
  await mongoose.connect(uri)
  console.log('MongoDB connected:', mongoose.connection.name)
}

module.exports = connectDB
