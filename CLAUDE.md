# TeamBrain AI - Project Instructions

## Project Overview
Multi-tenant SaaS platform for AI-powered knowledge management. Features RAG-powered Slack bots that answer team questions using SOPs, documentation from Google Drive, and website content. Supports multiple workspaces with isolated data, Stripe billing integration, and a full dashboard for configuration.

## Tech Stack
- **Backend**: Node.js/TypeScript + Express (port 3000)
- **Dashboard**: Next.js 15 + React 19 (port 3001)
- **AI**: Google Gemini API (embeddings + generation)
- **Database**: Supabase + pgvector
- **Integration**: Slack Bolt SDK, Google Drive API
- **Package Manager**: pnpm (monorepo)
- **Deployment**: Docker + Docker Compose

## Development Commands
```bash
pnpm dev              # Start API server (port 3000)
pnpm dev:dashboard    # Start dashboard (port 3001)
pnpm typecheck        # Type checking
pnpm lint             # Linting
pnpm test             # Run tests (Vitest)
pnpm build            # Build all packages
```

## Docker Deployment
```bash
docker compose up -d --build   # Build and start all services
docker compose logs -f         # View logs
docker compose down            # Stop all services
```

## Project Structure
```
apps/
├── api/                       # Backend API + Slack bot
│   ├── Dockerfile            # Production Docker build
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
    └── src/app/
        ├── page.tsx          # Overview dashboard
        ├── documents/        # Document management
        ├── knowledge/        # Learned facts
        ├── analytics/        # Usage charts
        ├── conversations/    # Thread viewer
        └── settings/         # Configuration

packages/
└── shared/                    # Shared types and constants

supabase/
└── migrations/                # Database schema

docker-compose.yml             # Container orchestration
DEPLOYMENT.md                  # Production deployment guide
PLAN.md                        # Feature roadmap and architecture
```

## Database Schema (Key Tables)
- `documents` - Document metadata (Drive files, website pages)
- `document_chunks` - Chunked content with embeddings (768-dim vectors)
- `thread_sessions` - Slack conversation threads
- `thread_messages` - Individual messages with sources
- `learned_facts` - User-taught corrections
- `analytics` - Usage events
- `bot_config` - Configuration settings

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
- `apps/api/src/services/slack/bot.ts` - Slack bot initialization
- `apps/api/src/services/slack/handlers.ts` - Message handling logic
- `apps/api/src/services/rag/search.ts` - Hybrid search implementation
- `apps/api/src/services/rag/chunking.ts` - Document chunking
- `apps/api/src/services/google-drive/sync.ts` - Drive sync logic
- `apps/api/src/services/scraper/website.ts` - Website scraper (configurable limit)
- `packages/shared/src/constants.ts` - RAG configuration

## Environment Variables
See `.env.example` for required configuration:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database
- `GEMINI_API_KEY` - AI embeddings and generation
- `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` - Slack integration
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
- Categories: `company_knowledge`, `internal_sops`, `marketing`, `sales`, etc.
- Category-filtered search with workspace isolation
- Source attribution by category

### Multi-Bot Architecture (Complete)
- Multiple bots per workspace with different Slack credentials
- Each bot has access to specific document categories
- Shared knowledge base with bot-specific priorities

### Coming Soon
- Landing page for marketing
- Bot management dashboard page
- Feedback review dashboard page

## Available Plugins
Use `/commit` for git commits, `/code-review` for PR reviews, `/feature-dev` for feature development workflow.

## Repository
GitHub: https://github.com/MiscMich/teambrain-ai
