const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const hubspotService = require('../services/hubspotService');

// ─── Helper: get a valid access token, auto-refreshing if expired ────────────
const getValidToken = async (user) => {
  if (!user.hubspotAccessToken) {
    throw new Error('HubSpot not connected');
  }

  const now = Date.now();
  const expiry = new Date(user.hubspotTokenExpiry).getTime();
  const BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

  if (expiry - now < BUFFER_MS) {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      refresh_token: user.hubspotRefreshToken,
    });

    const response = await axios.post(
      'https://api.hubapi.com/oauth/v1/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokens = response.data;

    await User.findByIdAndUpdate(user._id, {
      hubspotAccessToken: tokens.access_token,
      hubspotRefreshToken: tokens.refresh_token || user.hubspotRefreshToken,
      hubspotTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    });

    return tokens.access_token;
  }

  return user.hubspotAccessToken;
};

// ─── GET /api/hubspot/auth-url ───────────────────────────────────────────────
// ─── GET /api/hubspot/auth-url ───────────────────────────────────────────────
router.get('/auth-url', protect, (req, res) => {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.HUBSPOT_REDIRECT_URI);

  // include all required scopes
  const scopes = encodeURIComponent(
    'crm.objects.contacts.read crm.objects.contacts.write oauth'
  );

  const url = `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes}&state=${req.user._id}`;
  res.json({ url });
});

// ─── GET /api/hubspot/callback ───────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state: userId, error } = req.query;

  if (error || !code || !userId) {
    return res.redirect(`${process.env.FRONTEND_URL}/integrations?hubspot=error`);
  }

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.HUBSPOT_CLIENT_ID,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET,
      redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
      code,
    });

    const response = await axios.post(
      'https://api.hubapi.com/oauth/v1/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const tokens = response.data;

    await User.findByIdAndUpdate(userId, {
      hubspotAccessToken: tokens.access_token,
      hubspotRefreshToken: tokens.refresh_token,
      hubspotTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
    });

    res.redirect(`${process.env.FRONTEND_URL}/integrations?hubspot=connected`);
  } catch (err) {
    console.error('HubSpot callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/integrations?hubspot=error`);
  }
});

// ─── GET /api/hubspot/status ─────────────────────────────────────────────────
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.hubspotAccessToken) {
      return res.json({ connected: false, message: 'Not connected' });
    }

    const accessToken = await getValidToken(user);
    const info = await hubspotService.getAccountInfo(accessToken);

    res.json({ connected: true, portalId: info.portalId, uiDomain: info.uiDomain });
  } catch (err) {
    if (err.message === 'HubSpot not connected') {
      return res.json({ connected: false, message: 'Not connected' });
    }
    if (err.response?.status === 401) {
      await User.findByIdAndUpdate(req.user._id, {
        hubspotAccessToken: null,
        hubspotRefreshToken: null,
        hubspotTokenExpiry: null,
      });
      return res.json({ connected: false, message: 'Token expired, please reconnect' });
    }
    res.status(500).json({ connected: false, message: err.message });
  }
});

// ─── DELETE /api/hubspot/disconnect ──────────────────────────────────────────
router.delete('/disconnect', protect, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    hubspotAccessToken: null,
    hubspotRefreshToken: null,
    hubspotTokenExpiry: null,
  });
  res.json({ message: 'HubSpot disconnected' });
});

// ─── GET /api/hubspot/contact?email=... ──────────────────────────────────────
router.get('/contact', protect, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findById(req.user._id);
    const accessToken = await getValidToken(user);
    const contact = await hubspotService.searchContactByEmail(accessToken, email);
    console.log('HubSpot contact response:', contact);

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
    if (err.message === 'HubSpot not connected') {
      return res.status(400).json({ message: 'HubSpot not connected' });
    }
    console.error('HubSpot contact error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Failed to fetch contact from HubSpot' });
  }
});

module.exports = router;