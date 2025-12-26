# Cluebase AI - Project Instructions

## Project Overview
Multi-tenant SaaS platform for AI-powered knowledge management. Features RAG-powered Slack bots that answer team questions using SOPs, documentation from Google Drive, and website content. Supports multiple workspaces with isolated data, Stripe billing integration, and a full dashboard for configuration.

**Live URLs**:
- Dashboard: https://cluebase.ai
- API: https://api.cluebase.ai
- Supabase: https://grjociqyeotxwqdjovmt.supabase.co (cloud)

## Tech Stack
- **Backend**: Node.js/TypeScript + Express (port 3000)
- **Dashboard**: Next.js 15 + React 19 (port 3001)
- **AI**: OpenAI API (text-embedding-3-small for embeddings, gpt-4o-mini for generation)
- **Database**: Supabase + pgvector (768-dim vectors)
- **Integration**: Slack Bolt SDK, Google Drive API
- **Package Manager**: pnpm (monorepo)
- **Deployment**: Coolify + Docker + Supabase Cloud

## Development Commands
```bash
pnpm dev              # Start API server (port 3000)
pnpm dev:dashboard    # Start dashboard (port 3001)
pnpm typecheck        # Type checking
pnpm lint             # Linting
pnpm test             # Run tests (Vitest)
pnpm build            # Build all packages

# E2E Testing (Dashboard)
cd apps/dashboard
pnpm test:e2e         # Run E2E tests headless
pnpm test:e2e:ui      # Run with Playwright UI
pnpm test:e2e:headed  # Run in headed browser
pnpm test:e2e:debug   # Debug mode
```

## Coolify Deployment
Production deployment is managed via Coolify on Hetzner VPS.

- **Coolify Dashboard**: http://178.156.192.101:8000
- **Deployment Guide**: See `docs/COOLIFY_DEPLOYMENT.md`

Key compose files for Coolify:
- `apps/api/docker-compose.coolify.yml` - API service
- `apps/dashboard/docker-compose.coolify.yml` - Dashboard service

## Project Structure
```
apps/
├── api/                       # Backend API + Slack bot
│   ├── Dockerfile            # Production Docker build
│   ├── docker-compose.coolify.yml  # Coolify deployment
│   └── src/
│       ├── services/slack/   # Slack bot handlers
│       ├── services/rag/     # RAG pipeline (hybrid search)
│       ├── services/google-drive/  # Drive sync
│       ├── services/scraper/ # Website scraping
│       └── routes/           # API endpoints
│           ├── documents.ts  # Document management
│           ├── analytics.ts  # Usage analytics
│           ├── conversations.ts  # Thread viewer
│           └── config.ts     # Bot configuration
└── dashboard/                 # Next.js admin UI
    ├── Dockerfile            # Production Docker build
    ├── docker-compose.coolify.yml  # Coolify deployment
    └── src/app/
        ├── dashboard/        # Overview dashboard
        ├── documents/        # Document management
        ├── bots/             # Bot management
        ├── knowledge/        # Learned facts
        ├── analytics/        # Usage analytics
        ├── conversations/    # Thread viewer
        ├── feedback/         # Feedback review
        ├── team/             # Team management & invites
        ├── billing/          # Subscription & billing
        ├── settings/         # Configuration
        ├── setup/            # Onboarding wizard
        ├── admin/            # Platform admin panel
        └── auth/             # Authentication pages

packages/
└── shared/                    # Shared types and constants

supabase/
└── migrations/                # Database schema

docs/
└── COOLIFY_DEPLOYMENT.md     # Production deployment guide
```

## Database Schema (Key Tables)
Core tables:
- `workspaces` - Multi-tenant workspace data
- `bots` - Bot instances with Slack credentials per workspace
- `documents` - Document metadata (Drive files, website pages)
- `document_chunks` - Chunked content with embeddings (768-dim vectors)
- `thread_sessions` - Slack conversation threads
- `thread_messages` - Individual messages with sources
- `learned_facts` - User-taught corrections
- `analytics` - Usage events
- `bot_config` - Legacy configuration (being replaced by `bots` table)
- `bot_channels` - Slack channel assignments per bot
- `bot_drive_folders` - Google Drive folder mappings per bot
- `bot_health` - Real-time health monitoring for bots
- `response_feedback` - User feedback on bot responses
- `subscriptions` - Stripe subscription data
- `error_logs` - Error tracking and monitoring

## RAG Pipeline
1. **Hybrid Search**: Vector (semantic) + BM25 (keyword) with RRF fusion
2. **Contextual Chunks**: Document metadata prepended to chunks
3. **Source Attribution**: Responses cite document sources
4. **Learned Facts**: Included in search with user corrections

Key constants in `packages/shared/src/constants.ts`:
- `topK: 15` - Number of chunks to retrieve
- `chunkSize: 512` - Tokens per chunk
- `chunkOverlap: 50` - Overlap between chunks
- `minSimilarity: 0.2` - Minimum relevance threshold

## Code Style
- ESM modules with `.js` extensions in imports
- Strict TypeScript with `noUncheckedIndexedAccess`
- kebab-case for files, PascalCase for types
- Winston logger for all logging

## Before Committing
1. `pnpm typecheck` - Must pass
2. `pnpm lint` - Must pass
3. `pnpm test` - All tests must pass
4. `pnpm build` - Must build successfully

## Key Files
- `apps/api/src/services/slack/bot.ts` - Slack bot initialization and message handlers
- `apps/api/src/services/slack/manager.ts` - Multi-bot instance management
- `apps/api/src/services/slack/response.ts` - Response generation with RAG
- `apps/api/src/services/rag/search.ts` - Hybrid search implementation
- `apps/api/src/services/rag/chunking.ts` - Document chunking
- `apps/api/src/services/google-drive/sync.ts` - Drive sync logic
- `apps/api/src/services/scraper/website.ts` - Website scraper (configurable limit)
- `apps/api/src/services/email/index.ts` - Email notifications via Supabase Edge Functions
- `packages/shared/src/constants.ts` - RAG configuration

## Environment Variables
See `.env.example` for required configuration:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database
- `OPENAI_API_KEY` - AI embeddings and generation (OpenAI)
- `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` - Slack integration (legacy single-bot)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Drive OAuth
- `GOOGLE_DRIVE_FOLDER_ID` - Source folder for documents
- `COMPANY_WEBSITE_URL` - Website to scrape

## Implemented Features (See PLAN.md)

### Multi-Tenant Architecture (Complete)
- Workspaces with isolated data using RLS
- Supabase authentication (email/password)
- Stripe billing with subscription tiers
- Team member management and invites

### Document Categorization (Complete)
- Default categories: `shared`, `operations`, `marketing`, `sales`, `technical`, `hr`, `custom`
- Categories are assigned per-document and can be filtered per-bot
- Each bot can be configured to access specific categories (e.g., Sales bot → sales + shared)
- Category-filtered search with workspace isolation

### Multi-Bot Architecture (Complete)
- Multiple bots per workspace with different Slack credentials
- Each bot has access to specific document categories
- Shared knowledge base with bot-specific priorities

### All Features Complete
- Bot management dashboard (complete)
- Feedback review dashboard (complete)
- Team invites with email notifications (complete)
- Platform admin panel (complete)

## Testing

### E2E Tests (Playwright)
Located in `apps/dashboard/e2e/`:
- `auth.spec.ts` - Authentication flows (login, signup, OAuth)
- `billing.spec.ts` - Stripe checkout and subscription management
- `bots.spec.ts` - Bot creation, configuration, deletion
- `dashboard.spec.ts` - Dashboard overview and metrics
- `documents.spec.ts` - Document upload, search, sync
- `settings.spec.ts` - Workspace configuration

**68 tests** covering all major user flows.

### Health Check Endpoints
- `GET /health` - Service status (supabase, slack, openai, googleDrive)
- Returns: `{ status: 'healthy' | 'degraded', services: {...}, uptime: number }`

## Background Services

### Worker Process
The API includes a background worker for scheduled tasks:
- `apps/api/src/worker.ts` - Background job processor
- Google Drive polling (configurable interval)
- Website scraping (weekly cron schedule)
- Bot health monitoring

### Scheduler
5 scheduled jobs initialized on startup:
- Drive sync polling
- Website scrape scheduling
- Bot health checks
- Error log cleanup
- Analytics aggregation

## Available Plugins
Use `/commit` for git commits, `/code-review` for PR reviews, `/feature-dev` for feature development workflow.

## Repository
GitHub: https://github.com/MiscMich/cluebase-ai
