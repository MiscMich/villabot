# Claude Skills & MCP Reference

Copied from `~/.claude/` and Claude Desktop configs on 2025-12-23.

## MCP Servers (Model Context Protocol)

Your Claude setup has these MCP servers configured:

### Claude Desktop (`~/.config/claude/claude_desktop_config.json`)
| Server | Command | Purpose |
|--------|---------|---------|
| **n8n-workflows Docs** | `npx mcp-remote gitmcp.io/Zie619/n8n-workflows` | n8n workflow documentation |
| **context7** | `npx @upstash/context7-mcp` | Context management |
| **n8n-mcp** | Docker image | n8n API integration |
| **playwright** | `npx @playwright/mcp@latest` | Browser automation |
| **supabase** | `npx @modelcontextprotocol/server-postgres` | Supabase database access |
| **tavily** | `npx @tavily/mcp-server` | Web search |

### Claude Code (`~/.config/claude-code/config.json`)
Additional servers:
| Server | Purpose |
|--------|---------|
| **vibe-check** | Code vibes assessment |
| **sequential-thinking** | Sequential reasoning |
| **chrome-devtools** | Browser DevTools |
| **magic** | 21st.dev magic |
| **serena** | IDE assistant |

## Installed Plugins

### Claude Plugins Official
- context7, frontend-design, serena, github
- feature-dev, code-review, commit-commands
- security-guidance, agent-sdk-dev, pr-review-toolkit
- explanatory-output-style, playwright, sentry
- greptile, stripe

### Superpowers Marketplace
- double-shot-latte, episodic-memory
- superpowers, superpowers-lab

### Claude Code Workflows
- agent-orchestration, backend-development
- code-documentation, code-refactoring
- codebase-cleanup, comprehensive-review
- context-management, database-design
- database-migrations, full-stack-orchestration
- llm-application-dev, seo-content-creation
- seo-technical-optimization

## Agents (`~/.claude/agents/`)

17 specialist agents:
- `pm-agent.md` - Project management with PDCA cycle, session persistence
- `backend-architect.md` - Backend system design
- `devops-architect.md` - Infrastructure and CI/CD
- `security-engineer.md` - Security analysis
- `frontend-architect.md` - Frontend architecture
- `performance-engineer.md` - Performance optimization
- `quality-engineer.md` - Quality assurance
- `refactoring-expert.md` - Code refactoring
- `requirements-analyst.md` - Requirements analysis
- `root-cause-analyst.md` - Root cause analysis
- `socratic-mentor.md` - Teaching/mentoring
- `system-architect.md` - System architecture
- `technical-writer.md` - Documentation
- `python-expert.md` - Python development
- `deep-research-agent.md` - Research
- `learning-guide.md` - Learning assistance
- `business-panel-experts.md` - Business panel

## Commands (`~/.claude/commands/sc/`)

26 superclaude commands:
- analyze, brainstorm, build, business-panel
- cleanup, design, document, estimate, explain
- git, help, implement, improve, index, load
- pm, reflect, research, save, select-tool
- spawn, spec-panel, task, test, troubleshoot, workflow

## Skills (`~/.claude/skills/`)

5 skill modules:
- **Coolify-Manager** - Manage Coolify deployments, WordPress troubleshooting
- **api-design-principles** - REST and GraphQL API design
- **docker-containerization** - Docker best practices
- **postgresql** - PostgreSQL database skills
- **prompt-engineering-patterns** - Prompt engineering

## Local MCP Setup

### Coolify MCP (`~/.claude/coolify-mcp/`)
- URL: `http://178.156.192.101:8000`
- Used for: Server management, deployments, logs

### Supabase MCP
- Project: `grjociqyeotxwqdjovmt.supabase.co`
- Used for: Database operations, migrations

## Key Environment Settings

From `~/.claude/settings.json`:
- `dangerousMode`: disabled
- `alwaysThinkingEnabled`: true
- Auto-approved tools: git clone, Serena MCP, Tavily search, WebFetch
