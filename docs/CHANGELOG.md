# Changelog

All notable changes to Cluebase AI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2025-12-27

### Added - Sentry Error Tracking & Monitoring (14:14)
Comprehensive error tracking and performance monitoring across the entire platform.

**API (`apps/api`)**
- `src/config/sentry.ts` - Core Sentry initialization with multi-tenant context support
  - OpenAI integration for LLM agent monitoring (`recordInputs`, `recordOutputs`)
  - Multi-tenant tagging (workspace_id, bot_id, user_id, channel_id)
  - Performance tracing (50% sample rate in production)
  - Express middleware integration
  - Graceful shutdown with event flushing
- `src/utils/logger.ts` - Custom Winston transport for Sentry
- `src/utils/error-tracker.ts` - Updated to use Sentry for error capture
- `src/config/env.ts` - Added `SENTRY_DSN` and `APP_VERSION` environment variables

**Dashboard (`apps/dashboard`)**
- `sentry.client.config.ts` - Browser-side Sentry with session replay
- `sentry.server.config.ts` - Server-side Sentry initialization
- `sentry.edge.config.ts` - Edge runtime initialization
- `instrumentation.ts` / `instrumentation-client.ts` - Next.js instrumentation hooks
- `src/app/global-error.tsx` - App Router global error boundary
- `next.config.ts` - Wrapped with `withSentryConfig` for source maps

**Sentry Project**: `michel-2v/cluebase-ai`

### Fixed - Code Review & Responsiveness (10:24)
- Dashboard responsive design improvements
- Setup wizard UX enhancements
- Backend resilience improvements

### Fixed - Docker Build Issues (08:56 - 09:13)
- `ec0b1f4` Add @types/node to shared package for Docker build
- `487231e` Revert to standard pnpm build and add workspace debug
- `eac1e8a` Add typescript to root workspace and simplify docker build
- `3798184` Use local tsc -b instead of global install to fix permissions
- `9c600f4` Add debug logging and explicit build steps for shared pkg
- `1df4fae` Run pnpm install in builder stage
- `2c6e83c` Ensure complete pnpm workspace install

### Changed - Architecture Consolidation (08:24 - 08:48)
- `343a8b9` Comprehensive codebase cleanup and security hardening
- `26d9f95` Consolidate Slack bot architecture and cleanup lint warnings

---

## [1.0.0] - 2025-12-26

### Added - Bot Credential Validation (13:24)
- `3d88373` Bot credential validation with circuit breaker pattern
- Automatic retry logic for transient failures
- Health monitoring for bot connections

### Fixed - Authentication Flow (13:50 - 14:13)
- `8e17dec` Use authenticated fetch for setup status check
- `f74815f` Check setup status via Supabase directly in middleware
- `b71d9ac` Pass auth token in middleware setup status check

---

## [0.9.0] - 2025-12-24

### Added - Platform Feedback System (18:45)
- `688dd5e` Platform feedback system for feature requests and bug reports
- Security hardening across authentication flows

### Added - Complete Auth Flow (20:00)
- `750e6d4` Magic link authentication
- Password reset functionality
- Email verification flow

### Changed - UI Design System (16:23)
- `d8d3324` Consistent styling audit across all pages
- Cosmic theme refinements
- Component standardization

### Fixed - Deployment (16:49 - 17:02)
- `2543624` Move openai package to production dependencies
- `8cfa3ea` Add OPENAI_API_KEY to docker-compose for Coolify

---

## [0.8.0] - 2025-12-23

### Added - Improvement Plan Implementation (19:14)
- `afda28a` Complete improvement plan execution
- Architecture documentation updates
- Google Drive picker enhancements
- UI cleanup and testing improvements

### Added - Slack App Installation Guide (16:54)
- `23fb07a` Enhanced Slack App installation guidance in setup wizard
- Step-by-step manifest configuration

### Fixed - Dashboard Redirect Loop (17:44 - 17:59)
- `e27cdbb` Resolve dashboard redirect loop
- `861ba42` Pass workspace ID to setup status check
- `239e7dc` Debug logging for setup redirect issues
- `a74aaa5` Update deployment documentation

### Fixed - Rate Limiting & Scraper (17:09 - 17:24)
- `34a8dab` Move rate limiters inside routers after resolveWorkspace
- `30797d7` Website scraper uses setup config URL instead of env var

### Fixed - Bot Auto-Activation (16:49 - 16:52)
- `91ccf38` Auto-activate and start bots during setup
- `0284fab` Prevent infinite redirect loop on 401 API responses

### Fixed - Docker & Environment (15:25 - 15:30)
- `8355988` Use environment variable for NEXT_PUBLIC_SUPABASE_URL
- `6e57a3c` Use GCR mirror for Docker images (bypass Docker Hub rate limits)

### Fixed - Setup Wizard (07:48 - 12:50)
- `79541f5` Enforce authentication before setup wizard
- `6f02cf9` Add error handling for workspace_members
- `3a46005` Wrap setup wizard in Suspense for useSearchParams
- `84d32b3` Add dynamic export to setup page
- `6afda5b` Remove sidebar from setup wizard (full-page experience)
- `a953c42` Add onConflict option to bot_config upserts
- `c12e2fa` Add workspace_id to createBot and bot_config table
- `f08a56b` Allow website URL as alternative to Google Drive
- `79f18a3` Fix Google Drive step bugs
- `f08d936` Correct health check architecture for multi-tenant design

---

## [0.7.0] - 2025-12-22

### Added - E2E Test Suite (21:20 - 22:00)
- `783dd43` Comprehensive E2E test suite with Playwright (68 tests)
- `5996cdb` Document tags migration for custom categorization
- `dbc6404` Improve E2E test resilience

### Added - Admin Panel (13:39 - 14:42)
- `bbe9650` Admin users management page
- `1179313` / `c041ec6` TypeScript type corrections
- `aa870eb` Per-workspace architecture documentation + cosmic theme

### Changed - Rebranding (23:30)
- `bbebbff` Rebrand to Cluebase AI
- Improve setup status detection

---

## [0.6.0] - 2025-12-21

### Added - Landing Page (22:08 - 22:54)
- `d05b07e` Landing page with modern design system
- `331cb25` / `50d38be` Fix GradientText component ref types

### Added - Dashboard UX Improvements (10:41)
- `040a4cf` Dashboard UX improvements
- Coolify deployment configuration

### Changed - Rebranding (16:58)
- `e21c41b` Complete TeamBrain → Cluebase rebranding
- Code quality fixes

### Fixed - Traefik Routing (12:34 - 18:41)
Multiple iterations to fix Traefik routing in Coolify:
- `b435156` Remove rate limiter from workspaces router
- `242318c` Use Node.js healthcheck instead of wget
- `ce209a1` / `df1a4d8` Add/remove coolify network
- `097d5bc` Use unique Traefik service names
- Various service port and network label adjustments

### Fixed - Docker & Deployment (00:42 - 06:38)
- `fe24659` Fix dashboard API URL and Supabase gateway routing
- `014bb68` Fix dashboard Dockerfile build args
- `09a0636` Remove Kong health check
- `ae23f81` Fix middleware for server-side API calls

---

## [0.5.0] - 2025-12-20

### Added - SaaS Transformation (18:05 - 19:03)
- `b21af68` Complete SaaS transformation for multi-tenant platform
- `53a6038` Comprehensive setup instructions
- `75fb839` TeamBrain AI rebranding and deployment alignment

### Added - Production Configuration (21:30 - 22:36)
- `203d734` Production deployment configuration
- `52bcaae` Fix signup flow for user profile and workspace creation
- `ef12700` Rebrand to Cluebase AI with cluebase.ai domain

### Added - Slack Manifest (19:46)
- `docs/SLACK_MANIFEST.yaml` - Slack app configuration template

### Fixed - Docker & Environment (21:36 - 22:32)
- `d8dd32f` / `a23aa53` Fix env validation
- `423d2a7` Handle empty strings gracefully
- `b636bac` Add missing dotenv dependency
- `a760e4b` / `312a1ee` Fix API Dockerfile

---

## [0.4.0] - 2025-12-20

### Added - Production Hardening (09:18 - 09:39)
- `f6fc311` Phase 3: Production hardening and premium dashboard UI
- `0e8589d` Conversations viewer and Docker deployment
- `77634b3` Multi-bot platform enhancement plan

---

## [0.3.0] - 2025-12-19

### Added - Complete Bot Implementation (22:12 - 22:33)
- `4313639` Phase 2-5: Complete bot implementation
- `5c558ea` Next.js admin dashboard

### Added - Foundation Setup (21:45 - 22:12)
- `41df583` Replace weather dashboard with Villa Paraiso Slack AI Bot plan
- `0f31a92` Natural language detection and enhanced features
- `ada8414` Error handling, edge cases, testing strategy, MVP scope
- `c75fc14` Comprehensive RAG implementation research
- `2210928` Phase 1: Foundation setup - monorepo structure and API skeleton

---

## [0.1.0] - 2022-05-17

### Added - Initial Commit
- `9de2d19` Initial repository setup
- `625d4ec` / `78f3581` Initial changes

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Commits | 95+ |
| Development Period | 2022-05-17 to 2025-12-27 |
| Active Development | 2025-12-19 to present |
| Major Features | Multi-tenant SaaS, RAG pipeline, Slack bots, Google Drive sync, Stripe billing, E2E tests, Sentry monitoring |
| Test Coverage | 68 Playwright E2E tests |

---

## Contributors

- **puffcooks** - Primary developer
- **Claude Opus 4.5** - AI pair programmer

---

## Links

- **Repository**: https://github.com/MiscMich/cluebase-ai
- **Dashboard**: https://cluebase.ai
- **API**: https://api.cluebase.ai
- **Sentry**: https://michel-2v.sentry.io/projects/cluebase-ai
