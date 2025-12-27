#!/bin/bash
# Cluebase AI - Full Deployment Script
set -e

SERVER="root@178.156.192.101"
OPENAI_KEY="$1"

if [ -z "$OPENAI_KEY" ]; then
  echo "Usage: ./deploy.sh YOUR_OPENAI_API_KEY"
  exit 1
fi

echo "🚀 Deploying Cluebase AI to $SERVER..."

# Generate secrets locally
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
JWT_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)

# Generate Supabase JWT keys locally using Node.js
ANON_KEY=$(node -e "
const crypto = require('crypto');
const secret = '$JWT_SECRET';
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000})).toString('base64url');
const signature = crypto.createHmac('sha256', secret).update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+signature);
")

SERVICE_KEY=$(node -e "
const crypto = require('crypto');
const secret = '$JWT_SECRET';
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000})).toString('base64url');
const signature = crypto.createHmac('sha256', secret).update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+signature);
")

echo "Generated keys:"
echo "  ANON_KEY: ${ANON_KEY:0:50}..."
echo "  SERVICE_KEY: ${SERVICE_KEY:0:50}..."

echo "📦 Creating server directory..."
ssh $SERVER "mkdir -p /opt/cluebase"

echo "📤 Copying files to server..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' --exclude '.next' \
  ./ $SERVER:/opt/cluebase/

echo "🔧 Creating .env file on server..."

# Create .env content locally and copy it
cat > /tmp/cluebase.env << EOF
# Domain
DOMAIN=cluebase.ai
ACME_EMAIL=admin@cluebase.ai
API_URL=https://api.cluebase.ai
APP_URL=https://cluebase.ai

# Database
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
SECRET_KEY_BASE=$SECRET_KEY_BASE
SUPABASE_URL=http://kong:8000

# Supabase Keys
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY

# AI (OpenAI GPT-5-Nano)
OPENAI_API_KEY=$OPENAI_KEY

# Email (Resend)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_68MWxo5x_864Um86hSP6s9xg8bAnkm5jU
SMTP_ADMIN_EMAIL=admin@cluebase.ai
SMTP_SENDER_NAME=Cluebase AI
MAILER_AUTOCONFIRM=false

# App
NODE_ENV=production
LOG_LEVEL=info
KONG_HTTP_PORT=8000

# Studio
STUDIO_DEFAULT_ORGANIZATION=Cluebase
STUDIO_DEFAULT_PROJECT=Cluebase AI
EOF

scp /tmp/cluebase.env $SERVER:/opt/cluebase/.env

# Create Kong config with actual keys
cat > /tmp/kong.yml << EOF
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
      - key: $ANON_KEY

  - username: service_role
    keyauth_credentials:
      - key: $SERVICE_KEY

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
        - Content-Type
        - Authorization
        - apikey
      credentials: true
      max_age: 3600
EOF

ssh $SERVER "mkdir -p /opt/cluebase/supabase"
scp /tmp/kong.yml $SERVER:/opt/cluebase/supabase/kong.yml

echo "🔧 Configuring server..."
ssh $SERVER << 'ENDSSH'
set -e
cd /opt/cluebase

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

# Create required directories
mkdir -p supabase/init traefik/dynamic

# Copy migrations to init folder
if [ -d "supabase/migrations" ]; then
  cp supabase/migrations/*.sql supabase/init/ 2>/dev/null || true
fi

# Create traefik middleware config
cat > traefik/dynamic/middleware.yml << 'TRAEFIKEOF'
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
TRAEFIKEOF

echo "🐳 Starting Docker services..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d --build

echo "⏳ Waiting for services to start..."
sleep 30

echo "📊 Service status:"
docker compose -f docker-compose.prod.yml ps

ENDSSH

# Cleanup temp files
rm -f /tmp/cluebase.env /tmp/kong.yml

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔗 Your app will be available at:"
echo "   Dashboard: https://cluebase.ai"
echo "   API: https://api.cluebase.ai"
echo ""
echo "⚠️  SSL certificates may take 1-2 minutes to provision."
