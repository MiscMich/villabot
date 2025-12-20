# Villa Paraiso Slack AI Assistant - Project Instructions

## Project Overview
RAG-powered Slack bot for Villa Paraiso Vacation Rentals that answers team questions using SOPs, documentation from Google Drive, and website content.

## Tech Stack
- **Backend**: Node.js/TypeScript + Express (port 3000)
- **Dashboard**: Next.js 15 + React 19 (port 3001)
- **AI**: Google Gemini API (embeddings + generation)
- **Database**: Supabase + pgvector
- **Integration**: Slack Bolt SDK, Google Drive API
- **Package Manager**: pnpm (monorepo)

## Development Commands
```bash
pnpm dev              # Start API server (port 3000)
pnpm dev:dashboard    # Start dashboard (port 3001)
pnpm typecheck        # Type checking
pnpm lint             # Linting
pnpm test             # Run tests (Vitest)
pnpm build            # Build all packages
```

## Project Structure
```
apps/
├── api/              # Backend API + Slack bot
│   └── src/
│       ├── services/slack/      # Slack bot handlers
│       ├── services/rag/        # RAG pipeline
│       ├── services/google-drive/ # Drive sync
│       └── routes/              # API endpoints
└── dashboard/        # Next.js admin UI

packages/
└── shared/           # Shared types and constants

supabase/
└── migrations/       # Database schema
```

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
- `apps/api/src/services/rag/search.ts` - Hybrid search implementation
- `apps/api/src/services/google-drive/sync.ts` - Drive sync logic
- `packages/shared/src/constants.ts` - RAG configuration

## Environment Variables
See `.env.example` for required configuration:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Available Plugins
Use `/commit` for git commits, `/code-review` for PR reviews, `/feature-dev` for feature development workflow.
