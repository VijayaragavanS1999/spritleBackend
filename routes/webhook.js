const express = require('express');
const router = express.Router();
const WebhookLog = require('../models/WebhookLog');
const { protect } = require('../middleware/auth');

// POST /api/webhook/freshdesk - Receive Freshdesk webhook events
// Note: This route uses raw body (set in server.js)
router.post('/freshdesk', async (req, res) => {
  try {
    let payload;
    // Handle both raw buffer and pre-parsed JSON
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(req.body.toString());
    } else {
      payload = req.body;
    }

    // Determine event type from payload
    const eventType =
      payload.freshdesk_webhook?.triggered_event ||
      payload.event_type ||
      (payload.ticket ? `ticket_${payload.ticket.status || 'event'}` : 'unknown_event');

    const log = await WebhookLog.create({
      eventType,
      source: 'freshdesk',
      payload,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'x-freshdesk-signature': req.headers['x-freshdesk-signature'] || null,
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      status: 'processed',
    });

    console.log(`📨 Freshdesk webhook received: ${eventType} [${log._id}]`);

    res.status(200).json({ received: true, id: log._id });
  } catch (err) {
    console.error('Webhook processing error:', err);
    // Always return 200 to Freshdesk to prevent retries
    res.status(200).json({ received: true, error: err.message });
  }
});

// GET /api/webhook/logs - Get webhook logs (protected)
router.get('/logs', protect, async (req, res) => {
  try {
    const { page = 1, limit = 50, source } = req.query;

    const filter = {};
    if (source) filter.source = source;

    const logs = await WebhookLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await WebhookLog.countDocuments(filter);

    res.json({
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ message: 'Failed to fetch webhook logs' });
  }
});

// DELETE /api/webhook/logs/:id
router.delete('/logs/:id', protect, async (req, res) => {
  await WebhookLog.findByIdAndDelete(req.params.id);
  res.json({ message: 'Log deleted' });
});

// DELETE /api/webhook/logs - Clear all logs
router.delete('/logs', protect, async (req, res) => {
  await WebhookLog.deleteMany({});
  res.json({ message: 'All logs cleared' });
});

module.exports = router;
