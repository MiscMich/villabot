#!/bin/bash
#
# TeamBrain AI - Secret Key Generator
# Generates all required secrets for self-hosted Supabase deployment
#
# Usage: ./scripts/generate-keys.sh > .supabase.secrets
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}TeamBrain AI - Secret Key Generator${NC}"
echo "========================================"
echo ""

# Check for openssl
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: openssl is required but not installed.${NC}"
    exit 1
fi

# Generate secure random string
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c "$length"
}

# Generate hex string
generate_hex() {
    local length=${1:-32}
    openssl rand -hex "$length"
}

# Generate secrets
echo -e "${YELLOW}Generating secrets...${NC}"
echo ""

# JWT Secret (minimum 32 characters, we use 64 for extra security)
JWT_SECRET=$(generate_secret 64)

# Postgres password
POSTGRES_PASSWORD=$(generate_secret 32)

# Anon key (for public client access)
ANON_KEY=$(generate_secret 40)

# Service role key (for server-side admin access)
SERVICE_ROLE_KEY=$(generate_secret 40)

# Secret key base for Realtime
SECRET_KEY_BASE=$(generate_hex 64)

# Logflare API key
LOGFLARE_API_KEY=$(generate_secret 24)

# Dashboard password
DASHBOARD_PASSWORD=$(generate_secret 24)

# Output secrets
echo "# ==========================================="
echo "# TeamBrain AI - Supabase Secrets"
echo "# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "# ==========================================="
echo "# IMPORTANT: Store these securely!"
echo "# Add these to your .env file"
echo "# ==========================================="
echo ""
echo "# Database"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo ""
echo "# JWT"
echo "JWT_SECRET=$JWT_SECRET"
echo ""
echo "# Supabase Keys"
echo "SUPABASE_ANON_KEY=$ANON_KEY"
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
echo ""
echo "# Realtime"
echo "SECRET_KEY_BASE=$SECRET_KEY_BASE"
echo ""
echo "# Analytics"
echo "LOGFLARE_API_KEY=$LOGFLARE_API_KEY"
echo ""
echo "# Dashboard"
echo "DASHBOARD_USERNAME=supabase"
echo "DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD"
echo ""
echo "# ==========================================="
echo "# Quick .env addition (copy everything above)"
echo "# ==========================================="

echo "" >&2
echo -e "${GREEN}Secrets generated successfully!${NC}" >&2
echo "" >&2
echo -e "${YELLOW}Next steps:${NC}" >&2
echo "1. Save output to a secure location" >&2
echo "2. Add secrets to your .env file" >&2
echo "3. Never commit secrets to git" >&2
echo "" >&2
