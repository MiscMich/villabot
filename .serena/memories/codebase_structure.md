# Codebase Structure: TeamBrain AI

## Root Files
- `package.json` - Root monorepo config (teambrain-ai@1.0.0)
- `pnpm-workspace.yaml` - Workspace definition (apps/*, packages/*)
- `tsconfig.base.json` - Shared TypeScript config
- `.env.example` - Environment variable template
- `PLAN.md` - Detailed implementation plan and architecture
- `SETUP.md` - Complete setup instructions
- `CLAUDE.md` - AI assistant instructions

## docs/
```
docs/
├── DEPLOYMENT.md     # Production deployment guide
├── API.md            # API endpoint reference
├── DATABASE.md       # Database schema reference
├── ADMIN.md          # Platform admin guide
├── DASHBOARD.md      # User dashboard guide
├── ADMIN_API_TESTING.md
└── ADMIN_BACKEND_SUMMARY.md
```

## apps/api (Backend API Server - @teambrain/api)
```
src/
├── index.ts              # Entry point, Express app setup
├── config/
│   └── env.ts            # Zod-validated environment config
├── middleware/
│   ├── auth.ts           # JWT authentication
│   ├── workspace.ts      # Workspace context middleware
│   ├── subscription.ts   # Tier limit enforcement
│   └── rateLimit.ts      # Rate limiting (tier-based)
├── routes/
│   ├── health.ts         # Health check endpoint
│   ├── config.ts         # Bot configuration API
│   ├── documents.ts      # Document management API
│   ├── analytics.ts      # Analytics API
│   ├── conversations.ts  # Thread viewer API
│   ├── bots.ts           # Multi-bot management
│   ├── feedback.ts       # User feedback API
│   ├── team.ts           # Team member management
│   ├── billing.ts        # Stripe integration
│   ├── workspaces.ts     # Workspace CRUD
│   ├── users-auth.ts     # Auth routes
│   ├── setup.ts          # Setup wizard API
│   └── admin.ts          # Platform admin API
├── services/
│   ├── slack/
│   │   ├── bot.ts        # Legacy single-bot setup
│   │   ├── instance.ts   # Multi-bot instance class
│   │   ├── manager.ts    # Bot lifecycle manager
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
│   ├── billing/
│   │   ├── stripe.ts     # Stripe client
│   │   └── webhooks.ts   # Stripe webhooks
│   ├── bots/
│   │   └── index.ts      # Bot CRUD service
│   └── scheduler/
│       └── index.ts      # Cron jobs
└── utils/
    ├── logger.ts         # Winston logger
    └── errorTracker.ts   # Error tracking utility
```

## apps/dashboard (Next.js Admin UI - @teambrain/dashboard)
```
src/
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Landing page (public)
│   ├── dashboard/        # Dashboard overview (auth required)
│   ├── documents/        # Document management
│   ├── knowledge/        # Learned facts
│   ├── analytics/        # Usage charts
│   ├── conversations/    # Thread viewer
│   ├── bots/             # Bot management
│   ├── feedback/         # Feedback review
│   ├── team/             # Team management
│   ├── billing/          # Subscription management
│   ├── settings/         # Workspace configuration
│   ├── setup/            # 8-step setup wizard
│   ├── auth/             # Sign in/up pages
│   └── admin/            # Platform admin panel
│       ├── page.tsx      # Admin overview
│       ├── workspaces/   # Workspace management
│       └── layout.tsx    # Admin layout
├── components/
│   ├── ui/               # Reusable UI components (shadcn)
│   ├── nav/              # Navigation components
│   └── modals/           # Modal dialogs
├── contexts/
│   ├── AuthContext.tsx   # Authentication state
│   └── WorkspaceContext.tsx  # Workspace state
└── lib/
    ├── api.ts            # API client
    └── supabase.ts       # Supabase client
```

## packages/shared (@teambrain/shared)
```
src/
├── index.ts              # Main export
├── constants.ts          # Shared constants (RAG_CONFIG, TIER_CONFIGS, etc.)
└── types/
    ├── index.ts          # Type exports
    ├── documents.ts      # Document types
    ├── slack.ts          # Slack types
    ├── analytics.ts      # Analytics types
    ├── config.ts         # Config types
    ├── conversations.ts  # Thread/session types
    ├── bots.ts           # Bot types
    ├── feedback.ts       # Feedback types
    ├── workspace.ts      # Workspace/subscription types
    └── users.ts          # User profile types
```

## supabase/
```
migrations/
├── 001_documents.sql           # Core document tables
├── 002_document_chunks.sql     # Vector embeddings
├── 003_thread_sessions.sql     # Conversation threads
├── 004_learned_facts.sql       # Knowledge corrections
├── 005_analytics.sql           # Usage analytics
├── 006_multi_bot_platform.sql  # Multi-bot support
├── 007_feedback_system.sql     # User feedback
├── 008_workspaces_foundation.sql # Multi-tenant workspaces
├── 009_add_workspace_id.sql    # Workspace isolation
├── 010_rls_policies.sql        # Row-level security
├── 011_subscriptions.sql       # Stripe billing
├── 012_usage_tracking.sql      # Tier enforcement
├── 013_enforce_workspace_isolation.sql # NOT NULL constraints
├── 014_platform_admin.sql      # Admin roles
└── 015_bot_health.sql          # Health monitoring
```

## Docker Files
- `docker-compose.yml` - Main services (api, dashboard)
- `docker-compose.supabase.yml` - Self-hosted Supabase
- `apps/api/Dockerfile` - API production build
- `apps/dashboard/Dockerfile` - Dashboard production build
- `traefik/` - Reverse proxy configuration
