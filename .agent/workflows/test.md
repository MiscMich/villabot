---
description: Run tests and check code quality
---

# Test Workflow

## Quick Check (before committing)
// turbo-all
1. Type checking:
```bash
pnpm typecheck
```

2. Linting:
```bash
pnpm lint
```

3. Unit tests:
```bash
pnpm test
```

## Full E2E Tests
1. Run E2E tests headless:
```bash
cd apps/dashboard && pnpm test:e2e
```

2. Run with UI for debugging:
```bash
cd apps/dashboard && pnpm test:e2e:ui
```

3. Run specific test file:
```bash
cd apps/dashboard && pnpm test:e2e <filename>
```

## Coverage Report
```bash
pnpm test -- --coverage
```
