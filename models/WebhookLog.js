const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Webhooks arrive without user context
  },
  eventType: {
    type: String,
    required: true,
    default: 'freshdesk_event',
  },
  source: {
    type: String,
    default: 'freshdesk',
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  headers: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['received', 'processed', 'error'],
    default: 'received',
  },
  ipAddress: String,
}, { timestamps: true });

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
