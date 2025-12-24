---
description: End-to-end feature development workflow
---

# Feature Development Workflow

## Phase 1: Planning
1. Understand the feature requirements
2. Create an implementation plan in the artifacts directory
3. Break down into tasks in `task.md`
4. Request user approval before proceeding

## Phase 2: Implementation
1. Create a feature branch:
```bash
git checkout -b feat/<feature-name>
```

2. Implement the feature following these steps:
   - Start with database schema changes (if any)
   - Implement backend API routes
   - Add frontend UI components
   - Connect frontend to backend

3. After each major component, run checks:
// turbo
```bash
pnpm typecheck && pnpm lint
```

## Phase 3: Testing
1. Write unit tests for utilities and services
2. Write E2E tests for user flows:
```bash
cd apps/dashboard && pnpm test:e2e
```

3. Manual testing in browser if needed

## Phase 4: Completion
1. Run full test suite:
// turbo
```bash
pnpm test
```

2. Build to verify production:
// turbo
```bash
pnpm build
```

3. Create commit with conventional message:
```bash
git add . && git commit -m "feat(<scope>): <description>"
```

4. Create walkthrough artifact documenting the changes
