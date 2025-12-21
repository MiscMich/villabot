# Cluebase AI - Setup Guide

Quick start guide for local development and production deployment.

## Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 8+** - Install: `npm install -g pnpm`
- **Docker** (for deployment) - [Download](https://docker.com/)
- **Git** - [Download](https://git-scm.com/)

## Required External Accounts

| Service | Purpose | Where to Get |
|---------|---------|--------------|
| **Supabase** | Database + Auth | [supabase.com](https://supabase.com) or self-host |
| **Google Cloud** | Drive API + Gemini AI | [console.cloud.google.com](https://console.cloud.google.com) |
| **Stripe** | Billing | [stripe.com](https://stripe.com) |
| **Slack** | Bot integration | [api.slack.com](https://api.slack.com) (per workspace) |

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/MiscMich/cluebase-ai.git
cd cluebase-ai
pnpm install
```

### 2. Supabase Setup

#### Option A: Supabase Cloud (Recommended for development)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings > API to get:
   - Project URL → `SUPABASE_URL`
   - anon public → `SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY`

#### Option B: Self-Hosted Supabase

```bash
# Generate secrets
./scripts/generate-keys.sh > .supabase.secrets
cat .supabase.secrets >> .env

# Start Supabase
docker compose -f docker-compose.supabase.yml up -d
```

### 3. Run Database Migrations

In Supabase SQL Editor (or using CLI), run each migration in order:

```bash
# Files in supabase/migrations/
001_initial_schema.sql
002_learned_facts_function.sql
005_error_logs.sql
006_multi_bot_platform.sql
007_feedback_system.sql
008_workspaces_foundation.sql
009_add_workspace_id.sql
010_rls_policies.sql
011_subscriptions.sql
012_usage_tracking.sql
013_enforce_workspace_isolation.sql
014_platform_admin.sql
015_bot_health.sql
```

### 4. Google Cloud Setup

#### Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project
3. Enable APIs:
   - Google Drive API
   - Google Docs API
   - Google Sheets API

#### Create OAuth Credentials
1. Go to APIs & Services > Credentials
2. Configure OAuth consent screen
3. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/api/google-drive/callback`
4. Copy Client ID and Secret

#### Get Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create API key

### 5. Configure Environment

```bash
# API server config
cp .env.example apps/api/.env

# Dashboard config
cp .env.example apps/dashboard/.env.local
```

Edit `apps/api/.env`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback
GEMINI_API_KEY=your-gemini-key

# App URLs
API_URL=http://localhost:3000
APP_URL=http://localhost:3001
```

Edit `apps/dashboard/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Cluebase AI
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### 6. Start Development Servers

```bash
# Terminal 1: API server (port 3000)
pnpm dev

# Terminal 2: Dashboard (port 3001)
pnpm dev:dashboard
```

### 7. Access Application

- **Dashboard**: http://localhost:3001
- **API**: http://localhost:3000
- **API Health**: http://localhost:3000/health

---

## Stripe Setup (For Billing)

### 1. Create Stripe Account
Go to [stripe.com](https://stripe.com) and register.

### 2. Get API Keys
Dashboard > Developers > API keys
- Use test keys for development (`sk_test_...`)
- Use live keys for production (`sk_live_...`)

### 3. Create Products

Create 3 products in Stripe Dashboard:

| Product | Price | Description |
|---------|-------|-------------|
| Starter | $19/mo | 500 queries, 100 docs, 1 bot |
| Pro | $49/mo | 2000 queries, 500 docs, 3 bots |
| Business | $149/mo | 10000 queries, unlimited docs, 10 bots |

Copy each Price ID.

### 4. Configure Webhook

For local development:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

For production:
1. Go to Developers > Webhooks
2. Add endpoint: `https://api.yourdomain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

### 5. Add to Environment

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
```

---

## Slack App Setup

Each workspace creates their own Slack app. Here's how:

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create New App > From Manifest
3. Use this manifest:

```yaml
display_information:
  name: Cluebase AI
  description: AI-powered knowledge assistant
  background_color: "#4A154B"
features:
  app_home:
    home_tab_enabled: true
    messages_tab_enabled: true
  bot_user:
    display_name: Cluebase
    always_online: true
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - channels:history
      - channels:read
      - chat:write
      - groups:history
      - groups:read
      - im:history
      - im:read
      - im:write
      - mpim:history
      - reactions:write
      - users:read
settings:
  event_subscriptions:
    bot_events:
      - app_mention
      - message.channels
      - message.groups
      - message.im
  socket_mode_enabled: true
  token_rotation_enabled: false
```

### 2. Get Credentials

- **Bot Token** (`xoxb-...`): OAuth & Permissions > Bot User OAuth Token
- **App Token** (`xapp-...`): Basic Information > App-Level Tokens (create with `connections:write` scope)
- **Signing Secret**: Basic Information > App Credentials

### 3. Install to Workspace

1. OAuth & Permissions > Install to Workspace
2. Authorize the app
3. Invite bot to channels: `/invite @Cluebase`

---

## Verification

### Check API Health
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Check Database Connection
```bash
curl http://localhost:3000/api/config
# Should return workspace config (may need auth)
```

### Check Dashboard
Open http://localhost:3001 - should see login page

---

## Troubleshooting

### "Cannot find module" errors
```bash
pnpm install
pnpm build
```

### Database connection issues
- Check Supabase is running
- Verify URL and keys in `.env`
- Check RLS policies are not blocking

### Google OAuth errors
- Verify redirect URI matches exactly
- Check OAuth consent screen is configured
- Ensure APIs are enabled

### Stripe webhook issues
- Use `stripe listen` for local development
- Check webhook secret matches
- Verify endpoint URL is correct

---

## Next Steps

1. **Deploy to Production**: See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
2. **Create First Workspace**: Sign up through dashboard
3. **Configure Knowledge Sources**: Add Google Drive folder or website
4. **Connect Slack Bot**: Add Slack credentials in bot settings
5. **Invite Team**: Add team members to workspace
