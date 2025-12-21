# TeamBrain AI - Production Deployment Guide

Complete guide for deploying TeamBrain AI on a Hetzner VPS with self-hosted Supabase.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup (Hetzner)](#server-setup-hetzner)
3. [Self-Hosted Supabase](#self-hosted-supabase)
4. [External Services Setup](#external-services-setup)
5. [Application Deployment](#application-deployment)
6. [DNS Configuration](#dns-configuration)
7. [SSL/TLS Certificates](#ssltls-certificates)
8. [Post-Deployment](#post-deployment)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

| Service | Purpose | Cost |
|---------|---------|------|
| **Hetzner Cloud** | VPS hosting | ~$10-20/mo |
| **Google Cloud** | Gemini API + Drive OAuth | Pay-per-use |
| **Stripe** | Billing/subscriptions | 2.9% + $0.30/txn |
| **Domain registrar** | DNS management | ~$12/year |

### Recommended Server Specs

| Tier | RAM | CPU | Disk | Monthly |
|------|-----|-----|------|---------|
| **Starter** | 4GB | 2 vCPU | 80GB | ~$7 |
| **Production** | 8GB | 4 vCPU | 160GB | ~$15 |
| **Scale** | 16GB | 8 vCPU | 240GB | ~$30 |

For self-hosted Supabase + Application: **minimum 8GB RAM recommended**.

---

## Server Setup (Hetzner)

### 1. Create VPS

1. Log into [Hetzner Cloud Console](https://console.hetzner.cloud)
2. Create new project or select existing
3. Add Server:
   - Location: Choose nearest to your users
   - Image: **Ubuntu 24.04**
   - Type: **CX22** (4GB RAM) minimum, **CX32** (8GB) recommended
   - SSH keys: Add your public key
   - Name: \`teambrain-prod\`

### 2. Initial Server Configuration

\`\`\`bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version

# Create deploy user
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# Allow SSH for deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh

# Switch to deploy user for remaining steps
su - deploy
\`\`\`

### 3. Configure Firewall

\`\`\`bash
# Using ufw (as root)
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
\`\`\`

### 4. Create Application Directory

\`\`\`bash
# As deploy user
mkdir -p ~/teambrain
cd ~/teambrain
\`\`\`

---

## Self-Hosted Supabase

Self-hosted Supabase provides full data sovereignty. The stack includes:
- PostgreSQL 15 with pgvector extension
- GoTrue (Authentication)
- PostgREST (API)
- Storage API
- Kong (API Gateway)
- Studio (Admin UI)

### 1. Generate Secrets

Run the generate-keys.sh script (included in scripts/):

\`\`\`bash
cd ~/teambrain
./scripts/generate-keys.sh > .secrets
cat .secrets
# IMPORTANT: Save these values securely!
\`\`\`

### 2. Download Supabase Docker Files

\`\`\`bash
# Get official Supabase self-hosted config
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker/* ./supabase-docker/
rm -rf supabase

cd supabase-docker
cp .env.example .env
\`\`\`

### 3. Configure Supabase Environment

Edit \`supabase-docker/.env\` with the generated secrets:

\`\`\`env
############
# Secrets
############
POSTGRES_PASSWORD=your_generated_password
JWT_SECRET=your_generated_jwt_secret
ANON_KEY=your_generated_anon_key
SERVICE_ROLE_KEY=your_generated_service_role_key

############
# URLs
############
SITE_URL=https://teambrain.app
API_EXTERNAL_URL=https://supabase.teambrain.app

############
# Auth (SMTP via Resend recommended)
############
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=your_resend_api_key
GOTRUE_SMTP_SENDER_NAME=TeamBrain AI
\`\`\`

### 4. Enable pgvector Extension

\`\`\`bash
mkdir -p volumes/db/init
cat > volumes/db/init/01-extensions.sql << 'EOF'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
EOF
\`\`\`

### 5. Start Supabase

\`\`\`bash
docker compose up -d
docker compose ps
\`\`\`

### 6. Run Migrations

Access Supabase Studio and run each migration from \`supabase/migrations/\` in order (001 through 015).

---

## External Services Setup

### 1. Google Cloud Setup

#### Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project: \`teambrain-prod\`
3. Enable: Google Drive API, Google Docs API, Google Sheets API

#### Create OAuth Credentials
1. Configure OAuth consent screen (External)
2. Create OAuth 2.0 Client ID:
   - Authorized redirect: \`https://api.teambrain.app/api/google-drive/callback\`
3. Save Client ID and Secret

#### Get Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create and save API key

### 2. Stripe Setup

#### Create Products
| Product | Price | Billing |
|---------|-------|---------|
| **Starter** | $19/mo | Monthly |
| **Pro** | $49/mo | Monthly |
| **Business** | $149/mo | Monthly |

#### Configure Webhooks
1. Endpoint: \`https://api.teambrain.app/api/stripe/webhook\`
2. Events: \`checkout.session.completed\`, \`customer.subscription.*\`, \`invoice.*\`
3. Save webhook signing secret

### 3. Slack App Template

Create from manifest (see docs/SLACK_MANIFEST.yaml)

---

## Application Deployment

### 1. Clone and Configure

\`\`\`bash
cd ~/teambrain
git clone https://github.com/MiscMich/teambrain-ai.git app
cd app

# Create .env from example
cp .env.example .env
# Edit with your values
\`\`\`

### 2. Required Environment Variables

\`\`\`env
# Domain
DOMAIN=teambrain.app
ACME_EMAIL=admin@teambrain.app

# Supabase (Self-Hosted)
SUPABASE_URL=https://supabase.teambrain.app
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Cloud
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GEMINI_API_KEY=your_gemini_api_key

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...

# Traefik (generate with: htpasswd -nb admin yourpassword)
TRAEFIK_AUTH=admin:$$apr1$$...
\`\`\`

### 3. Deploy

\`\`\`bash
docker compose build
docker compose up -d
docker compose ps
\`\`\`

---

## DNS Configuration

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_SERVER_IP | 300 |
| A | api | YOUR_SERVER_IP | 300 |
| A | supabase | YOUR_SERVER_IP | 300 |
| CNAME | www | teambrain.app | 300 |

---

## SSL/TLS Certificates

Traefik automatically obtains Let's Encrypt certificates. Verify:

\`\`\`bash
curl -vI https://teambrain.app 2>&1 | grep -i "SSL\|issuer"
\`\`\`

---

## Post-Deployment

### 1. Create Platform Admin

\`\`\`sql
-- In Supabase SQL Editor after user signs up:
INSERT INTO platform_admins (user_id, role, is_active)
SELECT id, 'super_admin', true
FROM auth.users WHERE email = 'admin@teambrain.app';
\`\`\`

### 2. Configure Backups

\`\`\`bash
# Daily backup cron
0 2 * * * ~/teambrain/scripts/backup.sh
\`\`\`

### 3. Health Monitoring

\`\`\`bash
curl https://api.teambrain.app/health
docker compose ps
docker stats
\`\`\`

---

## Troubleshooting

### Container Issues
\`\`\`bash
docker compose logs api
docker compose logs dashboard
docker compose logs traefik
\`\`\`

### SSL Issues
\`\`\`bash
docker compose logs traefik | grep -i "certificate\|acme"
\`\`\`

### Database Issues
\`\`\`bash
docker compose -f supabase-docker/docker-compose.yml logs db
\`\`\`

### Useful Commands
\`\`\`bash
docker compose restart        # Restart services
docker compose build && docker compose up -d  # Rebuild
docker compose exec api sh    # Shell access
\`\`\`

---

## Security Checklist

- [ ] SSH key-only authentication
- [ ] Firewall configured (ufw)
- [ ] All secrets in \`.env\` only
- [ ] Traefik dashboard password protected
- [ ] Regular backups configured
- [ ] SSL certificates valid
- [ ] RLS policies active

---

## Support

Issues: https://github.com/MiscMich/teambrain-ai/issues
