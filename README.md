# SupportBridge — Backend

A Node.js + Express REST API backend for the SupportBridge portal, built for the Spritle Software developer task.

---

## Tech Stack

- **Node.js** with **Express.js**
- **MongoDB** via Mongoose
- **JWT** for authentication
- **Freshdesk REST API** (API key auth)
- **HubSpot CRM API** (OAuth 2.0 with token refresh)

---

## Project Structure

```
backend/
├── models/
│   ├── User.js            # User schema + Freshdesk/HubSpot credentials
│   └── WebhookLog.js      # Incoming webhook event logs
├── routes/
│   ├── auth.js            # POST /login, /signup, GET /me
│   ├── freshdesk.js       # Tickets, conversations, connect/disconnect
│   ├── hubspot.js         # OAuth flow, contact lookup
│   └── webhook.js         # Receive + log Freshdesk webhook events
├── services/
│   ├── freshdeskService.js  # Freshdesk API calls
│   └── hubspotService.js    # HubSpot API calls + token refresh
├── middleware/
│   └── auth.js            # JWT verification middleware
├── server.js
└── .env.sample
```

---

## Setup Instructions

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- Freshdesk free trial account
- HubSpot free developer account

### 1. Navigate to backend folder

```bash
cd spritle-portal/backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the `backend/` folder (use `.env.sample` as reference):

```env
PORT=5000
FRONTEND_URL=http://localhost:3000

MONGODB_URI=mongodb://localhost:27017/spritle-portal

JWT_SECRET=your_super_secret_jwt_key_change_in_production

HUBSPOT_CLIENT_ID=your_hubspot_client_id
HUBSPOT_CLIENT_SECRET=your_hubspot_client_secret
HUBSPOT_REDIRECT_URI=http://localhost:5000/api/hubspot/callback
```

### 4. Start the development server

```bash
npm run dev
```

Server runs at: `http://localhost:5000`

---

## API Credentials Setup

### Freshdesk

1. Sign up at [freshdesk.com](https://freshdesk.com) (free trial)
2. Go to **Profile Settings** (top right avatar)
3. Scroll down to find your **API Key**
4. Your domain is the subdomain in your Freshdesk URL: `https://YOUR_DOMAIN.freshdesk.com`
5. In the portal → **Integrations** → Enter API key + domain to connect

### HubSpot

1. Sign up at [developers.hubspot.com](https://developers.hubspot.com) (free developer account)
2. Create a new app under the **Apps** section
3. Go to the **Auth** tab of your app:
   - Add redirect URL: `http://localhost:5000/api/hubspot/callback`
   - Required scopes: `crm.objects.contacts.read`, `oauth`
4. Copy **Client ID** and **Client Secret** into `backend/.env`
5. In the portal → **Integrations** → Click **Connect with HubSpot**

---

## API Endpoints Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create a new account |
| POST | `/api/auth/login` | Login and receive JWT |
| GET | `/api/auth/me` | Get current logged-in user |

### Freshdesk

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/freshdesk/connect` | Save Freshdesk API credentials |
| DELETE | `/api/freshdesk/disconnect` | Remove Freshdesk credentials |
| GET | `/api/freshdesk/tickets` | List all tickets |
| GET | `/api/freshdesk/tickets/:id` | Get ticket detail |
| GET | `/api/freshdesk/tickets/:id/conversations` | Get conversation thread |

### HubSpot

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/hubspot/auth-url` | Get OAuth redirect URL |
| GET | `/api/hubspot/callback` | OAuth callback handler |
| DELETE | `/api/hubspot/disconnect` | Remove HubSpot tokens |
| GET | `/api/hubspot/contact?email=...` | Search contact by email |

### Webhooks

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/webhook/freshdesk` | Receive Freshdesk webhook events |
| GET | `/api/webhook/logs` | List all webhook logs |
| DELETE | `/api/webhook/logs/:id` | Delete a single log |
| DELETE | `/api/webhook/logs` | Clear all logs |

---

## Webhook Configuration (Freshdesk)

### Step 1 — Your webhook endpoint

```
http://localhost:5000/api/webhook/freshdesk
```

> For local testing, expose your server using [ngrok](https://ngrok.com):
> ```bash
> ngrok http 5000
> # Use the generated URL: https://xxxx.ngrok.io/api/webhook/freshdesk
> ```

### Step 2 — Create an Automation in Freshdesk

1. Go to **Admin** → **Workflows** → **Automations**
2. Choose **Ticket Creation** or **Ticket Updates** tab
3. Click **New Rule**
4. Set any condition (e.g., "Status is Open")
5. Under **Actions**, add **Trigger Webhook**:
   - **Request Type:** POST
   - **URL:** Your webhook URL
   - **Encoding:** JSON
   - **Content:** Simple (or custom JSON)
6. Save the rule

### Step 3 — Verify

Create or update a ticket in Freshdesk. Within seconds it should appear in the portal's **Webhook Logs** page.

---

## Deployment (Render / Railway / Fly.io)

1. Set all environment variables on the platform
2. Update `HUBSPOT_REDIRECT_URI` to your production backend URL
3. Update `FRONTEND_URL` to your production frontend URL
4. Deploy the `backend/` folder

---

