const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const hubspotService = require('../services/hubspotService');

// GET /api/hubspot/status — verify the private token is working
router.get('/status', protect, async (req, res) => {
  try {
    const info = await hubspotService.getAccountInfo();
    res.json({ connected: true, portalId: info.portalId, uiDomain: info.uiDomain });
  } catch (err) {
    if (err.message === 'HUBSPOT_PRIVATE_TOKEN is not set in .env') {
      return res.status(400).json({ connected: false, message: 'Token not configured' });
    }
    if (err.response?.status === 401) {
      return res.status(401).json({ connected: false, message: 'Invalid HubSpot Private App Token' });
    }
    res.status(500).json({ connected: false, message: err.response?.data?.message || err.message });
  }
});

// GET /api/hubspot/contact?email=...
router.get('/contact', protect, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const contact = await hubspotService.searchContactByEmail(email);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found in HubSpot' });
    }

    const props = contact.properties;
    res.json({
      id: contact.id,
      name: [props.firstname, props.lastname].filter(Boolean).join(' ') || 'N/A',
      email: props.email,
      phone: props.phone || null,
      lifecycleStage: props.lifecyclestage || null,
      company: props.company || null,
      jobTitle: props.jobtitle || null,
      createdAt: props.createdate,
      updatedAt: props.lastmodifieddate,
      leadStatus: props.hs_lead_status || null,
    });
  } catch (err) {
    console.error('HubSpot contact error:', err.response?.data || err.message);
    if (err.message === 'HUBSPOT_PRIVATE_TOKEN is not set in .env') {
      return res.status(400).json({ message: 'HubSpot token not configured in server .env' });
    }
    res.status(500).json({ message: 'Failed to fetch contact from HubSpot' });
  }
});

module.exports = router;
