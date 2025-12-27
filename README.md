# Cluebase AI

Multi-tenant SaaS platform for deploying AI-powered Slack bots with RAG (Retrieval Augmented Generation). Each workspace is completely isolated with their own Slack bot, Google Drive connection, and knowledge base.

## How It Works

**For each workspace:**
1. **Create a Slack App**: Users create their own Slack app in the Slack developer console and provide Bot Token + App Token
2. **Connect Google Drive**: One-click OAuth authentication (platform-managed, no API credentials needed from users)
3. **Build Knowledge Base**: Sync documents from Google Drive, scrape website content, or upload files
4. **Deploy AI Bot**: The Slack bot answers team questions using RAG-powered search across the workspace's knowledge base

> **Data Isolation**: Each workspace's data (documents, conversations, learned facts) is completely isolated using Row Level Security (RLS). Workspaces cannot access each other's data.

## Features

- **Multi-Tenant Architecture**: Complete workspace isolation with RLS-protected data
- **RAG-Powered Responses**: Hybrid search (vector + BM25) for accurate answers
- **Google Drive Integration**: Platform-managed OAuth (users just click "Connect Google Drive")
- **Per-Workspace Slack Bots**: Each workspace creates their own Slack app with unique credentials
- **Multi-Bot Support**: Create multiple bots per workspace, each with access to specific document categories
- **Website Scraping**: Configurable crawling per workspace
- **Self-Learning**: User corrections stored as learned facts
- **Admin Dashboard**: Full platform management with usage analytics
- **Stripe Billing**: Tiered subscriptions (Starter, Pro, Business)
- **Coolify Deployment**: One-click Supabase and Git-based deployments

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js/TypeScript + Express |
| **Dashboard** | Next.js 15 + React 19 |
| **AI** | OpenAI (gpt-5-nano + text-embedding-3-small) |
| **Database** | PostgreSQL + pgvector (Supabase) |
| **Auth** | Supabase Auth + RLS policies |
| **Integration** | Slack Bolt SDK, Google Drive API |
| **Billing** | Stripe Subscriptions |
| **Deployment** | Coolify + Docker + Supabase |

## Project Structure

```
cluebase-ai/
├── apps/
│   ├── api/                    # Backend API + Slack bot manager
│   │   ├── src/
│   │   │   ├── middleware/     # Auth, workspace, rate limiting
│   │   │   ├── routes/         # REST API endpoints
│   │   │   └── services/       # Business logic
│   │   ├── Dockerfile
│   │   └── docker-compose.coolify.yml
│   └── dashboard/              # Next.js admin UI
│       ├── src/app/
│       │   ├── admin/          # Platform admin panel
│       │   ├── auth/           # Authentication pages
│       │   ├── billing/        # Subscription management
│       │   ├── bots/           # Bot management
│       │   ├── setup/          # 8-step onboarding wizard
│       │   └── team/           # Team management
│       ├── Dockerfile
│       └── docker-compose.coolify.yml
├── packages/
│   └── shared/                 # Shared types and constants
├── supabase/
│   └── migrations/             # Database migrations
└── docs/
    └── COOLIFY_DEPLOYMENT.md   # Deployment guide
```

## Quick Start

### Prerequisites

**Platform Infrastructure (one-time setup by platform operator):**
- Node.js 20+
- pnpm 8+
- Docker & Docker Compose (for deployment)
- Supabase account (cloud or self-hosted via Coolify)
- Google Cloud project with OAuth configured (Drive API enabled)
- OpenAI API key
- Stripe account for billing

**Per-Workspace (each customer provides):**
- Slack App created in Slack developer console (Bot Token + App Token)
- Google account to connect via OAuth (no API credentials needed)

### Local Development

```bash
# Clone repository
git clone https://github.com/MiscMich/cluebase-ai.git
cd cluebase-ai

# Install dependencies
pnpm install

# Configure environment
cp .env.example apps/api/.env
cp .env.example apps/dashboard/.env.local
# Edit both files with your credentials

# Run database migrations in Supabase SQL Editor
# (see supabase/migrations/ - run in order)

# Start development servers
pnpm dev              # API on port 3000
pnpm dev:dashboard    # Dashboard on port 3001
```

### Production Deployment

See [docs/COOLIFY_DEPLOYMENT.md](./docs/COOLIFY_DEPLOYMENT.md) for full production deployment with:
- One-click Supabase via Coolify template
- Automatic SSL/TLS management
- Git-based auto-deployments
- Health monitoring

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](./SETUP.md) | Step-by-step setup guide |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Multi-tenant architecture and workspace isolation |
| [docs/COOLIFY_DEPLOYMENT.md](./docs/COOLIFY_DEPLOYMENT.md) | Coolify deployment guide (recommended) |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Manual deployment guide (alternative) |
| [docs/API.md](./docs/API.md) | API endpoint reference |
| [docs/DATABASE.md](./docs/DATABASE.md) | Database schema reference |
| [docs/ADMIN.md](./docs/ADMIN.md) | Platform admin guide |
| [docs/DASHBOARD.md](./docs/DASHBOARD.md) | User dashboard guide |

## Development Commands

```bash
pnpm dev              # Start API server (port 3000)
pnpm dev:dashboard    # Start dashboard (port 3001)
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint (flat config)
pnpm test             # Run tests (Vitest)
pnpm build            # Build all packages

# E2E Testing (Dashboard)
cd apps/dashboard
pnpm test:e2e         # Run E2E tests headless
pnpm test:e2e:ui      # Run with Playwright UI
pnpm test:e2e:headed  # Run in headed browser
```

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │              Coolify/Traefik            │
                    │         (SSL + Routing)                 │
                    └─────────────┬───────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Dashboard    │       │    API Server   │       │   Supabase      │
│   (Next.js)   │◄─────►│   (Express)     │◄─────►│  (PostgreSQL)   │
│   Port 3001   │       │   Port 3000     │       │   Port 8000     │
└───────────────┘       └────────┬────────┘       └─────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐       ┌─────────────────┐       ┌───────────────┐
│  Slack API    │       │   OpenAI API    │       │ Google Drive  │
│  (Bot Events) │       │  (AI + Embed)   │       │   (Docs)      │
└───────────────┘       └─────────────────┘       └───────────────┘
```

## Subscription Tiers

| Feature | Starter | Pro | Business |
|---------|---------|-----|----------|
| Queries/month | 500 | 2,000 | 10,000 |
| Documents | 100 | 500 | Unlimited |
| Bots | 1 | 3 | 10 |
| Team members | 3 | 10 | Unlimited |
| Support | Community | Email | Priority |

## Environment Variables

See [.env.example](./.env.example) for all required configuration:

**Platform-Level (set by platform operator in `.env`):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database connection
- `OPENAI_API_KEY` - AI embeddings and generation
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Platform's OAuth app for Drive
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Billing integration

**Per-Workspace (stored in database, provided by customers):**
- Slack Bot Token (`xoxb-...`) - From customer's Slack app
- Slack App Token (`xapp-...`) - From customer's Slack app
- Google Drive OAuth tokens - Stored after customer clicks "Connect Google Drive"
- Website URLs for scraping
- Document category preferences per bot

## Security

- **Complete Workspace Isolation**: Row Level Security (RLS) on all database tables
- **Data Separation**: Each workspace's documents, conversations, and learned facts are isolated
- **Per-Workspace Credentials**: Slack tokens and Google Drive tokens stored per-workspace
- **JWT Authentication**: Secure token-based authentication via Supabase Auth
- **API Rate Limiting**: Tier-based limits to prevent abuse
- **No Credentials in Git**: All secrets via environment variables

## Live URLs

| Service | URL |
|---------|-----|
| Dashboard | https://cluebase.ai |
| API | https://api.cluebase.ai |
| Supabase | https://supabase.cluebase.ai |

## License

Proprietary - All rights reserved
