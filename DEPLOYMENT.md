# Villa Paraiso Bot - Deployment Guide

This guide covers deploying the Villa Paraiso Slack AI Assistant for internal company use.

## Prerequisites

- Docker and Docker Compose installed
- Supabase project set up with pgvector extension
- Google Cloud project with Drive API and OAuth credentials
- Slack App configured with Bot Token and App Token
- Google Gemini API key

## Quick Start (Docker)

### 1. Clone and Configure

```bash
# Clone the repository
git clone <your-repo-url>
cd villa-paraiso-bot

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 2. Configure Environment Variables

Required variables in `.env`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth (for Drive sync)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://your-server:3000/auth/google/callback
GOOGLE_DRIVE_FOLDER_ID=your-folder-id

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# Docker deployment
API_PORT=3000
DASHBOARD_PORT=3001
NEXT_PUBLIC_API_URL=http://your-server:3000
```

### 3. Deploy with Docker Compose

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Check service health
docker compose ps
```

### 4. Verify Deployment

- API Health: `http://your-server:3000/health`
- Dashboard: `http://your-server:3001`

## Service Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Your Server                        │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┐         ┌─────────────────┐        │
│  │   API       │◀───────▶│   Dashboard     │        │
│  │  :3000      │         │   :3001         │        │
│  │             │         │                 │        │
│  │ - Slack Bot │         │ - Admin UI      │        │
│  │ - RAG       │         │ - Analytics     │        │
│  │ - Drive Sync│         │ - Documents     │        │
│  └──────┬──────┘         └─────────────────┘        │
│         │                                            │
└─────────┼────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│                 External Services                    │
├─────────────────────────────────────────────────────┤
│  • Supabase (Database + pgvector)                   │
│  • Google Gemini (AI/Embeddings)                    │
│  • Google Drive (Document Source)                    │
│  • Slack (Bot Platform)                             │
└─────────────────────────────────────────────────────┘
```

## Manual Deployment (Without Docker)

### 1. Install Dependencies

```bash
# Install pnpm if not installed
npm install -g pnpm

# Install project dependencies
pnpm install
```

### 2. Build Applications

```bash
# Build shared package
pnpm --filter @villa-paraiso/shared build

# Build API
pnpm --filter @villa-paraiso/api build

# Build Dashboard
pnpm --filter @villa-paraiso/dashboard build
```

### 3. Start Services

```bash
# Terminal 1: Start API
cd apps/api
NODE_ENV=production node dist/index.js

# Terminal 2: Start Dashboard
cd apps/dashboard
NODE_ENV=production pnpm start
```

## Database Setup

### Run Migrations

The Supabase migrations are in `supabase/migrations/`. Apply them in order:

1. `20240101000000_initial_schema.sql` - Base tables
2. `20240101000001_add_thread_tables.sql` - Conversation tracking
3. `20240101000002_add_analytics_tables.sql` - Analytics events

### Enable pgvector

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;
```

## Slack App Configuration

### Required Scopes (Bot Token)

- `app_mentions:read` - Detect @mentions
- `chat:write` - Send messages
- `channels:history` - Read channel messages
- `groups:history` - Read private channel messages
- `im:history` - Read DM messages
- `reactions:write` - Add reactions

### Event Subscriptions

Enable Socket Mode and subscribe to:
- `app_mention` - When bot is @mentioned
- `message.im` - Direct messages

### App Token

Generate an App-Level Token with `connections:write` scope.

## Google Drive Setup

### 1. Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable Google Drive API
4. Create OAuth 2.0 credentials (Web application)
5. Add redirect URI: `http://your-server:3000/auth/google/callback`

### 2. Connect Drive

1. Access dashboard at `http://your-server:3001`
2. Go to Settings → Google Drive
3. Click "Connect Google Drive"
4. Authorize the application
5. Documents will auto-sync every 5 minutes

## Monitoring & Maintenance

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Response:
{
  "status": "healthy",
  "uptime": 12345,
  "services": {
    "supabase": true,
    "slack": true,
    "gemini": true,
    "googleDrive": true
  }
}
```

### Logs

```bash
# Docker logs
docker compose logs -f api
docker compose logs -f dashboard

# Filter by service
docker compose logs -f api 2>&1 | grep "error"
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart api
```

### Update Deployment

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build
```

## Troubleshooting

### Common Issues

**Slack bot not responding:**
- Check `SLACK_BOT_TOKEN` and `SLACK_APP_TOKEN` are correct
- Verify Socket Mode is enabled in Slack App settings
- Check API logs for connection errors

**Documents not syncing:**
- Verify Google Drive is connected in Settings
- Check `GOOGLE_DRIVE_FOLDER_ID` points to correct folder
- Look for sync errors in API logs

**Dashboard can't connect to API:**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- For Docker: use `http://api:3000` for internal networking
- Check CORS settings if using custom domain

**Database errors:**
- Verify Supabase credentials
- Ensure pgvector extension is enabled
- Check if migrations have been applied

### Debug Mode

```bash
# Run with debug logging
LOG_LEVEL=debug docker compose up
```

## Security Considerations

1. **Never commit `.env` files** - Keep credentials secure
2. **Use HTTPS in production** - Configure reverse proxy (nginx/traefik)
3. **Rotate API keys regularly** - Update Slack/Google/Gemini keys periodically
4. **Database security** - Use Supabase RLS policies
5. **Network isolation** - Use Docker networks to isolate services

## Reverse Proxy (Optional)

For production with HTTPS, use nginx or similar:

```nginx
# /etc/nginx/sites-available/villabot
server {
    listen 80;
    server_name bot.yourcompany.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name bot.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/bot.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot.yourcompany.com/privkey.pem;

    # API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Dashboard
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Support

For issues or questions:
1. Check the logs for error messages
2. Review the troubleshooting section above
3. Contact the development team
