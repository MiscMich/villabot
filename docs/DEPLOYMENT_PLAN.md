# Cluebase AI - Deployment & Completion Plan

## Current Status

| Item | Status |
|------|--------|
| Supabase Migrations | **Partially applied** (unknown state) |
| Coolify Deployment | **Not yet deployed** |
| Development Tasks | 5 tasks remaining for Phase 2 & 5 |

---

## Execution Order

### Step 1: Check Migration State (MANUAL - User Action)

Run this query in Supabase Studio to see which tables exist:

```sql
-- Check which key tables exist to determine migration state
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'documents',           -- 001
  'learned_facts',       -- 002
  'error_logs',          -- 005
  'bots',                -- 006
  'response_feedback',   -- 007
  'workspaces',          -- 008
  'usage_tracking',      -- 012
  'admin_audit_log',     -- 014
  'bot_health'           -- 015
)
ORDER BY table_name;

-- Check if workspace_id exists on documents (migration 009+)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'documents' AND column_name = 'workspace_id';

-- Check if RLS is enabled (migration 010+)
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'documents';
```

**Based on results:**
- If `workspaces` doesn't exist → Start from `008_workspaces_foundation.sql`
- If `workspace_id` column missing → Start from `009_add_workspace_id.sql`
- If `rowsecurity = false` → Start from `010_rls_policies.sql`
- If `bot_health` missing → Start from `015_bot_health.sql`

### Step 2: Apply Remaining Migrations (MANUAL - User Action)

**Migration Order** (apply only what's missing):
```
008_workspaces_foundation.sql    -- Creates workspaces, user_profiles, members
009_add_workspace_id.sql         -- Adds workspace_id to all tables
010_rls_policies.sql             -- Enables Row-Level Security
011_subscriptions.sql            -- Stripe billing tables
012_usage_tracking.sql           -- Usage limits enforcement
013_enforce_workspace_isolation.sql -- NOT NULL constraints, default workspace
014_platform_admin.sql           -- Admin panel support
015_bot_health.sql               -- Bot health monitoring
```

### Step 3: Post-Migration Verification

Run these queries to verify:

```sql
-- Check for orphaned data (should return 0 rows each)
SELECT COUNT(*) as orphaned_docs FROM documents WHERE workspace_id IS NULL;
SELECT COUNT(*) as orphaned_bots FROM bots WHERE workspace_id IS NULL;
SELECT COUNT(*) as orphaned_threads FROM thread_sessions WHERE workspace_id IS NULL;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('documents', 'bots', 'workspaces', 'user_profiles')
ORDER BY tablename;

-- Verify hybrid_search function exists with workspace param
SELECT proname, pronargs FROM pg_proc WHERE proname = 'hybrid_search';
```

### Step 3.1: Create Platform Admin User

```sql
-- After first user signs up, make them platform admin
UPDATE user_profiles
SET is_platform_admin = true
WHERE email = 'YOUR_ADMIN_EMAIL';
```

---

## Step 4: Parallel Development (AGENTS)

Launch 5 agents simultaneously to complete remaining tasks:

| Agent | Task | Files | Time |
|-------|------|-------|------|
| **frontend-architect** | Scrape Progress Tracking | `scraper/website.ts`, `routes/documents.ts`, `documents/page.tsx` | ~15 min |
| **frontend-architect** | Category Assignment | `scraper/website.ts`, `routes/documents.ts`, `documents/page.tsx` | ~10 min |
| **frontend-architect** | Error Boundaries | Create `error.tsx` files in dashboard | ~10 min |
| **frontend-architect** | Toast Integration | `documents/page.tsx`, `bots/page.tsx`, `team/page.tsx` | ~10 min |
| **frontend-architect** | Mobile Sidebar | `sidebar.tsx`, `layout.tsx` | ~15 min |

### Task A: Scrape Progress Tracking (API + Dashboard)

**Files to modify:**
- `apps/api/src/services/scraper/website.ts` - Add progress event emission
- `apps/api/src/routes/documents.ts` - Add SSE endpoint for progress
- `apps/dashboard/src/app/documents/page.tsx` - Add polling/SSE listener

**Implementation:**
1. Add `scrapeProgress` state tracking in scraper service
2. Create `GET /api/documents/scrape/progress` SSE endpoint
3. Dashboard polls every 2 seconds during active scrape
4. Show: pages found, pages scraped, current URL, ETA

### Task B: Category Assignment for Scraped Pages

**Files to modify:**
- `apps/api/src/services/scraper/website.ts` - Add category parameter
- `apps/api/src/routes/documents.ts` - Accept category in scrape request
- `apps/dashboard/src/app/documents/page.tsx` - Category selector before scrape

**Implementation:**
1. Add `category` field to scrape config (default: 'website' or 'company_knowledge')
2. Pass category to document insert in scraper
3. Add dropdown in dashboard before "Scrape Now" button

### Task C: Error Boundaries

**Files to create:**
- `apps/dashboard/src/app/error.tsx` - Root error boundary
- `apps/dashboard/src/app/dashboard/error.tsx` - Dashboard error boundary
- `apps/dashboard/src/app/admin/error.tsx` - Admin error boundary

**Implementation:**
```tsx
// apps/dashboard/src/app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground mt-2">{error.message}</p>
        <button onClick={reset} className="mt-4 btn">Try again</button>
      </div>
    </div>
  );
}
```

### Task D: Toast Integration in Mutations

**Files to modify:**
- `apps/dashboard/src/app/documents/page.tsx` - Add toast for sync/scrape
- `apps/dashboard/src/app/bots/page.tsx` - Add toast for bot operations
- `apps/dashboard/src/app/team/page.tsx` - Add toast for invite operations

**Pattern:**
```tsx
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

// On success
toast({ title: 'Success', description: 'Bot created successfully' });

// On error
toast({ title: 'Error', description: error.message, variant: 'destructive' });
```

### Task E: Mobile-Responsive Sidebar

**Files to modify:**
- `apps/dashboard/src/components/sidebar.tsx` - Add mobile toggle
- `apps/dashboard/src/app/layout.tsx` - Add mobile menu state

**Implementation:**
1. Add hamburger menu button (visible on `md:hidden`)
2. Sidebar slides in as overlay on mobile
3. Close on navigation or outside click
4. Add backdrop blur when open

---

## Step 5: Coolify Deployment Setup (MANUAL)

### 5.1 Deploy Supabase Service

1. In Coolify: **Services** → **+ New Service** → Search "Supabase"
2. Configure domain: `supabase.cluebase.ai`
3. Deploy and wait for all components to start
4. Note credentials from service configuration:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### 5.2 Deploy API Service

1. **Resources** → **+ New** → **Docker Compose**
2. Git: `https://github.com/MiscMich/cluebase-ai`, branch `main`
3. Compose file: `apps/api/docker-compose.coolify.yml`
4. Domain: `api.cluebase.ai`
5. Environment variables (from .env.example + Supabase creds)

### 5.3 Deploy Dashboard Service

1. **Resources** → **+ New** → **Docker Compose**
2. Git: `https://github.com/MiscMich/cluebase-ai`, branch `main`
3. Compose file: `apps/dashboard/docker-compose.coolify.yml`
4. Domain: `cluebase.ai`
5. Environment variables:
   ```
   SUPABASE_ANON_KEY=<from-supabase>
   API_URL=http://api:3000
   ```

---

## Step 6: Verification

### After Code Changes
```bash
pnpm typecheck && pnpm lint && pnpm build
```

### After Deployment
```bash
# Health check
curl https://api.cluebase.ai/health

# Dashboard loads
curl -I https://cluebase.ai
```

### Functional Tests
- [ ] Sign up creates workspace
- [ ] Bot creation works
- [ ] Document sync works
- [ ] Scrape shows progress
- [ ] Mobile sidebar toggles

---

## Critical Files Reference

**API:**
- `apps/api/docker-compose.coolify.yml`
- `apps/api/src/index.ts`
- `apps/api/src/routes/documents.ts`
- `apps/api/src/services/scraper/website.ts`

**Dashboard:**
- `apps/dashboard/docker-compose.coolify.yml`
- `apps/dashboard/src/app/documents/page.tsx`
- `apps/dashboard/src/components/sidebar.tsx`

**Migrations:**
- `supabase/migrations/001-015_*.sql` (all 15 files)

**Shared:**
- `packages/shared/src/types/` (all type definitions)
