# Supabase MCP Server Setup

## Current Configuration

**Status**: Using official Supabase Cloud MCP
**Project**: grjociqyeotxwqdjovmt
**Scope**: Project-level (`.mcp.json` in repository)

## Quick Start

The MCP is already configured in `.mcp.json`. Claude Code will automatically connect to Supabase Cloud.

## Configuration Details

- **Supabase URL**: `https://grjociqyeotxwqdjovmt.supabase.co`
- **MCP Endpoint**: `https://mcp.supabase.com/mcp`
- **Auth**: Access token from Supabase

## Available Tools

With the official Supabase MCP:

### Database Operations
- `list_tables` - List all tables in the database
- `execute_sql` - Run raw SQL queries
- `apply_migration` - Apply database migrations
- `list_migrations` - List applied migrations

### Project Management
- `get_project_url` - Get the project API URL
- `get_publishable_keys` - Get anon and publishable keys
- `get_logs` - Get service logs (api, auth, postgres, etc.)
- `get_advisors` - Get security and performance advisors

### Edge Functions
- `list_edge_functions` - List all edge functions
- `get_edge_function` - Get function code
- `deploy_edge_function` - Deploy a new function

### Branching
- `create_branch` - Create a development branch
- `list_branches` - List all branches
- `merge_branch` - Merge branch to production

### Storage
- `list_storage_buckets` - List storage buckets
- `get_storage_config` - Get storage configuration

## Troubleshooting

### Check MCP Connection
```bash
# Verify MCP is configured
cat .mcp.json

# Test connection in Claude Code
# Use any Supabase tool like list_tables
```

### Re-authenticate
If the access token expires:
1. Go to https://supabase.com/dashboard/project/grjociqyeotxwqdjovmt
2. Generate new access token in Settings → Access Tokens
3. Update `.mcp.json` with new token

## Migration from Self-Hosted

Previously used self-hosted Supabase MCP (`~/.claude/supabase-mcp/`).
This has been replaced with the official Supabase Cloud MCP.

### Old Setup (Deprecated)
- Location: `~/.claude/supabase-mcp/`
- URL: `https://supabase.cluebase.ai` (self-hosted)
- Required SSH tunnel for database access

### New Setup (Current)
- Location: `.mcp.json` (project level)
- URL: `https://grjociqyeotxwqdjovmt.supabase.co` (cloud)
- No SSH tunnel required

## References

- [Supabase MCP Documentation](https://supabase.com/docs/guides/ai/mcp)
- [Supabase Dashboard](https://supabase.com/dashboard/project/grjociqyeotxwqdjovmt)
