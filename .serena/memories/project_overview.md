# Project Overview: Villa Paraiso Slack AI Assistant

## Purpose
An intelligent Slack bot for Villa Paraiso Vacation Rentals that:
- Answers team questions using SOPs and company documentation from Google Drive
- Uses RAG (Retrieval Augmented Generation) for accurate, contextual responses
- Self-learns and updates automatically when documents change
- Scrapes the company website weekly for up-to-date information
- Provides a UI dashboard for monitoring and configuration

## Tech Stack
| Component | Technology |
|-----------|------------|
| AI/LLM | Google Gemini API |
| Vector Database | Supabase (pgvector) |
| Document Source | Google Drive API |
| Chat Interface | Slack Bolt SDK |
| Backend | Node.js/TypeScript (Express) |
| Dashboard | Next.js 15 / React 19 |
| Web Scraping | Puppeteer / Cheerio |
| Package Manager | pnpm (monorepo) |
| Testing | Vitest |

## Architecture
- **Monorepo** using pnpm workspaces
- `apps/api` - Backend Express API server (port 3000)
- `apps/dashboard` - Next.js admin dashboard (port 3001)
- `packages/shared` - Shared types and constants
- `supabase/migrations` - Database migrations

## Key Features
- Natural language question detection (no @mentions required)
- Threaded conversations in Slack
- Hybrid search (vector + BM25 keyword)
- Google Drive document sync with polling
- User feedback and self-learning system
- Admin dashboard for configuration

## Implementation Status
Based on git commits:
- Phase 1: Foundation setup complete ✓
- Phase 2-5: Complete bot implementation ✓
- Phase 7: Next.js admin dashboard added ✓
