const axios = require('axios');

const getClient = (accessToken) =>
  axios.create({
    baseURL: 'https://api.hubapi.com',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

const hubspotService = {
  async searchContactByEmail(accessToken, email) {
    const client = getClient(accessToken);
    const response = await client.post('/crm/v3/objects/contacts/search', {
      filterGroups: [
        {
          filters: [{ propertyName: 'email', operator: 'EQ', value: email }],
        },
      ],
      properties: [
        'firstname', 'lastname', 'email', 'phone',
        'lifecyclestage', 'company', 'jobtitle',
        'createdate', 'lastmodifieddate', 'hs_lead_status',
      ],
    });
    return response.data.total > 0 ? response.data.results[0] : null;
  },

  async getAccountInfo(accessToken) {
    const client = getClient(accessToken);
    const response = await client.get('/account-info/v3/details');
    return response.data;
  },
};

module.exports = hubspotService;