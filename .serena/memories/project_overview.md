# Project Overview: TeamBrain AI

## Purpose
A multi-tenant SaaS platform for AI-powered knowledge management that:
- Deploys intelligent Slack bots for team Q&A
- Uses RAG (Retrieval Augmented Generation) for accurate, contextual responses
- Syncs documents automatically from Google Drive
- Scrapes company websites for up-to-date information
- Provides a comprehensive admin dashboard for configuration
- Supports multiple workspaces with isolated data (multi-tenancy)
- Integrates Stripe billing with tiered subscriptions

## Tech Stack
| Component | Technology |
|-----------|------------|
| AI/LLM | Google Gemini API (embeddings + generation) |
| Database | PostgreSQL + pgvector (Supabase) |
| Auth | Supabase Auth + JWT + RLS |
| Document Source | Google Drive API |
| Chat Interface | Slack Bolt SDK (Socket Mode) |
| Backend | Node.js/TypeScript + Express |
| Dashboard | Next.js 15 / React 19 |
| Web Scraping | Puppeteer / Cheerio |
| Billing | Stripe Subscriptions |
| Package Manager | pnpm (monorepo) |
| Testing | Vitest |
| Deployment | Docker + Traefik |

## Architecture
- **Monorepo** using pnpm workspaces
- `apps/api` - Backend Express API server (port 3000)
- `apps/dashboard` - Next.js admin dashboard (port 3001)
- `packages/shared` - Shared types and constants (@teambrain/shared)
- `supabase/migrations` - 15 database migrations
- `docs/` - Documentation (API, Database, Admin, Dashboard)

## Key Features
- Multi-tenant workspaces with RLS isolation
- Natural language question detection (no @mentions required)
- Threaded conversations in Slack
- Hybrid search (vector + BM25) with RRF fusion
- Google Drive document sync with polling
- Website scraping with configurable limits
- User feedback and self-learning system
- Admin dashboard for full configuration
- Platform admin panel for SaaS management
- Stripe billing with Starter/Pro/Business tiers

## Package Names
- `teambrain-ai` (root)
- `@teambrain/api` (backend)
- `@teambrain/dashboard` (frontend)
- `@teambrain/shared` (shared types)

## Implementation Status
All major phases complete:
- Phase 0: Setup Wizard ✓
- Phase SaaS: Multi-tenant transformation ✓
- Phase Landing: Marketing page ✓
- Phase 1-6: Core features ✓
- Phase Admin: Platform admin panel ✓
