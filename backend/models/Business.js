const mongoose = require('mongoose')

const accountSchema = new mongoose.Schema(
  {
    platformId: String,
    name: String,
    icon: String,
    color: String,
    handle: String,
  },
  { _id: false }
)

const businessSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    name: { type: String, required: [true, 'Business name is required'], trim: true, maxlength: 120 },
    category: { type: String, default: '' },
    owner: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    logoPath: { type: String, trim: true, default: '' },
    establishedYear: { type: String, trim: true, default: '' },
    about: { type: String, trim: true, default: '' },
    audience: { type: String, default: '' },
    tone: { type: String, default: '' },
    goal: { type: String, default: '' },
    product: { type: String, trim: true, default: '' },
    postingTime: { type: String, default: '' },
    avoid: { type: String, trim: true, default: '' },
    accounts: [accountSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

const uploadBase = () =>
  String(process.env.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '')

businessSchema.methods.toClient = function () {
  const logoPath = String(this.logoPath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  return {
    id: this._id,
    name: this.name,
    cat: this.category,
    owner: this.owner,
    email: this.email,
    phone: this.phone,
    city: this.city,
    site: this.website,
    logoPath,
    logo: logoPath ? `${uploadBase()}/uploads/${logoPath}` : '',
    year: this.establishedYear,
    about: this.about,
    aud: this.audience,
    tone: this.tone,
    goal: this.goal,
    product: this.product,
    time: this.postingTime,
    avoid: this.avoid,
    accounts: this.accounts,
  }
}

module.exports = mongoose.model('Business', businessSchema)