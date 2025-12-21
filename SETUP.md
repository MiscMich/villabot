# TeamBrain AI - Setup Instructions

Complete setup guide for the TeamBrain AI SaaS platform.

## Prerequisites

- Node.js 18+
- pnpm (package manager)
- Supabase account (for database and auth)
- Stripe account (for billing)
- Slack App credentials
- Google Cloud Console credentials (for Drive integration)
- Gemini API key (for AI)

## 1. Clone and Install

```bash
git clone https://github.com/MiscMich/teambrain-ai.git
cd teambrain-ai
pnpm install
```

## 2. Environment Setup

### API Server (`apps/api/.env`)

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Provider
GEMINI_API_KEY=your-gemini-api-key

# Google Drive OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-drive/callback

# Stripe (for billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...

# App Config
APP_URL=http://localhost:3001
API_URL=http://localhost:3000
NODE_ENV=development
```

### Dashboard (`apps/dashboard/.env.local`)

```env
# Supabase (client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API URL
NEXT_PUBLIC_API_URL=http://localhost:3000

# App Configuration
NEXT_PUBLIC_APP_NAME=TeamBrain AI
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## 3. Database Setup

### Apply Migrations to Supabase

Run migrations in order in the Supabase SQL editor:

1. `supabase/migrations/001_documents.sql` - Documents table
2. `supabase/migrations/002_document_chunks.sql` - Vector embeddings
3. `supabase/migrations/003_thread_sessions.sql` - Conversation threads
4. `supabase/migrations/004_learned_facts.sql` - Knowledge corrections
5. `supabase/migrations/005_analytics.sql` - Usage analytics
6. `supabase/migrations/006_multi_bot_platform.sql` - Multi-bot support
7. `supabase/migrations/007_feedback_system.sql` - User feedback
8. `supabase/migrations/008_workspaces_foundation.sql` - Multi-tenant workspaces
9. `supabase/migrations/009_add_workspace_id.sql` - Workspace isolation
10. `supabase/migrations/010_rls_policies.sql` - Row-level security
11. `supabase/migrations/011_subscriptions.sql` - Stripe billing
12. `supabase/migrations/012_usage_tracking.sql` - Tier enforcement
13. `supabase/migrations/013_enforce_workspace_isolation.sql` - NOT NULL constraints
14. `supabase/migrations/014_platform_admin.sql` - Admin roles
15. `supabase/migrations/015_bot_health.sql` - Health monitoring

### Enable pgvector Extension

In Supabase SQL editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 4. Supabase Auth Configuration

1. Go to Supabase Dashboard → Authentication → Providers
2. Enable Email provider
3. Configure email templates for:
   - Confirmation email
   - Password reset email
   - Magic link email

### Site URL Settings

1. Go to Authentication → URL Configuration
2. Set Site URL: `http://localhost:3001`
3. Add redirect URLs:
   - `http://localhost:3001/auth/callback`
   - `http://localhost:3001/setup`

## 5. Stripe Configuration

### Create Products and Prices

1. Create three products in Stripe Dashboard:
   - **Starter** - Basic tier
   - **Pro** - Professional tier
   - **Business** - Enterprise tier

2. Create monthly prices for each product

3. Copy the price IDs to your `.env` file

### Webhook Setup

1. Create a webhook endpoint: `https://your-api-domain.com/api/webhooks/stripe`
2. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

## 6. Google OAuth Setup

1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Set authorized redirect URI: `http://localhost:3000/api/google-drive/callback`
4. Enable Google Drive API

## 7. Slack App Configuration

### Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app and select workspace

### Configure Bot Token Scopes

Under OAuth & Permissions → Bot Token Scopes, add:
- `app_mentions:read`
- `channels:history`
- `channels:read`
- `chat:write`
- `groups:history`
- `groups:read`
- `im:history`
- `im:read`
- `users:read`

### Enable Socket Mode

1. Go to Socket Mode → Enable Socket Mode
2. Generate an App-Level Token with `connections:write` scope
3. This gives you the `SLACK_APP_TOKEN` (starts with `xapp-`)

### Install to Workspace

1. Go to Install App → Install to Workspace
2. Copy the Bot User OAuth Token (`SLACK_BOT_TOKEN`, starts with `xoxb-`)

### Event Subscriptions

Under Event Subscriptions → Subscribe to bot events:
- `app_mention`
- `message.channels`
- `message.groups`
- `message.im`

## 8. Running the Application

### Development Mode

```bash
# Terminal 1 - API Server
pnpm dev

# Terminal 2 - Dashboard
pnpm dev:dashboard
```

### Production Mode

```bash
# Build all packages
pnpm build

# Start API server
cd apps/api && pnpm start

# Start Dashboard
cd apps/dashboard && pnpm start
```

### Using Docker

```bash
docker compose up -d --build
```

## 9. First-Time Setup

1. Open `http://localhost:3001` in your browser
2. Click "Get Started" or "Sign Up"
3. Create an account with your email
4. Verify your email (check spam folder)
5. Log in and complete the setup wizard:
   - **Step 1**: Welcome
   - **Step 2**: Create workspace (name & slug)
   - **Step 3**: Connect Slack (paste tokens)
   - **Step 4**: Connect Google Drive (OAuth flow)
   - **Step 5**: Configure knowledge sources
   - **Step 6**: Create your first bot
   - **Step 7**: Review and launch

## 10. Post-Setup Tasks

### Sync Google Drive Documents

The system will automatically sync documents from your connected Google Drive folders.

### Test Your Bot

1. Invite your bot to a Slack channel
2. Mention the bot: `@YourBotName what documents do you have?`
3. The bot should respond with information from your knowledge base

## Troubleshooting

### "Supabase environment variables not set"

Ensure you have created `apps/dashboard/.env.local` with the `NEXT_PUBLIC_*` prefixed variables.

### "Email address is invalid" during signup

Supabase blocks some email domains by default. Use a real email address (not test@example.com).

### Bot not responding in Slack

1. Check that the bot is running: `pnpm dev`
2. Verify Slack tokens are correct
3. Check bot is invited to the channel
4. Review logs for errors

### Database connection errors

1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Check that migrations have been applied
3. Ensure pgvector extension is enabled

### Type errors during build

```bash
# Clean and rebuild
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
pnpm build
```

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │    │   Slack Apps    │
│  (Next.js 15)   │    │  (Multiple)     │
│   Port 3001     │    │                 │
└────────┬────────┘    └────────┬────────┘
         │                      │
         └──────────┬───────────┘
                    │
         ┌──────────▼──────────┐
         │      API Server      │
         │    (Express.js)      │
         │      Port 3000       │
         └──────────┬───────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
    ▼               ▼               ▼
┌────────┐   ┌──────────┐   ┌────────────┐
│Supabase│   │  Gemini  │   │Google Drive│
│(DB+Auth)│   │  (AI)    │   │   (Docs)   │
└────────┘   └──────────┘   └────────────┘
```

## Support

For issues and feature requests, visit:
https://github.com/MiscMich/teambrain-ai/issues
