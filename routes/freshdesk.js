const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const freshdeskService = require('../services/freshdeskService');

// POST /api/freshdesk/connect - Save Freshdesk credentials
router.post('/connect', protect, async (req, res) => {
  try {
    const { apiKey, domain } = req.body;
    if (!apiKey || !domain) {
      return res.status(400).json({ message: 'API key and domain are required' });
    }

    // Clean domain (strip .freshdesk.com if included)
    const cleanDomain = domain.replace('.freshdesk.com', '').trim();

    // Test connection
    const agentInfo = await freshdeskService.testConnection(apiKey, cleanDomain);

    // Save credentials
    await User.findByIdAndUpdate(req.user._id, {
      freshdeskApiKey: apiKey,
      freshdeskDomain: cleanDomain,
    });

    res.json({
      message: 'Freshdesk connected successfully',
      agent: {
        name: agentInfo.contact?.name,
        email: agentInfo.contact?.email,
      },
    });
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) {
      return res.status(401).json({ message: 'Invalid Freshdesk API key' });
    }
    if (status === 404) {
      return res.status(404).json({ message: 'Freshdesk domain not found' });
    }
    console.error('Freshdesk connect error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to connect to Freshdesk' });
  }
});

// DELETE /api/freshdesk/disconnect
router.delete('/disconnect', protect, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    freshdeskApiKey: null,
    freshdeskDomain: null,
  });
  res.json({ message: 'Freshdesk disconnected' });
});

// GET /api/freshdesk/tickets
// Supports two modes:
//   ?all=true        → fetches every ticket across all pages (for count/dashboard)
//   ?page=N&per_page=30 → standard paginated fetch (for ticket list UI)
router.get('/tickets', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.freshdeskApiKey || !user.freshdeskDomain) {
      return res.status(400).json({ message: 'Freshdesk not connected' });
    }

    const { page = 1, per_page = 30, all } = req.query;

    // ?all=true: loop through every page and return full list + total count
    if (all === 'true') {
      let currentPage = 1;
      let allTickets = [];
      const PER_PAGE = 100; // Freshdesk max per_page

      while (true) {
        const batch = await freshdeskService.getTickets(
          user.freshdeskApiKey,
          user.freshdeskDomain,
          currentPage,
          PER_PAGE
        );
        allTickets = allTickets.concat(batch);

        // Freshdesk returns fewer than per_page on the last page
        if (batch.length < PER_PAGE) break;
        currentPage++;
      }

      return res.json({ tickets: allTickets, total: allTickets.length });
    }

    // Default: single-page fetch
    const tickets = await freshdeskService.getTickets(
      user.freshdeskApiKey,
      user.freshdeskDomain,
      parseInt(page),
      parseInt(per_page)
    );

    res.json(tickets);
  } catch (err) {
    console.error('Get tickets error:', err.message);
    res.status(500).json({ message: err.response?.data?.description || 'Failed to fetch tickets' });
  }
});

// GET /api/freshdesk/tickets/:id
router.get('/tickets/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.freshdeskApiKey || !user.freshdeskDomain) {
      return res.status(400).json({ message: 'Freshdesk not connected' });
    }

    const ticket = await freshdeskService.getTicket(
      user.freshdeskApiKey,
      user.freshdeskDomain,
      req.params.id
    );

    res.json(ticket);
  } catch (err) {
    console.error('Get ticket error:', err.message);
    res.status(err.response?.status || 500).json({
      message: err.response?.data?.description || 'Failed to fetch ticket',
    });
  }
});

// GET /api/freshdesk/tickets/:id/conversations
router.get('/tickets/:id/conversations', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.freshdeskApiKey || !user.freshdeskDomain) {
      return res.status(400).json({ message: 'Freshdesk not connected' });
    }

    const conversations = await freshdeskService.getConversations(
      user.freshdeskApiKey,
      user.freshdeskDomain,
      req.params.id
    );

    res.json(conversations);
  } catch (err) {
    console.error('Get conversations error:', err.message);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
});

module.exports = router;