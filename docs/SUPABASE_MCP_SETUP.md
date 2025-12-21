# Self-Hosted Supabase MCP Server Setup

## Installation Summary

**Installed**: 2025-12-21
**Location**: `~/.claude/supabase-mcp/`
**Scope**: User-level (available in all projects)
**Status**: Requires SSH tunnel for database access

## Quick Start

Before starting Claude Code, run the SSH tunnel:

```bash
~/.claude/supabase-tunnel.sh
```

This creates a secure tunnel to the PostgreSQL database on Coolify.

## Configuration

- **Supabase URL**: `https://supabase.cluebase.ai`
- **Auth**: Anon key + Service role key + JWT secret configured
- **Access Level**: Full (all tools available)

## Coolify Environment Variables Reference

Found via Coolify API at `http://178.156.192.101:8000/api/v1/services/csscks0go8os8gw480kwggcs/envs`:

| Variable | Description |
|----------|-------------|
| `SERVICE_SUPABASEANON_KEY` | Anon key for public access |
| `SERVICE_SUPABASESERVICE_KEY` | Service role key for admin access |
| `SERVICE_PASSWORD_JWT` | JWT secret for token verification |
| `SERVICE_PASSWORD_POSTGRES` | PostgreSQL password |

## Installation Steps (Reference)

```bash
# 1. Clone repository
cd ~/.claude
git clone https://github.com/HenkDz/selfhosted-supabase-mcp.git supabase-mcp

# 2. Install and build
cd supabase-mcp
npm install
npm run build

# 3. Register with Claude Code (user level) - Full access
claude mcp add-json supabase '{"type":"stdio","command":"node","args":["/Users/michellopez/.claude/supabase-mcp/dist/index.js","--url","https://supabase.cluebase.ai","--anon-key","YOUR_ANON_KEY","--service-key","YOUR_SERVICE_ROLE_KEY","--jwt-secret","YOUR_JWT_SECRET"]}' -s user
```

## Getting Keys from Coolify (Self-Hosted)

To find the Supabase keys in your Coolify deployment:

```bash
# Using Coolify API
curl -s -H "Authorization: Bearer YOUR_COOLIFY_API_TOKEN" \
  "http://178.156.192.101:8000/api/v1/services/SERVICE_UUID/envs" | jq '.'

# Or navigate in Coolify Dashboard:
# 1. Go to Resources → Your Supabase service
# 2. Click on Environment Variables
# 3. Look for SERVICE_SUPABASESERVICE_KEY, SERVICE_PASSWORD_JWT, etc.
```

## Available Tools (Full Access)

With service role key configured:

### Database Operations
- **Query tables**: Read data from any table
- **Insert/Update/Delete**: Modify table data
- **Schema inspection**: View table structures
- **Execute SQL**: Run raw SQL queries via RPC

### Auth Operations
- List users
- Create/delete users
- Manage user sessions
- Verify JWTs

### Storage Operations
- List buckets
- Upload/download files
- Manage storage policies

## Troubleshooting

```bash
# Check MCP status
claude mcp list

# Rebuild if needed
cd ~/.claude/supabase-mcp && npm run build

# Remove and re-add
claude mcp remove supabase -s user
claude mcp add-json supabase '...' -s user

# Test connection
curl -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  "https://supabase.cluebase.ai/rest/v1/"
```

## Source

Repository: https://github.com/HenkDz/selfhosted-supabase-mcp
