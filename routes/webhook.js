const express = require('express');
const router = express.Router();
const WebhookLog = require('../models/WebhookLog');
const { protect } = require('../middleware/auth');

function parseFresdeskBody(rawString) {
  const trimmed = rawString.trim();

  // 1. Remove trailing commas before } or ] (Freshdesk sends invalid JSON)
  const fixedJson = trimmed
    .replace(/,\s*([}\]])/g, '$1');  // remove trailing commas

  // 2. Try strict JSON after fixing trailing commas
  try {
    return JSON.parse(fixedJson);
  } catch (_) {}

  // 3. Try form-encoded ONLY if it doesn't look like a JSON object/array
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    try {
      const { URLSearchParams } = require('url');
      const params = new URLSearchParams(trimmed);
      if ([...params.keys()].length > 0) {
        const obj = Object.fromEntries(params.entries());
        for (const key of Object.keys(obj)) {
          try { obj[key] = JSON.parse(obj[key]); } catch (_) {}
        }
        return obj;
      }
    } catch (_) {}
  }

  // 4. Try fixing JS object notation (single quotes, unquoted keys)
  try {
    const fixed = trimmed
      .replace(/'/g, '"')
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(fixed);
  } catch (_) {}

  // 5. Last resort
  return { raw: trimmed };
}

// POST /api/webhook/freshdesk
router.post('/freshdesk', async (req, res) => {
  try {
    let payload;

    if (Buffer.isBuffer(req.body)) {
      const rawString = req.body.toString('utf8');
      payload = parseFresdeskBody(rawString);
    } else if (typeof req.body === 'object' && req.body !== null) {
      payload = req.body;
    } else {
      payload = parseFresdeskBody(String(req.body));
    }

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
    res.status(200).json({ received: true, error: err.message });
  }
});

// GET /api/webhook/logs
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
  try {
    await WebhookLog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Log deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete log' });
  }
});

// DELETE /api/webhook/logs
router.delete('/logs', protect, async (req, res) => {
  try {
    await WebhookLog.deleteMany({});
    res.json({ message: 'All logs cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to clear logs' });
  }
});

module.exports = router;