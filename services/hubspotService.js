const axios = require('axios');

/**
 * HubSpot Service — Private App Token mode
 *
 * Uses HUBSPOT_PRIVATE_TOKEN (pat-na2-...) directly.
 * No OAuth flow needed. The token never expires unless you regenerate it.
 */

const getClient = () => {
  const token = process.env.HUBSPOT_PRIVATE_TOKEN;
  if (!token) throw new Error('HUBSPOT_PRIVATE_TOKEN is not set in .env');

  return axios.create({
    baseURL: 'https://api.hubapi.com',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
};

const hubspotService = {
  // Search contact by email
  async searchContactByEmail(email) {
    const client = getClient();
    const response = await client.post('/crm/v3/objects/contacts/search', {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'EQ',
              value: email,
            },
          ],
        },
      ],
      properties: [
        'firstname',
        'lastname',
        'email',
        'phone',
        'lifecyclestage',
        'company',
        'jobtitle',
        'createdate',
        'lastmodifieddate',
        'hs_lead_status',
      ],
    });

    if (response.data.total > 0) {
      return response.data.results[0];
    }
    return null;
  },

  // Get account info (to verify token works)
  async getAccountInfo() {
    const client = getClient();
    const response = await client.get('/account-info/v3/details');
    return response.data;
  },
};

module.exports = hubspotService;
