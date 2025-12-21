# Cluebase AI

Multi-tenant SaaS platform for deploying AI-powered Slack bots with RAG (Retrieval Augmented Generation). Each workspace can configure their own knowledge base from Google Drive documents and website content.

## Features

- **Multi-Tenant Architecture**: Isolated workspaces with separate knowledge bases
- **RAG-Powered Responses**: Hybrid search (vector + BM25) for accurate answers
- **Google Drive Integration**: OAuth-based sync with automatic document chunking
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
| **AI** | Google Gemini (embeddings + generation) |
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

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose (for deployment)
- Supabase account (cloud or self-hosted via Coolify)
- Google Cloud project (Drive API + OAuth)
- Gemini API key
- Slack App (for each workspace)

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
| [docs/COOLIFY_DEPLOYMENT.md](./docs/COOLIFY_DEPLOYMENT.md) | Coolify deployment guide |
| [docs/API.md](./docs/API.md) | API endpoint reference |
| [docs/DATABASE.md](./docs/DATABASE.md) | Database schema reference |
| [docs/ADMIN.md](./docs/ADMIN.md) | Platform admin guide |
| [docs/DASHBOARD.md](./docs/DASHBOARD.md) | User dashboard guide |

## Development Commands

```bash
pnpm dev              # Start API server (port 3000)
pnpm dev:dashboard    # Start dashboard (port 3001)
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint
pnpm test             # Run tests (Vitest)
pnpm build            # Build all packages
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
│  Slack API    │       │  Google Gemini  │       │ Google Drive  │
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

**Required:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database
- `GEMINI_API_KEY` - AI embeddings and generation
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth for Drive

**Per-Workspace (stored in database):**
- Slack tokens (Bot Token, App Token)
- Google Drive folder IDs
- Website URLs for scraping

## Security

- Row Level Security (RLS) on all tables
- Workspace isolation for multi-tenancy
- JWT-based authentication
- API rate limiting (tier-based)
- No credentials in git (use `.env` files)

## Live URLs

| Service | URL |
|---------|-----|
| Dashboard | https://cluebase.ai |
| API | https://api.cluebase.ai |
| Supabase | https://supabase.cluebase.ai |

## License

Proprietary - All rights reserved
