# TeamBrain AI - Production Deployment Guide

Complete guide for deploying TeamBrain AI to production on a Hetzner VPS with Docker, Traefik, and SSL.

## Prerequisites

- Hetzner VPS (CX21 or higher recommended)
- Domain name with DNS access
- Docker and Docker Compose installed
- Supabase project (cloud or self-hosted)
- Google Cloud project with Drive API + OAuth
- Stripe account with products/prices configured
- Gemini API key

## Server Setup (Hetzner)

### 1. Create Hetzner VPS

1. Log into Hetzner Cloud Console
2. Create a new server:
   - Location: Choose closest to your users
   - Image: Ubuntu 22.04
   - Type: CX21 (2 vCPU, 4GB RAM) or higher
   - SSH Key: Add your public key
3. Note the server IP address

### 2. Initial Server Configuration

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# Add your user to docker group (if not root)
usermod -aG docker $USER

# Install required tools
apt install -y git wget curl htop
```

### 3. Configure DNS

Point your domain to the server:

| Record | Type | Value |
|--------|------|-------|
| `@` | A | YOUR_SERVER_IP |
| `api` | A | YOUR_SERVER_IP |
| `traefik` | A | YOUR_SERVER_IP (optional) |

Wait for DNS propagation (5-30 minutes).

## Deployment

### 1. Clone Repository

```bash
cd /opt
git clone https://github.com/MiscMich/teambrain-ai.git
cd teambrain-ai
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

**Required Environment Variables:**

```env
# Domain Configuration
DOMAIN=teambrain.app
ACME_EMAIL=admin@teambrain.app

# Traefik Dashboard Auth (generate with: htpasswd -nb admin password)
TRAEFIK_AUTH=admin:$$apr1$$...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Stripe Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
```

### 3. Deploy Services

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f

# Check service health
docker compose ps
```

### 4. Verify Deployment

- Dashboard: `https://teambrain.app`
- API Health: `https://api.teambrain.app/health`
- Traefik Dashboard: `https://traefik.teambrain.app` (if enabled)

## Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│                     Hetzner VPS                          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐                                        │
│  │   Traefik    │◄─── :80/:443                          │
│  │  (Reverse    │                                        │
│  │   Proxy)     │                                        │
│  └──────┬───────┘                                        │
│         │                                                │
│    ┌────┴────┬─────────────────┐                        │
│    │         │                 │                        │
│    ▼         ▼                 ▼                        │
│ ┌──────┐ ┌──────────┐ ┌─────────────┐                  │
│ │ API  │ │Dashboard │ │  (Future)   │                  │
│ │:3000 │ │  :3001   │ │  Supabase   │                  │
│ └──────┘ └──────────┘ └─────────────┘                  │
│                                                          │
│  Docker Network: teambrain-network                       │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│               External Services                          │
├─────────────────────────────────────────────────────────┤
│  • Supabase (Database + Auth)                           │
│  • Google Gemini (AI/Embeddings)                        │
│  • Google Drive (Document Source)                        │
│  • Slack API (Bot Platform)                             │
│  • Stripe (Billing)                                     │
└─────────────────────────────────────────────────────────┘
```

## SSL Certificates

Traefik automatically obtains SSL certificates from Let's Encrypt:

- Certificates are stored in the `letsencrypt` Docker volume
- Auto-renewal happens before expiration
- HTTP-01 challenge is used (requires ports 80/443 open)

### Troubleshooting SSL

```bash
# Check certificate status
docker compose logs traefik | grep -i certificate

# Force certificate renewal
docker compose restart traefik
```

## Service Management

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f dashboard

# Last 100 lines
docker compose logs --tail 100 api
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart api

# Full rebuild
docker compose down && docker compose up -d --build
```

### Update Deployment

```bash
# Pull latest changes
cd /opt/teambrain-ai
git pull

# Rebuild and restart
docker compose up -d --build
```

## Monitoring

### Health Checks

```bash
# API health
curl https://api.teambrain.app/health

# Expected response
{
  "status": "healthy",
  "uptime": 12345,
  "services": {
    "supabase": true,
    "gemini": true
  }
}
```

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
df -h

# Memory usage
free -m
```

### Process Management

```bash
# Running containers
docker compose ps

# Container resource limits
docker inspect teambrain-api | grep -A 10 HostConfig
```

## Backups

### Database Backup (Supabase Cloud)

Supabase Cloud handles automatic backups. For self-hosted:

```bash
# Export database
pg_dump -h localhost -U postgres -d postgres > backup_$(date +%Y%m%d).sql

# Compress
gzip backup_$(date +%Y%m%d).sql
```

### Application Backup

```bash
# Backup environment and volumes
tar -czvf teambrain-backup-$(date +%Y%m%d).tar.gz \
  /opt/teambrain-ai/.env \
  /var/lib/docker/volumes/teambrain-ai_letsencrypt
```

## Security

### Firewall (UFW)

```bash
# Allow required ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect)
ufw allow 443/tcp   # HTTPS
ufw enable
```

### Environment Variables

- Never commit `.env` files to git
- Use strong, unique passwords
- Rotate API keys periodically
- Use separate Stripe keys for test/production

### Docker Security

```bash
# Run containers as non-root (already configured)
# Limit container resources
# Use read-only mounts where possible
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs api

# Check configuration
docker compose config

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### API Not Responding

1. Check container is running: `docker compose ps`
2. Check health: `curl http://localhost:3000/health`
3. Check logs: `docker compose logs api`
4. Verify environment variables

### SSL Certificate Issues

1. Verify DNS is pointing to server
2. Check port 80 is accessible
3. Review Traefik logs for ACME errors
4. Ensure ACME_EMAIL is valid

### Database Connection Failed

1. Verify SUPABASE_URL is correct
2. Check SUPABASE_SERVICE_ROLE_KEY
3. Ensure IP is whitelisted (if applicable)
4. Test connection: `curl $SUPABASE_URL/rest/v1/`

### Slack Bot Not Connecting

1. Verify Socket Mode is enabled in Slack
2. Check bot tokens are correct
3. Review API logs for Slack errors
4. Test bot health in dashboard

## Scaling

### Vertical Scaling

Upgrade Hetzner VPS to higher tier:
- CX31: 2 vCPU, 8GB RAM
- CX41: 4 vCPU, 16GB RAM
- CX51: 8 vCPU, 32GB RAM

### Horizontal Scaling (Future)

For high-traffic deployments:
1. Use external load balancer
2. Run multiple API replicas
3. Use Redis for session storage
4. Consider managed Kubernetes (Hetzner K3s)

## Cost Estimation

| Component | Monthly Cost |
|-----------|--------------|
| Hetzner CX21 | ~$5 |
| Domain | ~$1 |
| Supabase Pro | $25 |
| **Total** | ~$31/month |

Additional costs:
- Gemini API: Usage-based
- Stripe: 2.9% + $0.30 per transaction

## Support

- Documentation: See `docs/` folder
- Issues: https://github.com/MiscMich/teambrain-ai/issues
- Email: support@teambrain.app
