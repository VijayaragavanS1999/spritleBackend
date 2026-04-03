const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  name: {
    type: String,
    trim: true,
  },
  // Freshdesk credentials
  freshdeskApiKey: {
    type: String,
    default: null,
  },
  freshdeskDomain: {
    type: String,
    default: null,
  },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual: integration status
userSchema.virtual('integrations').get(function () {
  return {
    freshdesk: !!(this.freshdeskApiKey && this.freshdeskDomain),
  };
});

userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.freshdeskApiKey;
    delete ret.hubspotAccessToken;
    delete ret.hubspotRefreshToken;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
