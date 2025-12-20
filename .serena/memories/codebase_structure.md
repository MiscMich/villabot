# Codebase Structure

## Root Files
- `package.json` - Root monorepo config, workspace scripts
- `pnpm-workspace.yaml` - Workspace definition (apps/*, packages/*)
- `tsconfig.base.json` - Shared TypeScript config
- `.env.example` - Environment variable template
- `PLAN.md` - Detailed implementation plan and architecture

## apps/api (Backend API Server)
```
src/
├── index.ts              # Entry point, Express app setup
├── config/
│   └── env.ts            # Zod-validated environment config
├── routes/
│   ├── health.ts         # Health check endpoint
│   ├── config.ts         # Bot configuration API
│   ├── documents.ts      # Document management API
│   ├── analytics.ts      # Analytics API
│   └── auth.ts           # Google OAuth flow
├── services/
│   ├── slack/
│   │   ├── bot.ts        # Slack Bolt app initialization
│   │   ├── handlers.ts   # Message handlers
│   │   ├── intent.ts     # Question detection AI
│   │   ├── response.ts   # Response generation
│   │   └── threads.ts    # Thread management
│   ├── google-drive/
│   │   ├── client.ts     # Drive API client
│   │   ├── sync.ts       # Document sync logic
│   │   └── parsers/      # DOCX, PDF, etc.
│   ├── rag/
│   │   ├── embeddings.ts # Gemini embeddings
│   │   ├── chunking.ts   # Text chunking
│   │   └── search.ts     # Hybrid search
│   ├── supabase/
│   │   └── client.ts     # Supabase client
│   ├── scraper/
│   │   └── website.ts    # Website scraping
│   └── scheduler/
│       └── index.ts      # Cron jobs
└── utils/
    └── logger.ts         # Winston logger
```

## apps/dashboard (Next.js Admin UI)
```
src/
├── app/                  # Next.js App Router pages
├── components/           # React components
└── lib/                  # API client, utilities
```

## packages/shared
```
src/
├── index.ts              # Main export
├── constants.ts          # Shared constants (RAG_CONFIG, etc.)
└── types/
    ├── index.ts          # Type exports
    ├── documents.ts      # Document types
    ├── slack.ts          # Slack types
    ├── analytics.ts      # Analytics types
    ├── config.ts         # Config types
    └── conversations.ts  # Thread/session types
```

## supabase/
```
migrations/
├── 001_initial_schema.sql     # Tables, indexes, vector search
└── 002_learned_facts_function.sql
```

## Key Database Tables
- `documents` - Document metadata
- `document_chunks` - Chunks with embeddings
- `thread_sessions` - Slack thread sessions
- `thread_messages` - Messages within threads
- `learned_facts` - User corrections
- `bot_config` - Configuration
- `analytics` - Usage metrics
