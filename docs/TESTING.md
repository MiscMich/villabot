# Cluebase AI - Test Coverage Documentation

This document outlines the comprehensive testing strategy for the Cluebase AI platform, covering both API unit/integration tests and dashboard E2E tests.

## Test Infrastructure

### API Tests (Vitest)

**Location**: `apps/api/src/**/*.test.ts`

**Configuration**: `apps/api/vitest.config.ts`

**Run Tests**:
```bash
cd apps/api
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
pnpm test:coverage  # With coverage report
```

### Dashboard E2E Tests (Playwright)

**Location**: `apps/dashboard/e2e/**/*.spec.ts`

**Configuration**: `apps/dashboard/playwright.config.ts`

**Run Tests**:
```bash
cd apps/dashboard
pnpm test:e2e         # Headless mode
pnpm test:e2e:ui      # Playwright UI
pnpm test:e2e:headed  # Visible browser
pnpm test:e2e:debug   # Debug mode
```

---

## API Test Coverage

### RAG Pipeline Tests

| File | Tests | Coverage |
|------|-------|----------|
| `src/services/rag/search.test.ts` | 23 | Hybrid search, vector fallback, caching, reranking |
| `src/services/rag/chunking.test.ts` | 19 | Document chunking, metadata, contextual content |
| `src/utils/rerank.test.ts` | 15 | Result reranking algorithms |
| `src/utils/query-expansion.test.ts` | 23 | Query expansion with synonyms |

#### RAG Search Tests (`search.test.ts`)

**Hybrid Search**:
- Cache hit returns cached results without RPC call
- Correct RPC parameters for hybrid_search
- Bot-specific filtering with p_bot_id
- Minimum similarity threshold filtering
- Query expansion integration
- Reranking for multi-result sets
- No reranking for single results
- Cache storage on successful search
- Fallback to vector search on RPC error
- Empty array return on complete failure

**Vector Search**:
- Correct RPC call to match_documents
- Document metadata mapping

**Context Generation**:
- Empty string for no results
- Source attribution formatting
- Category labels in context
- Bot-specific filtering

**Workspace Isolation**:
- workspace_id required in all queries
- Cache isolation by workspace

#### Chunking Tests (`chunking.test.ts`)

- Empty content handling
- Whitespace-only content
- Metadata inclusion (title, fileType)
- Contextual content generation
- Chunk indexing
- Section info in contextual content
- Token estimation
- Chunk size validation

### Health Route Tests

| File | Tests | Coverage |
|------|-------|----------|
| `src/routes/__tests__/health.test.ts` | 10 | Health checks, service status |

**Health Endpoints**:
- GET /health - Overall system health
- GET /health/ready - Database readiness
- GET /health/live - Liveness probe
- Service status updates
- Integration count tracking

---

## E2E Test Coverage

### Authentication (`auth.spec.ts`)

**Login Page**:
- Login form display
- Empty submission validation
- Invalid credentials error
- Successful login redirect
- Signup link visibility

**Signup Page**:
- Form display
- Login link visibility

**Protected Routes**:
- Redirect unauthenticated users to login
- Protection of /dashboard, /bots, /documents, /settings

**Authenticated User**:
- Dashboard access verification
- User indicator display

### Dashboard (`dashboard.spec.ts`)

**Layout**:
- Header display
- Sidebar navigation
- Navigation links

**Stats Cards**:
- Document stats
- Activity stats
- Knowledge stats

**Navigation**:
- Documents, Bots, Knowledge, Settings links
- Billing and Team links (if visible)

**Accessibility**:
- Heading hierarchy
- Navigation accessibility
- Landmark regions

### Documents (`documents.spec.ts`)

**Layout**:
- Header display
- Sync controls
- Filter options

**Document List**:
- Documents or empty state display
- Metadata columns

**Filtering**:
- Google Drive source filter
- Website source filter

**Sync Controls**:
- Trigger sync functionality
- Status display

**Document Details**:
- Navigation to details

### Knowledge (`knowledge.spec.ts`)

**Layout**:
- Knowledge base header
- Add Fact button
- Stats cards

**Pending Facts**:
- Display or empty state
- Approve/reject buttons

**Verified Facts**:
- Display or empty state
- Delete button on hover

**Add Fact Modal**:
- Modal open/close
- Form display (fact, source)
- Validation
- Fact creation flow

**Verification Workflow**:
- Approve pending fact
- Reject with confirmation

### Bots (`bots.spec.ts`)

**Layout**:
- Bots header
- Create Bot button

**Bot List**:
- Bots or empty state
- Status indicators

**Create Modal**:
- Modal open/close
- Configuration form
- Slack token fields

**Bot Configuration**:
- Settings modal
- Knowledge sources section
- Slack channels section

**Bot Actions**:
- Start/stop controls
- Delete option

**Drive Folder Picker**:
- Browse Drive button
- Folder picker modal

### Settings (`settings.spec.ts`)

**Layout**:
- Settings header
- Tabs/sections

**General Settings**:
- Timezone setting
- Save button

**Integrations**:
- Google Drive integration
- Connect/disconnect button
- Connection status

**Form Validation**:
- Settings validation on save

### Billing (`billing.spec.ts`)

**Layout**:
- Billing header
- Current plan info

**Plan Display**:
- Plan options
- Features list

**Actions**:
- Upgrade button (free users)
- Manage subscription (paid users)

**Usage**:
- Usage metrics display

---

## Test File Summary

### API Tests (90 tests)

| Category | Files | Tests |
|----------|-------|-------|
| RAG Pipeline | 4 | 80 |
| Routes | 1 | 10 |
| **Total** | **5** | **90** |

### E2E Tests

| Spec File | Test Suites | Est. Tests |
|-----------|-------------|------------|
| auth.spec.ts | 4 | ~15 |
| dashboard.spec.ts | 7 | ~15 |
| documents.spec.ts | 8 | ~15 |
| knowledge.spec.ts | 10 | ~25 |
| bots.spec.ts | 9 | ~20 |
| settings.spec.ts | 5 | ~12 |
| billing.spec.ts | 5 | ~8 |
| **Total** | **48** | **~110** |

---

## Running Tests

### Full Test Suite

```bash
# From project root
pnpm test                    # API tests only
pnpm --filter dashboard test:e2e  # E2E tests

# Or from individual apps
cd apps/api && pnpm test
cd apps/dashboard && pnpm test:e2e
```

### CI/CD Integration

Tests are configured to run in CI with:
- Parallel execution disabled for stability
- Retries on failure (E2E only)
- HTML report generation
- Screenshot on failure

### Environment Setup

**API Tests**: No special setup required (mocked dependencies)

**E2E Tests**: Require `.env.test` with:
```env
PLAYWRIGHT_TEST_EMAIL=e2e@cluebase.ai
PLAYWRIGHT_TEST_PASSWORD=E2ETestPassword123!
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## Test Patterns

### API Test Pattern (Vitest)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../services/supabase/client.js', () => ({
  supabase: { rpc: vi.fn() },
}));

describe('Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null });
    const result = await featureFunction();
    expect(result).toBeDefined();
  });
});
```

### E2E Test Pattern (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feature');
    await page.waitForLoadState('networkidle');
  });

  test('should display header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /feature/i })).toBeVisible();
  });

  test('should handle user action', async ({ page }) => {
    await page.getByRole('button', { name: /action/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
```

---

## Coverage Goals

| Area | Current | Target |
|------|---------|--------|
| RAG Pipeline | 90+ tests | Comprehensive |
| API Routes | Basic | Expand for all routes |
| Dashboard Pages | All pages | All user flows |
| Integration | Mocked | Add real DB tests |

---

## Maintenance

### Adding New Tests

1. **API**: Create `*.test.ts` adjacent to source file
2. **E2E**: Add to `apps/dashboard/e2e/*.spec.ts`
3. Update this documentation

### Debugging Failed Tests

**API**: Run with `pnpm test -- --reporter=verbose`

**E2E**: Use `pnpm test:e2e:debug` or check `playwright-report/`

### Test Data

- E2E uses separate Supabase project for isolation
- API tests use mocked data only
- Never use production credentials in tests
