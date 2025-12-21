# Cluebase AI - Coolify Deployment Guide

Complete guide for deploying Cluebase AI using Coolify for simplified self-hosted deployment.

## Why Coolify?

- **One-Click Supabase**: Deploy the full Supabase stack with a template
- **Git-Based Deployments**: Push to GitHub → automatic deploy
- **Automatic SSL**: Traefik handles SSL certificates automatically
- **Self-Hosted UI**: Manage all services from a web dashboard
- **No Docker Compose Complexity**: Coolify abstracts Docker management

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Coolify Dashboard (:8000)                   │
│                   (Service Management + Logs)                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────┐
│                     Coolify/Traefik (SSL + Routing)              │
│                                                                  │
│  cluebase.ai ───────────────────────────► Dashboard (Next.js)   │
│  api.cluebase.ai ───────────────────────► API (Express)         │
│  supabase.cluebase.ai ──────────────────► Supabase (Kong)       │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     API      │     │     Dashboard    │     │     Supabase     │
│  (Express)   │     │   (Next.js)      │     │  (Full Stack)    │
│   :3000      │     │    :3001         │     │  PostgreSQL+     │
└──────────────┘     └──────────────────┘     └──────────────────┘
```

## Prerequisites

- **Server**: Linux VPS with at least 4GB RAM, 2 vCPUs, 40GB SSD
- **Domain**: DNS access to configure A records
- **Providers**:
  - VPS: Hetzner, DigitalOcean, Vultr
  - DNS: Cloudflare (recommended)

---

## Step 1: Install Coolify

SSH to your server and run the Coolify installer:

```bash
# Install Coolify (one-liner)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

After installation:
1. Access Coolify at `http://YOUR_SERVER_IP:8000`
2. Create your admin account
3. The localhost server is auto-configured

---

## Step 2: Configure DNS

Add these DNS records in your DNS provider (e.g., Cloudflare):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | YOUR_SERVER_IP | Yes |
| A | api | YOUR_SERVER_IP | Yes |
| A | supabase | YOUR_SERVER_IP | Yes |
| A | www | YOUR_SERVER_IP | Yes |

---

## Step 3: Deploy Supabase

In Coolify UI:

1. **Services** → **+ New Service**
2. Search for **Supabase** template
3. Configure:
   - **Domain**: `supabase.cluebase.ai`
   - Leave other defaults
4. Click **Deploy**

Wait for all Supabase components to start (PostgreSQL, Kong, GoTrue, PostgREST, Realtime, Storage, Studio).

### Capture Supabase Credentials

From the Coolify Supabase service dashboard, note these values:
- `SUPABASE_URL`: `https://supabase.cluebase.ai`
- `SUPABASE_ANON_KEY`: (from service configuration)
- `SUPABASE_SERVICE_ROLE_KEY`: (from service configuration)
- `JWT_SECRET`: (from service configuration)

---

## Step 4: Apply Database Migrations

Access the Supabase Studio at `https://supabase.cluebase.ai` and run the migrations:

1. Go to **SQL Editor**
2. Run migrations from `supabase/migrations/` in order:
   - `00001_initial_schema.sql`
   - `00002_...` (continue in order)

Or use the Supabase CLI:

```bash
# From your local machine with migrations folder
supabase db push --db-url "postgresql://postgres:PASSWORD@supabase.cluebase.ai:5432/postgres"
```

---

## Step 5: Deploy API Service

In Coolify UI:

1. **Resources** → **+ New** → **Docker Compose**
2. Configure Git:
   - **Repository**: `https://github.com/MiscMich/cluebase-ai`
   - **Branch**: `main`
   - **Compose file path**: `apps/api/docker-compose.coolify.yml`
3. **Domain**: `api.cluebase.ai`
4. Add environment variables (from **Environment Variables** tab):

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Supabase (from Step 3)
SUPABASE_URL=https://supabase.cluebase.ai
SUPABASE_ANON_KEY=your-anon-key-from-coolify
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-coolify

# AI
GEMINI_API_KEY=your-gemini-api-key

# URLs
API_URL=https://api.cluebase.ai
APP_URL=https://cluebase.ai

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe (optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

5. Click **Deploy**

---

## Step 6: Deploy Dashboard Service

In Coolify UI:

1. **Resources** → **+ New** → **Docker Compose**
2. Configure Git:
   - **Repository**: `https://github.com/MiscMich/cluebase-ai`
   - **Branch**: `main`
   - **Compose file path**: `apps/dashboard/docker-compose.coolify.yml`
3. **Domain**: `cluebase.ai`
4. Add environment variables:

```env
NODE_ENV=production
PORT=3001

# Supabase Anon Key (for build args - CRITICAL!)
SUPABASE_ANON_KEY=your-anon-key-from-coolify

# Internal API URL (for server-side calls)
API_URL=http://api:3000
```

**Important**: The `NEXT_PUBLIC_*` variables are baked into the build via the `docker-compose.coolify.yml` build args. Verify they match your domain.

5. Click **Deploy**

---

## Step 7: Verify Deployment

### Health Checks

```bash
# API health
curl https://api.cluebase.ai/health
# Expected: {"status":"healthy","services":{"supabase":true,"gemini":true}}

# Dashboard
curl -I https://cluebase.ai
# Expected: HTTP/2 200
```

### Test Authentication

1. Go to `https://cluebase.ai`
2. Sign up for a new account
3. Complete the onboarding wizard

---

## Environment Variables Reference

### API Service

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase API URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `API_URL` | Yes | Public API URL |
| `APP_URL` | Yes | Public dashboard URL |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | No | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook secret |
| `REDIS_URL` | No | Redis URL (defaults to redis://redis:6379) |
| `LOG_LEVEL` | No | Log level (default: info) |

### Dashboard Service

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_ANON_KEY` | Yes | Used in build args |
| `API_URL` | Yes | Internal API URL for server-side calls |

**Build Args** (set in docker-compose.coolify.yml):
- `NEXT_PUBLIC_API_URL`: `https://api.cluebase.ai`
- `NEXT_PUBLIC_SUPABASE_URL`: `https://supabase.cluebase.ai`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: From Coolify secrets
- `NEXT_PUBLIC_APP_NAME`: `Cluebase AI`
- `NEXT_PUBLIC_APP_URL`: `https://cluebase.ai`

---

## Auto-Deployments

Coolify supports automatic deployments on git push:

1. In the service settings, enable **Auto Deploy**
2. Add the Coolify webhook URL to your GitHub repository
3. Every push to `main` triggers a new deployment

---

## Monitoring & Logs

### View Logs

From Coolify dashboard:
1. Click on a service
2. Go to **Logs** tab
3. View real-time logs

### Health Monitoring

Coolify automatically monitors container health using the healthcheck defined in docker-compose files.

---

## Backup Strategy

### Database Backup

Coolify Supabase template includes a database. To backup:

```bash
# SSH to server
ssh root@YOUR_SERVER_IP

# Find the PostgreSQL container
docker ps | grep postgres

# Create backup
docker exec POSTGRES_CONTAINER_ID pg_dump -U postgres postgres > backup.sql
```

### Automated Backups

Configure in Coolify under the Supabase service → **Backups**.

---

## Troubleshooting

### Dashboard Shows Loading/Signing In

**Cause**: `NEXT_PUBLIC_*` variables not baked into build.

**Solution**:
1. Verify build args in `apps/dashboard/docker-compose.coolify.yml`
2. Force rebuild in Coolify (Deploy → Rebuild)

### API Connection Failed

**Cause**: Supabase credentials incorrect or service not running.

**Solution**:
1. Check Supabase service is running in Coolify
2. Verify `SUPABASE_URL` and keys match

### SSL Certificate Issues

**Cause**: DNS not propagated or Cloudflare proxy issues.

**Solution**:
1. Wait for DNS propagation (check with `dig YOUR_DOMAIN`)
2. If using Cloudflare, ensure SSL mode is "Full (strict)"

### Container Keeps Restarting

**Cause**: Missing environment variables or dependency issues.

**Solution**:
1. Check container logs in Coolify
2. Verify all required environment variables are set
3. Check healthcheck is passing

---

## Updating the Application

### From Coolify UI

1. Go to the service
2. Click **Deploy** → **Redeploy**

### From Git Push

If auto-deploy is enabled, just push to `main`:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

---

## Security Checklist

- [ ] Coolify admin password is strong
- [ ] Supabase Studio access is secured
- [ ] All environment variables use secrets (not plaintext)
- [ ] SSL certificates are active on all domains
- [ ] Cloudflare WAF enabled (if using Cloudflare)
- [ ] Regular database backups configured

---

## Support

- **Coolify Docs**: https://coolify.io/docs
- **Supabase Docs**: https://supabase.com/docs
- **GitHub Issues**: https://github.com/MiscMich/cluebase-ai/issues
