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
- **Type Safety**: Zod schemas + typed API client (tRPC-like pattern)
- **Resilience**: Circuit breakers, rate limiting (Redis/in-memory), error boundaries

## Development Commands
```bash
pnpm dev              # Start API server (port 3000)
pnpm dev:dashboard    # Start dashboard (port 3001)
pnpm typecheck        # Type checking (must pass)
pnpm lint             # Linting (must pass)
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
│       ├── middleware/       # Auth, validation, rate limiting
│       │   └── rateLimit.ts  # Redis + in-memory rate limiting
│       ├── services/slack/   # Slack bot handlers
│       ├── services/rag/     # RAG pipeline (hybrid search)
│       ├── services/google-drive/  # Drive sync (with circuit breaker)
│       ├── services/scraper/ # Website scraping
│       ├── services/sync/    # Sync progress tracking (SSE)
│       ├── utils/
│       │   ├── circuit-breaker.ts  # Circuit breaker pattern
│       │   ├── cache.ts      # LRU caching utilities
│       │   └── timeout.ts    # Timeout and retry utilities
│       └── routes/           # API endpoints
│           ├── documents.ts  # Document management
│           ├── analytics.ts  # Usage analytics
│           ├── conversations.ts  # Thread viewer
│           ├── health.ts     # Health checks (deep diagnostics)
│           ├── sync.ts       # SSE sync progress
│           └── config.ts     # Bot configuration
└── dashboard/                 # Next.js admin UI
    ├── Dockerfile            # Production Docker build
    ├── docker-compose.coolify.yml  # Coolify deployment
    ├── eslint.config.mjs     # ESLint 9 flat config
    └── src/
        ├── app/
        │   ├── dashboard/        # Overview dashboard
        │   ├── documents/        # Document management
        │   ├── bots/             # Bot management
        │   ├── knowledge/        # Learned facts
        │   ├── analytics/        # Usage analytics
        │   ├── conversations/    # Thread viewer
        │   ├── feedback/         # Feedback review
        │   ├── platform-feedback/ # Platform feedback
        │   ├── team/             # Team management & invites
        │   ├── billing/          # Subscription & billing
        │   ├── settings/         # Configuration
        │   ├── setup/            # Onboarding wizard
        │   ├── admin/            # Platform admin panel
        │   └── auth/             # Authentication pages
        ├── components/
        │   ├── error-boundary.tsx  # React error boundaries
        │   ├── sync/             # SSE sync progress components
        │   └── ui/               # shadcn/ui components
        ├── hooks/               # Custom React hooks
        └── lib/
            ├── api.ts           # Typed API client
            └── sync-events.ts   # SSE client with exponential backoff

packages/
└── shared/                    # Shared types, constants, and API contracts
    └── src/
        ├── api/               # Type-safe API layer
        │   ├── contracts.ts   # API endpoint contracts (Zod schemas)
        │   ├── typed-client.ts # Typed fetch wrapper factory
        │   └── index.ts       # Exports
        └── constants.ts       # RAG configuration

supabase/
└── migrations/                # Database schema (20 migrations)

docs/
├── COOLIFY_DEPLOYMENT.md     # Production deployment guide
├── ARCHITECTURE.md           # Multi-tenant architecture
├── API.md                    # API endpoint reference
├── DATABASE.md               # Database schema reference
├── ADMIN.md                  # Platform admin guide
└── TESTING.md                # E2E testing guide
```

## Database Schema (Key Tables)
Core tables (30+ with comprehensive indexing):
- `workspaces` - Multi-tenant workspace data with subscription tiers
- `bots` - Bot instances with Slack credentials per workspace
- `documents` - Document metadata (Drive files, website pages)
- `document_chunks` - Chunked content with embeddings (768-dim vectors) + FTS
- `thread_sessions` - Slack conversation threads
- `thread_messages` - Individual messages with sources
- `learned_facts` - User-taught corrections with embeddings
- `analytics` - Usage events
- `sync_operations` - Real-time sync progress tracking (SSE)
- `bot_config` - Key-value configuration storage
- `bot_channels` - Slack channel assignments per bot
- `bot_drive_folders` - Google Drive folder mappings per bot
- `bot_health` - Real-time health monitoring for bots
- `response_feedback` - User feedback on bot responses
- `platform_feedback` - Platform-wide feature requests/bugs
- `subscriptions` - Stripe subscription data
- `invoices` - Billing history
- `workspace_members` - Team membership with roles
- `workspace_invites` - Pending team invitations
- `error_logs` - Error tracking and monitoring
- `usage_tracking` - Usage limits per billing period

## Type-Safe API Layer
The project uses a tRPC-like pattern for end-to-end type safety:

**Shared Contracts** (`packages/shared/src/api/contracts.ts`):
- Zod schemas define request/response shapes
- TypeScript types inferred with `z.infer<typeof Schema>`
- Validation at API boundaries

**Typed Client** (`packages/shared/src/api/typed-client.ts`):
- Factory function `createTypedClient()` wraps fetch
- Returns typed API methods matching backend contracts
- Runtime validation in development mode

**Usage in Dashboard** (`apps/dashboard/src/lib/api.ts`):
```typescript
import { createTypedClient } from '@cluebase/shared/api';
export const typedApi = createTypedClient(baseFetch, { validateRequests: true });
```

**Backend Validation** (`apps/api/src/middleware/validation.ts`):
- `validateBody(schema)` - Validate request body with Zod
- `validateQuery(schema)` - Validate query parameters
- `validateParams(schema)` - Validate URL parameters

## RAG Pipeline
1. **Hybrid Search**: Vector (semantic) + BM25 (keyword) with RRF fusion
2. **Contextual Chunks**: Document metadata prepended to chunks
3. **Source Attribution**: Responses cite document sources
4. **Learned Facts**: Included in search with user corrections

Key constants in `packages/shared/src/constants.ts`:
- `topK: 15` - Number of chunks to retrieve
- `chunkSize: 1200` - Characters per chunk (larger for context preservation)
- `chunkOverlap: 100` - Overlap between chunks
- `minSimilarity: 0.35` - Minimum relevance threshold (higher for precision)

## Code Style
- ESM modules with `.js` extensions in imports
- Strict TypeScript: `strict: true`, `noUncheckedIndexedAccess`, `noUnusedLocals`
- ESLint 9 flat config (dashboard: `eslint.config.mjs`)
- kebab-case for files, PascalCase for types
- Winston logger for all logging
- Zod for runtime validation

## Before Committing
1. `pnpm typecheck` - Must pass
2. `pnpm lint` - Must pass (0 errors required)
3. `pnpm test` - All tests must pass
4. `pnpm build` - Must build successfully

## Key Files
- `apps/api/src/services/slack/bot.ts` - Slack bot initialization
- `apps/api/src/services/slack/manager.ts` - Multi-bot instance management
- `apps/api/src/services/slack/response.ts` - Response generation with RAG
- `apps/api/src/services/rag/search.ts` - Hybrid search implementation
- `apps/api/src/services/rag/embeddings.ts` - OpenAI embeddings with circuit breaker
- `apps/api/src/services/rag/chunking.ts` - Document chunking
- `apps/api/src/services/google-drive/sync.ts` - Drive sync with progress tracking
- `apps/api/src/services/google-drive/client.ts` - Drive API with circuit breaker
- `apps/api/src/services/sync/progress.ts` - SSE progress emitter
- `apps/api/src/routes/sync.ts` - SSE endpoint for real-time sync status
- `apps/api/src/routes/health.ts` - Health endpoints with deep diagnostics
- `apps/api/src/routes/auth.ts` - Google OAuth flow (workspace-scoped)
- `apps/api/src/middleware/rateLimit.ts` - Redis/in-memory rate limiting
- `apps/api/src/middleware/validation.ts` - Zod validation middleware
- `apps/api/src/utils/circuit-breaker.ts` - Circuit breaker implementation
- `apps/dashboard/src/components/error-boundary.tsx` - React error boundaries
- `apps/dashboard/src/lib/sync-events.ts` - SSE client with reconnection
- `packages/shared/src/api/contracts.ts` - API type contracts
- `packages/shared/src/api/typed-client.ts` - Typed API client factory
- `packages/shared/src/constants.ts` - RAG configuration

## Environment Variables
See `.env.example` for required configuration:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database
- `OPENAI_API_KEY` - AI embeddings and generation
- `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` - Slack integration (legacy single-bot)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Drive OAuth
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Billing
- `REDIS_URL` - Optional Redis for rate limiting (falls back to in-memory)

## Resilience Patterns

### Circuit Breakers
Prevents cascading failures when external services are down:
- **OpenAI** (`openaiCircuitBreaker`): 5 failures → open, 30s reset, 2 successes to close
- **Google Drive** (`googleDriveCircuitBreaker`): 5 failures → open, 60s reset
- **Slack** (`createSlackCircuitBreaker(botId)`): Per-bot, 3 failures → open

Circuit breaker states: CLOSED (normal) → OPEN (fail fast) → HALF_OPEN (testing)

### Rate Limiting
Dual-mode rate limiting with automatic fallback:
- **Redis mode**: Atomic INCR + PEXPIRE for distributed rate limiting
- **In-memory mode**: LRU-based fallback when Redis unavailable
- Configured per-route with different limits for auth, API, webhooks

### Error Boundaries (Dashboard)
React error boundaries prevent full-page crashes:
- `ErrorBoundary`: Full-page error UI with retry button
- `InlineErrorBoundary`: Minimal inline error state
- Auto-reset on navigation via `resetKey={pathname}`

### SSE Reconnection
EventSource client with resilience features:
- Exponential backoff: 1s → 2s → 4s → ... → 30s (max)
- Jitter: 0-30% random variation prevents thundering herd
- Heartbeat detection: 45s timeout for stale connections
- Max 10 reconnection attempts

## Feature Status (All Complete)

### Multi-Tenant Architecture
- Workspaces with isolated data using RLS (30+ tables)
- Supabase authentication (email/password + magic link)
- Stripe billing with subscription tiers (Starter, Pro, Business)
- Team member management and invites with email notifications

### Document Management
- Google Drive sync with real-time progress (SSE)
- Website scraping with configurable limits
- Document categories: `shared`, `operations`, `marketing`, `sales`, `technical`, `hr`, `custom`
- Category-filtered search with workspace isolation

### Multi-Bot Architecture
- Multiple bots per workspace with different Slack credentials
- Each bot has access to specific document categories
- Bot health monitoring with auto-restart
- Credential validation with circuit breaker pattern

### Real-Time Features
- SSE-based sync progress tracking
- Live sync status display in dashboard
- Toast notifications for sync events

### Platform Features
- Platform admin panel for workspace management
- Platform feedback system (feature requests, bugs)
- Usage analytics and reporting
- Error logging and monitoring

## Testing

### E2E Tests (Playwright)
Located in `apps/dashboard/e2e/`:
- `auth.spec.ts` - Authentication flows
- `billing.spec.ts` - Stripe checkout
- `bots.spec.ts` - Bot management
- `dashboard.spec.ts` - Dashboard metrics
- `documents.spec.ts` - Document operations
- `settings.spec.ts` - Configuration

**68 tests** covering all major user flows.

### Health Check Endpoints
- `GET /health` - Basic service status
- `GET /health/ready` - Kubernetes readiness probe (database check)
- `GET /health/live` - Kubernetes liveness probe (always OK)
- `GET /health/deep` - Comprehensive diagnostics including:
  - Database connectivity and data counts
  - OpenAI API availability
  - Vector search function check
  - Cache statistics (embedding, search, response)
  - Memory usage metrics
  - Circuit breaker states
  - Rate limiter backend (Redis vs in-memory)

Returns: `{ status: 'healthy' | 'degraded' | 'unhealthy', checks: {...} }`

## Background Services

### Worker Process
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
- Sync operation cleanup

## Database Security Notes
From Supabase security advisor (as of Dec 2024):
- 22 functions need `SET search_path = ''` to prevent injection
- `admin_audit_log` has RLS disabled (intentional for admin access)
- `vector` extension in public schema (should move to `extensions`)
- Enable leaked password protection in Supabase Auth settings

## Available Skills
Use `/commit` for git commits, `/code-review` for PR reviews, `/feature-dev` for feature development workflow.

## Repository
GitHub: https://github.com/MiscMich/cluebase-ai
