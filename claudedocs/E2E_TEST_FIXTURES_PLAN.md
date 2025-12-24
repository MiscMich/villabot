# E2E Test Fixtures with Supabase - Implementation Plan

> **Status**: Ready for implementation
> **Created**: 2025-12-23
> **Decisions Made**: Keep Cloud + Add Fixtures, Per-Suite Isolation

## Summary
Add test fixtures and per-suite database isolation to existing E2E tests while keeping Supabase Cloud.

**Approach**: Keep Cloud + Add Fixtures with Per-Suite Isolation

## Architecture

```
Global Setup (once)           Per-Suite (beforeAll)         Tests
      │                              │                        │
      ▼                              ▼                        ▼
┌─────────────┐              ┌──────────────┐         ┌────────────┐
│ Verify E2E  │              │ Reset        │         │ Run with   │
│ user exists │──────────────│ workspace    │─────────│ predictable│
│ Get ws ID   │              │ Seed data    │         │ data state │
└─────────────┘              └──────────────┘         └────────────┘
```

## Files to Create

### 1. Fixture Foundation
```
apps/dashboard/e2e/fixtures/
├── db.ts              # Supabase admin client (service role)
├── cleanup.ts         # Table cleanup in FK order
├── seed.ts            # Data seeding functions
├── test-data.ts       # Fixture constants
├── index.ts           # Extended test with fixtures
```

### 2. Global Setup
```
apps/dashboard/e2e/setup/
├── global.setup.ts    # Get workspace ID, store in env
└── global.teardown.ts # Optional final cleanup
```

## Files to Modify

| File | Change |
|------|--------|
| `apps/dashboard/.env.test` | Add `SUPABASE_SERVICE_ROLE_KEY` |
| `apps/dashboard/playwright.config.ts` | Add `globalSetup`, `globalTeardown`, disable parallel |
| `apps/dashboard/e2e/*.spec.ts` | Import fixtures, add `beforeAll` reset/seed |

## Implementation Steps

### Phase 1: Foundation
1. **Create `fixtures/db.ts`** - Admin client with service role
2. **Add service role key** to `.env.test`

### Phase 2: Cleanup
3. **Create `fixtures/cleanup.ts`** - Delete in FK order:
   ```
   thread_messages → thread_sessions → document_chunks → documents →
   bot_channels → bot_drive_folders → response_feedback → bots →
   learned_facts → analytics
   ```
   (Preserves: workspaces, workspace_members, user_profiles, billing tables)

### Phase 3: Seeding
4. **Create `fixtures/test-data.ts`** - Predictable test constants
5. **Create `fixtures/seed.ts`** - Insert functions for bots, documents, facts

### Phase 4: Playwright Integration
6. **Create `fixtures/index.ts`** - Extended `test` with fixtures
7. **Create `setup/global.setup.ts`** - Workspace ID retrieval
8. **Update `playwright.config.ts`** - Add globalSetup, disable parallel

### Phase 5: Migrate Tests
9. **Update spec files** - Import from fixtures, add beforeAll hooks

## Key Code Patterns

### Cleanup Order (respects foreign keys)
```typescript
const CLEANUP_ORDER = [
  'thread_messages', 'thread_sessions', 'document_chunks', 'documents',
  'bot_channels', 'bot_drive_folders', 'response_feedback', 'bots',
  'learned_facts', 'analytics'
];
```

### Extended Test Fixture
```typescript
export const test = base.extend<WorkspaceFixture>({
  workspaceId: process.env.E2E_WORKSPACE_ID,
  resetWorkspace: async ({ workspaceId }, use) => { /* cleanup fn */ },
  seedData: async ({ workspaceId }, use) => { /* seed all fn */ },
});
```

### Usage in Spec Files
```typescript
import { test, expect } from './fixtures';

test.describe('Bots', () => {
  test.beforeAll(async ({ resetWorkspace, seedBots }) => {
    await resetWorkspace();
    await seedBots();
  });

  test('displays seeded bot', async ({ page }) => {
    await expect(page.getByText('E2E Test Bot')).toBeVisible();
  });
});
```

## Environment Variable Addition

```env
# apps/dashboard/.env.test
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Get from Supabase dashboard
```

## Playwright Config Changes

```typescript
// playwright.config.ts
export default defineConfig({
  globalSetup: './e2e/setup/global.setup.ts',
  globalTeardown: './e2e/setup/global.teardown.ts',
  fullyParallel: false, // Sequential for DB consistency
  // ... rest unchanged
});
```

## Critical Files Reference

- `apps/dashboard/playwright.config.ts` - Main config to modify
- `apps/dashboard/e2e/setup/auth.setup.ts` - Existing auth pattern
- `apps/dashboard/.env.test` - Add service role key
- `supabase/migrations/013_enforce_workspace_isolation.sql` - FK reference

## Success Criteria

- [x] Each spec file starts with clean, predictable data state
- [x] Tests don't depend on data from previous test runs
- [x] Service role operations bypass RLS correctly
- [x] Cleanup respects foreign key constraints
- [x] Global setup retrieves workspace ID reliably

## Implementation Status

**✅ IMPLEMENTED** (2025-12-23)

All fixture files created and typecheck passes:
- `e2e/fixtures/db.ts` - Admin client with service role
- `e2e/fixtures/cleanup.ts` - FK-ordered cleanup
- `e2e/fixtures/test-data.ts` - Predictable test constants
- `e2e/fixtures/seed.ts` - Data seeding functions
- `e2e/fixtures/index.ts` - Extended Playwright test
- `e2e/setup/global.setup.ts` - Workspace ID retrieval
- `e2e/setup/global.teardown.ts` - Final cleanup
- `playwright.config.ts` - Updated with globalSetup

**Next Step**: Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.test` and migrate spec files

---

## How to Resume

When you return, tell Claude:
> "Continue implementing the E2E test fixtures plan from claudedocs/E2E_TEST_FIXTURES_PLAN.md"

Claude will read this file and continue from where you left off.
