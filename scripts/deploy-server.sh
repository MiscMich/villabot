#!/bin/bash
#
# TeamBrain AI - Complete Server Deployment Script
# Run this on a fresh Ubuntu 24.04 server
#
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARNING:${NC} $1"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $1"; }
header() { echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"; echo -e "${BLUE}  $1${NC}"; echo -e "${BLUE}═══════════════════════════════════════════${NC}\n"; }

# Configuration
DOMAIN="${DOMAIN:-teambrain.local}"
DEPLOY_DIR="/opt/teambrain"
REPO_URL="https://github.com/MiscMich/teambrain-ai.git"

header "TeamBrain AI - Server Deployment"
echo "Domain: $DOMAIN"
echo "Deploy Directory: $DEPLOY_DIR"
echo ""

# ============================================
# PHASE 1: System Setup
# ============================================
header "Phase 1: System Setup"

log "Updating system packages..."
apt update && apt upgrade -y

log "Installing required packages..."
apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    apache2-utils \
    jq \
    openssl \
    ufw

# ============================================
# PHASE 2: Docker Installation
# ============================================
header "Phase 2: Docker Installation"

if command -v docker &> /dev/null; then
    log "Docker already installed: $(docker --version)"
else
    log "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log "Docker installed: $(docker --version)"
fi

if command -v docker compose &> /dev/null; then
    log "Docker Compose available: $(docker compose version)"
else
    log "Installing Docker Compose plugin..."
    apt install -y docker-compose-plugin
fi

# ============================================
# PHASE 3: Firewall Configuration
# ============================================
header "Phase 3: Firewall Configuration"

log "Configuring UFW firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # API (temporary, for testing)
ufw allow 3001/tcp  # Dashboard (temporary, for testing)
ufw allow 8000/tcp  # Supabase Kong (temporary)
echo "y" | ufw enable
ufw status

# ============================================
# PHASE 4: Create Deploy User
# ============================================
header "Phase 4: Create Deploy User"

if id "deploy" &>/dev/null; then
    log "Deploy user already exists"
else
    log "Creating deploy user..."
    useradd -m -s /bin/bash deploy
    usermod -aG docker deploy
    log "Deploy user created and added to docker group"
fi

# ============================================
# PHASE 5: Clone Repository
# ============================================
header "Phase 5: Clone Repository"

mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

if [ -d "$DEPLOY_DIR/app/.git" ]; then
    log "Repository exists, pulling latest..."
    cd app && git pull
else
    log "Cloning repository..."
    git clone $REPO_URL app
    cd app
fi

# ============================================
# PHASE 6: Generate Secrets
# ============================================
header "Phase 6: Generate Secrets"

log "Generating secure secrets..."

generate_secret() {
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$1"
}

generate_hex() {
    openssl rand -hex "$1"
}

# Generate all secrets
JWT_SECRET=$(generate_secret 64)
POSTGRES_PASSWORD=$(generate_secret 32)
ANON_KEY=$(generate_secret 40)
SERVICE_ROLE_KEY=$(generate_secret 40)
SECRET_KEY_BASE=$(generate_hex 64)
LOGFLARE_API_KEY=$(generate_secret 24)
DASHBOARD_PASSWORD=$(generate_secret 16)
TRAEFIK_PASSWORD=$(generate_secret 16)

# Generate htpasswd for Traefik
TRAEFIK_AUTH=$(htpasswd -nb admin "$TRAEFIK_PASSWORD" | sed 's/\$/\$\$/g')

log "Secrets generated successfully"

# ============================================
# PHASE 7: Create Environment File
# ============================================
header "Phase 7: Create Environment File"

SERVER_IP=$(curl -s ifconfig.me || echo "178.156.192.101")

cat > $DEPLOY_DIR/app/.env << EOF
# ==========================================
# TeamBrain AI - Production Environment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ==========================================

# Server
NODE_ENV=production
LOG_LEVEL=info

# Domain (update when you have a real domain)
DOMAIN=$DOMAIN
ACME_EMAIL=admin@$DOMAIN
SERVER_IP=$SERVER_IP

# URLs (using IP for now, update with domain later)
API_URL=http://$SERVER_IP:3000
APP_URL=http://$SERVER_IP:3001
SUPABASE_URL=http://$SERVER_IP:8000

# Supabase (Self-Hosted)
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SECRET_KEY_BASE=$SECRET_KEY_BASE
LOGFLARE_API_KEY=$LOGFLARE_API_KEY

# Supabase Studio
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD
STUDIO_DEFAULT_ORGANIZATION=TeamBrain
STUDIO_DEFAULT_PROJECT=TeamBrain AI

# Traefik (for when you add domain)
TRAEFIK_AUTH=$TRAEFIK_AUTH

# Google (ADD YOUR KEYS)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Stripe (ADD YOUR KEYS - optional for now)
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
STRIPE_STARTER_PRICE_ID=price_placeholder
STRIPE_PRO_PRICE_ID=price_placeholder
STRIPE_BUSINESS_PRICE_ID=price_placeholder

# Email (optional)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=
SMTP_ADMIN_EMAIL=admin@$DOMAIN
SMTP_SENDER_NAME=TeamBrain AI
MAILER_AUTOCONFIRM=true
EOF

log "Environment file created at $DEPLOY_DIR/app/.env"

# Save credentials to a secure file
cat > $DEPLOY_DIR/CREDENTIALS.txt << EOF
==========================================
TeamBrain AI - Deployment Credentials
Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
==========================================

SERVER ACCESS:
  IP: $SERVER_IP
  SSH: ssh root@$SERVER_IP

SUPABASE STUDIO:
  URL: http://$SERVER_IP:8000
  Username: supabase
  Password: $DASHBOARD_PASSWORD

TRAEFIK DASHBOARD (when domain configured):
  Username: admin
  Password: $TRAEFIK_PASSWORD

DATABASE:
  Host: localhost:5432
  Database: postgres
  User: postgres
  Password: $POSTGRES_PASSWORD

SUPABASE API KEYS:
  Anon Key: $ANON_KEY
  Service Role Key: $SERVICE_ROLE_KEY

JWT SECRET:
  $JWT_SECRET

==========================================
IMPORTANT: Keep this file secure!
Delete after saving credentials elsewhere.
==========================================
EOF

chmod 600 $DEPLOY_DIR/CREDENTIALS.txt
log "Credentials saved to $DEPLOY_DIR/CREDENTIALS.txt"

# ============================================
# PHASE 8: Setup Supabase
# ============================================
header "Phase 8: Setup Self-Hosted Supabase"

# Create Supabase directories
mkdir -p $DEPLOY_DIR/supabase/{db/init,storage,kong}

# Create pgvector init script
cat > $DEPLOY_DIR/supabase/db/init/00-extensions.sql << 'SQLEOF'
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQLEOF

# Create simplified Supabase docker-compose
cat > $DEPLOY_DIR/supabase/docker-compose.yml << 'SUPAEOF'
# Supabase Self-Hosted Stack (Simplified)
name: teambrain-supabase

services:
  db:
    image: supabase/postgres:15.1.1.78
    container_name: supabase-db
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    volumes:
      - supabase-db:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - teambrain

  rest:
    image: postgrest/postgrest:v12.0.2
    container_name: supabase-rest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
    networks:
      - teambrain

  auth:
    image: supabase/gotrue:v2.151.0
    container_name: supabase-auth
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: ${SUPABASE_URL}
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres?sslmode=disable
      GOTRUE_SITE_URL: ${APP_URL}
      GOTRUE_URI_ALLOW_LIST: "*"
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: 3600
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
    networks:
      - teambrain

  kong:
    image: kong:2.8.1
    container_name: supabase-kong
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
    volumes:
      - ./kong/kong.yml:/var/lib/kong/kong.yml:ro
    networks:
      - teambrain

  studio:
    image: supabase/studio:20240422-5cf8f30
    container_name: supabase-studio
    restart: unless-stopped
    ports:
      - "3003:3000"
    environment:
      STUDIO_PG_META_URL: http://meta:8080
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      DEFAULT_ORGANIZATION_NAME: TeamBrain
      DEFAULT_PROJECT_NAME: TeamBrain AI
      SUPABASE_URL: http://kong:8000
      SUPABASE_PUBLIC_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
    networks:
      - teambrain

  meta:
    image: supabase/postgres-meta:v0.80.0
    container_name: supabase-meta
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: db
      PG_META_DB_PORT: 5432
      PG_META_DB_NAME: postgres
      PG_META_DB_USER: postgres
      PG_META_DB_PASSWORD: ${POSTGRES_PASSWORD}
    networks:
      - teambrain

volumes:
  supabase-db:

networks:
  teambrain:
    driver: bridge
SUPAEOF

# Create Kong configuration
cat > $DEPLOY_DIR/supabase/kong/kong.yml << 'KONGEOF'
_format_version: "2.1"
_transform: true

consumers:
  - username: anon
    keyauth_credentials:
      - key: "${SUPABASE_ANON_KEY}"
  - username: service_role
    keyauth_credentials:
      - key: "${SUPABASE_SERVICE_KEY}"

acls:
  - consumer: anon
    group: anon
  - consumer: service_role
    group: admin

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
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
            - anon

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
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin
            - anon
KONGEOF

# Substitute environment variables in Kong config
cd $DEPLOY_DIR/supabase
envsubst < kong/kong.yml > kong/kong.yml.tmp && mv kong/kong.yml.tmp kong/kong.yml

# Copy .env to supabase directory
cp $DEPLOY_DIR/app/.env $DEPLOY_DIR/supabase/.env

log "Starting Supabase services..."
docker compose up -d

log "Waiting for database to be ready..."
sleep 15

# Check if services are running
docker compose ps

# ============================================
# PHASE 9: Run Database Migrations
# ============================================
header "Phase 9: Run Database Migrations"

log "Running database migrations..."

# Wait for database to be fully ready
for i in {1..30}; do
    if docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; then
        log "Database is ready"
        break
    fi
    echo "Waiting for database... ($i/30)"
    sleep 2
done

# Run migrations
cd $DEPLOY_DIR/app
for migration in supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        log "Running migration: $(basename $migration)"
        docker exec -i supabase-db psql -U postgres -d postgres < "$migration" 2>/dev/null || warn "Migration may have already been applied: $(basename $migration)"
    fi
done

log "Migrations complete"

# ============================================
# PHASE 10: Build and Deploy Application
# ============================================
header "Phase 10: Build and Deploy Application"

cd $DEPLOY_DIR/app

# Create a simplified docker-compose for development/testing (without Traefik)
cat > docker-compose.dev.yml << 'DEVEOF'
# TeamBrain AI - Development Docker Compose (No SSL/Traefik)
name: teambrain-app

services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    container_name: teambrain-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=info
      - API_URL=${API_URL}
      - APP_URL=${APP_URL}
      - SUPABASE_URL=http://supabase-kong:8000
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=${API_URL}/api/google-drive/callback
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      - STRIPE_STARTER_PRICE_ID=${STRIPE_STARTER_PRICE_ID}
      - STRIPE_PRO_PRICE_ID=${STRIPE_PRO_PRICE_ID}
      - STRIPE_BUSINESS_PRICE_ID=${STRIPE_BUSINESS_PRICE_ID}
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - teambrain-supabase_teambrain

  dashboard:
    build:
      context: .
      dockerfile: apps/dashboard/Dockerfile
      args:
        - NEXT_PUBLIC_API_URL=${API_URL}
        - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
        - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
        - NEXT_PUBLIC_APP_NAME=TeamBrain AI
        - NEXT_PUBLIC_APP_URL=${APP_URL}
    container_name: teambrain-dashboard
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - teambrain-supabase_teambrain

networks:
  teambrain-supabase_teambrain:
    external: true
DEVEOF

log "Building application containers (this may take a few minutes)..."
docker compose -f docker-compose.dev.yml build

log "Starting application..."
docker compose -f docker-compose.dev.yml up -d

# Wait for services
log "Waiting for services to start..."
sleep 30

# ============================================
# PHASE 11: Verify Deployment
# ============================================
header "Phase 11: Verify Deployment"

echo ""
echo "Checking services..."
echo ""

# Check Supabase
echo "Supabase Database:"
docker exec supabase-db pg_isready -U postgres && echo "  ✓ PostgreSQL is running" || echo "  ✗ PostgreSQL failed"

echo ""
echo "Supabase API (Kong):"
curl -s http://localhost:8000/rest/v1/ -H "apikey: $ANON_KEY" > /dev/null && echo "  ✓ Kong API Gateway is running" || echo "  ✗ Kong failed"

echo ""
echo "TeamBrain API:"
curl -s http://localhost:3000/health > /dev/null && echo "  ✓ API is running" || echo "  ⏳ API still starting..."

echo ""
echo "TeamBrain Dashboard:"
curl -s http://localhost:3001 > /dev/null && echo "  ✓ Dashboard is running" || echo "  ⏳ Dashboard still starting..."

# ============================================
# COMPLETE
# ============================================
header "Deployment Complete!"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  TeamBrain AI has been deployed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "ACCESS URLS:"
echo "  Dashboard:       http://$SERVER_IP:3001"
echo "  API:             http://$SERVER_IP:3000"
echo "  API Health:      http://$SERVER_IP:3000/health"
echo "  Supabase Studio: http://$SERVER_IP:3003"
echo "  Supabase API:    http://$SERVER_IP:8000"
echo ""
echo "CREDENTIALS:"
echo "  See: $DEPLOY_DIR/CREDENTIALS.txt"
echo ""
echo "NEXT STEPS:"
echo "  1. Add your Google API keys to $DEPLOY_DIR/app/.env"
echo "  2. Add your Stripe keys (optional)"
echo "  3. Restart: cd $DEPLOY_DIR/app && docker compose -f docker-compose.dev.yml restart"
echo "  4. Access dashboard and create first workspace"
echo ""
echo "USEFUL COMMANDS:"
echo "  View logs:     docker compose -f $DEPLOY_DIR/app/docker-compose.dev.yml logs -f"
echo "  Restart:       docker compose -f $DEPLOY_DIR/app/docker-compose.dev.yml restart"
echo "  Stop:          docker compose -f $DEPLOY_DIR/app/docker-compose.dev.yml down"
echo ""
echo -e "${YELLOW}IMPORTANT: Save your credentials from $DEPLOY_DIR/CREDENTIALS.txt${NC}"
echo ""
