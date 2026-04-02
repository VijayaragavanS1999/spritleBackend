const axios = require('axios');

const getFreshdeskClient = (apiKey, domain) => {
  const baseURL = `https://${domain}.freshdesk.com/api/v2`;
  // Freshdesk uses API key as username with any password
  const auth = Buffer.from(`${apiKey}:X`).toString('base64');

  return axios.create({
    baseURL,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
};

const freshdeskService = {
  // Test connection
  async testConnection(apiKey, domain) {
    const client = getFreshdeskClient(apiKey, domain);
    const response = await client.get('/agents/me');
    return response.data;
  },

  // Fetch all tickets
  async getTickets(apiKey, domain, page = 1, perPage = 30) {
    const client = getFreshdeskClient(apiKey, domain);
    const response = await client.get('/tickets', {
      params: {
        page,
        per_page: perPage,
        include: 'requester,stats',
        order_by: 'created_at',
        order_type: 'desc',
      },
    });
    return response.data;
  },

  // Fetch single ticket
  async getTicket(apiKey, domain, ticketId) {
    const client = getFreshdeskClient(apiKey, domain);
    const response = await client.get(`/tickets/${ticketId}`, {
      params: { include: 'requester,conversations,company,stats' },
    });
    return response.data;
  },

  // Fetch ticket conversations
  async getConversations(apiKey, domain, ticketId) {
    const client = getFreshdeskClient(apiKey, domain);
    const response = await client.get(`/tickets/${ticketId}/conversations`);
    return response.data;
  },
};

module.exports = freshdeskService;
