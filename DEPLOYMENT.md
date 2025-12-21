# Cluebase AI - Production Deployment Guide

Complete guide for deploying Cluebase AI as a self-hosted SaaS platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare (CDN/WAF)                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Traefik (Reverse Proxy + SSL)                │
│                                                                  │
│  api.cluebase.ai ───────────────────────────► API Container     │
│  cluebase.ai ───────────────────────────────► Dashboard          │
│  supabase.cluebase.ai ──────────────────────► Kong (Supabase)    │
│  traefik.cluebase.ai ───────────────────────► Traefik Dashboard  │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     API      │     │     Dashboard    │     │     Worker       │
│  (Express)   │     │   (Next.js)      │     │  (Background)    │
└──────┬───────┘     └──────────────────┘     └────────┬─────────┘
       │                                               │
       └───────────────────┬───────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Internal Network                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  Kong   │  │  Redis  │  │  Auth   │  │ Storage │            │
│  │ Gateway │  │  Cache  │  │ GoTrue  │  │   API   │            │
│  └────┬────┘  └─────────┘  └─────────┘  └─────────┘            │
│       │                                                          │
│  ┌────┴────────────────────────────────────────────────────┐    │
│  │                   PostgreSQL + pgvector                  │    │
│  │                   (Self-hosted Supabase)                 │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Multi-Tenant Credential Model

Cluebase AI separates platform and workspace credentials:

### Platform Credentials (Shared by all tenants)
| Credential | Purpose | Where |
|------------|---------|-------|
| `GEMINI_API_KEY` | AI embeddings & generation | .env |
| `SUPABASE_*` | Self-hosted database | .env |
| `STRIPE_*` | Billing & subscriptions | .env |
| `SMTP_*` | Transactional emails | .env |

### Per-Workspace Credentials (Configured by users)
| Credential | Purpose | Where |
|------------|---------|-------|
| Slack Bot Token | Bot messaging | Database (`bots` table) |
| Slack App Token | Socket mode | Database (`bots` table) |
| Google Drive credentials | Document sync | Database (`bots` table) |
| Website URL | Content scraping | Database (`bots` table) |

The platform **works without any Slack credentials** - users configure their own bots via the dashboard.

---

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Docker & Docker Compose v2+
- Domain with DNS access
- At least 4GB RAM, 2 vCPUs, 40GB SSD

### Recommended Providers
- **VPS**: Hetzner, DigitalOcean, Vultr
- **CDN/DNS**: Cloudflare (free tier works)
- **Email**: Resend (easiest setup)
- **Payments**: Stripe

---

## Deployment Steps

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose v2
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

### 2. Clone Repository

```bash
# Create app directory
sudo mkdir -p /opt/teambrain
sudo chown $USER:$USER /opt/teambrain
cd /opt/teambrain

# Clone with PAT (or use SSH)
git clone https://github.com/MiscMich/teambrain-ai.git .
```

### 3. Generate Secrets

```bash
# Generate all required secrets
chmod +x scripts/generate-keys.sh
./scripts/generate-keys.sh > .supabase.secrets

# View generated secrets
cat .supabase.secrets
```

### 4. Configure Environment

```bash
# Copy production template
cp .env.production .env

# Edit with your values
nano .env
```

**Required values to fill in:**
- `GEMINI_API_KEY` - From Google AI Studio
- `POSTGRES_PASSWORD` - From generated secrets
- `JWT_SECRET` - From generated secrets
- `SECRET_KEY_BASE` - From generated secrets
- `SUPABASE_ANON_KEY` - From generated secrets
- `SUPABASE_SERVICE_ROLE_KEY` - From generated secrets
- `DOMAIN` - Your domain (e.g., cluebase.ai)
- `ACME_EMAIL` - For SSL certificates
- `STRIPE_*` - From Stripe dashboard (optional for testing)
- `SMTP_*` - From email provider (optional for testing)

### 5. Configure DNS

Add these DNS records in your DNS provider (e.g., Cloudflare):

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | YOUR_SERVER_IP | Yes |
| A | api | YOUR_SERVER_IP | Yes |
| A | www | YOUR_SERVER_IP | Yes |
| A | traefik | YOUR_SERVER_IP | No* |

*Disable proxy for Traefik dashboard for basic auth to work.

### 6. Configure Traefik

```bash
# Create Traefik dynamic config directory
mkdir -p traefik/dynamic
```

Create `traefik/dynamic/middleware.yml`:

```yaml
http:
  middlewares:
    security-headers:
      headers:
        stsSeconds: 31536000
        stsIncludeSubdomains: true
        stsPreload: true
        frameDeny: true
        contentTypeNosniff: true
        browserXssFilter: true

    cors-api:
      headers:
        accessControlAllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
          - OPTIONS
        accessControlAllowHeaders:
          - Content-Type
          - Authorization
        accessControlAllowOriginList:
          - https://cluebase.ai
          - https://www.cluebase.ai
        accessControlMaxAge: 86400
        addVaryHeader: true

    rate-limit:
      rateLimit:
        average: 100
        burst: 50

    compress:
      compress: {}
```

### 7. Create Kong Configuration

```bash
mkdir -p supabase
```

Create `supabase/kong.yml`:

```yaml
_format_version: "2.1"
_transform: true

services:
  - name: auth-v1
    url: http://auth:9999/
    routes:
      - name: auth-v1-all
        strip_path: true
        paths:
          - /auth/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false

  - name: rest-v1
    url: http://rest:3000/
    routes:
      - name: rest-v1-all
        strip_path: true
        paths:
          - /rest/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false

  - name: realtime-v1
    url: http://realtime:4000/socket/
    routes:
      - name: realtime-v1-all
        strip_path: true
        paths:
          - /realtime/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false

  - name: storage-v1
    url: http://storage:5000/
    routes:
      - name: storage-v1-all
        strip_path: true
        paths:
          - /storage/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: false

consumers:
  - username: anon
    keyauth_credentials:
      - key: ${SUPABASE_ANON_KEY}

  - username: service_role
    keyauth_credentials:
      - key: ${SUPABASE_SERVICE_KEY}

acls:
  - consumer: anon
    group: anon
  - consumer: service_role
    group: admin

plugins:
  - name: cors
    config:
      origins:
        - '*'
      methods:
        - GET
        - POST
        - PUT
        - DELETE
        - PATCH
        - OPTIONS
      headers:
        - Accept
        - Accept-Version
        - Content-Length
        - Content-Type
        - Date
        - X-Auth-Token
        - Authorization
        - apikey
      exposed_headers:
        - X-Total-Count
      credentials: true
      max_age: 3600
```

### 8. Initialize Database

```bash
mkdir -p supabase/init
```

Create `supabase/init/00-extensions.sql`:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Copy migration files:

```bash
cp supabase/migrations/*.sql supabase/init/
```

### 9. Deploy

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Watch logs
docker compose -f docker-compose.prod.yml logs -f

# Check service health
docker compose -f docker-compose.prod.yml ps
```

### 10. Verify Deployment

```bash
# Health check
curl https://api.YOUR_DOMAIN/health

# Expected response:
# {"status":"healthy","services":{"supabase":true,"gemini":true}}
```

---

## Service Descriptions

| Service | Port | Description |
|---------|------|-------------|
| `api` | 3000 | Backend API + Slack bot manager |
| `dashboard` | 3001 | Next.js admin UI |
| `worker` | - | Background jobs (sync, scraping) |
| `db` | 5432 | PostgreSQL with pgvector |
| `redis` | 6379 | Cache + job queue |
| `kong` | 8000 | Supabase API gateway |
| `auth` | 9999 | GoTrue authentication |
| `rest` | 3000 | PostgREST |
| `realtime` | 4000 | Supabase Realtime |
| `storage` | 5000 | Supabase Storage |
| `studio` | 3080 | Supabase Studio (admin) |
| `traefik` | 80/443 | Reverse proxy + SSL |

---

## Monitoring & Maintenance

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

### Restart Services

```bash
# Single service
docker compose -f docker-compose.prod.yml restart api

# All services
docker compose -f docker-compose.prod.yml restart
```

### Update Deployment

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build
```

### Database Backup

```bash
# Run backup script
./scripts/backup.sh

# Or manual backup
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U postgres postgres > backup-$(date +%Y%m%d).sql
```

### Scaling Workers

To run multiple worker instances:

```bash
docker compose -f docker-compose.prod.yml up -d --scale worker=3
```

---

## Troubleshooting

### API Not Starting

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs api

# Common issues:
# - Missing environment variables
# - Database not ready (wait for health check)
# - Port already in use
```

### Database Connection Failed

```bash
# Verify database is running
docker compose -f docker-compose.prod.yml ps db

# Check database logs
docker compose -f docker-compose.prod.yml logs db

# Test connection
docker compose -f docker-compose.prod.yml exec db psql -U postgres -c '\l'
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker compose -f docker-compose.prod.yml logs traefik

# Verify DNS is pointing to server
dig api.YOUR_DOMAIN

# Check certificate status
curl -vI https://api.YOUR_DOMAIN 2>&1 | grep -i cert
```

### Redis Connection Issues

```bash
# Check Redis is running
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
# Should return: PONG
```

---

## Security Checklist

- [ ] Strong passwords generated for all secrets
- [ ] SSL certificates active (check https://)
- [ ] Cloudflare WAF enabled
- [ ] Database not exposed to internet (internal network only)
- [ ] Traefik dashboard protected with basic auth
- [ ] Regular backups configured
- [ ] Supabase Studio protected (internal access only)
- [ ] Rate limiting enabled in Traefik

---

## Cloudflare Setup (Recommended)

1. Add your domain to Cloudflare
2. Enable "Full (strict)" SSL mode
3. Configure firewall rules:
   - Allow legitimate traffic
   - Block known bad actors
4. Enable "Under Attack" mode if needed
5. Set up Page Rules for caching static assets

---

## Stripe Configuration

1. Create products in Stripe Dashboard
2. Create pricing tiers (Starter, Pro, Business)
3. Set up webhooks pointing to `https://api.YOUR_DOMAIN/api/webhooks/stripe`
4. Configure webhook events: `customer.subscription.*`, `checkout.session.completed`
5. Add price IDs to `.env`

---

## Next Steps After Deployment

1. **Create Admin Account**: Sign up at `https://YOUR_DOMAIN`
2. **Configure Platform**: Set up billing plans in Stripe
3. **Test Workflow**: Create workspace → Add bot → Test Slack integration
4. **Monitor**: Check logs regularly, set up alerts
5. **Backup**: Configure automated database backups
