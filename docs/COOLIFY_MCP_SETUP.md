# Coolify MCP Server Setup

## Installation Summary

**Installed**: 2025-12-21
**Location**: `~/.claude/coolify-mcp/`
**Status**: Connected

## Configuration

- **Coolify URL**: `http://178.156.192.101:8000`
- **API Token**: Stored in `~/.claude/coolify-mcp/.env`

## Installation Steps (Reference)

```bash
# 1. Clone repository
cd ~/.claude
git clone https://github.com/forsonny/Coolify-MCP-Server-for-Claude-Code.git coolify-mcp

# 2. Install and build
cd coolify-mcp
npm install
npm run build

# 3. Create .env file
cat > .env << 'EOF'
COOLIFY_BASE_URL=http://178.156.192.101:8000
COOLIFY_API_TOKEN=your-token-here
COOLIFY_TIMEOUT=30000
EOF

# 4. Register with Claude Code
claude mcp add-json coolify '{"type":"stdio","command":"node","args":["/Users/michellopez/.claude/coolify-mcp/dist/index.js"],"env":{"COOLIFY_BASE_URL":"http://178.156.192.101:8000","COOLIFY_API_TOKEN":"your-token-here"}}'
```

## Available Tools

After restart, Claude Code will have access to:

- **Server Management**: List, view, and manage Coolify servers
- **Applications**: Deploy, redeploy, start/stop applications
- **Databases**: Manage database services
- **Logs**: View container and deployment logs
- **Environment Variables**: Manage env vars for services
- **Resources**: Direct control of Coolify resources

## Regenerating API Token

If you need a new token:
1. Go to http://178.156.192.101:8000
2. Navigate to **Keys & Tokens → API tokens**
3. Create new token with required permissions
4. Update `~/.claude/coolify-mcp/.env`
5. Re-register MCP server with new token

## Troubleshooting

```bash
# Check MCP status
claude mcp list

# Rebuild if needed
cd ~/.claude/coolify-mcp && npm run build

# Remove and re-add
claude mcp remove coolify
claude mcp add-json coolify '...'
```

## Source

Repository: https://github.com/forsonny/Coolify-MCP-Server-for-Claude-Code
