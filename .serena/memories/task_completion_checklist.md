# Task Completion Checklist

## Before Marking Task Complete
Run these commands to ensure code quality:

### 1. Type Checking (Required)
```bash
pnpm typecheck
```
All packages must pass TypeScript compilation with strict mode.

### 2. Linting (Required)
```bash
pnpm lint
```
ESLint must pass with no errors.

### 3. Tests (If applicable)
```bash
pnpm test
```
Tests use Vitest. Ensure all tests pass.

### 4. Build Verification (For production changes)
```bash
pnpm build
```
Verify the project builds successfully.

## Commit Guidelines
- Check git status before commits: `git status && git branch`
- Create feature branches for work
- Use descriptive commit messages
- Never commit `.env` files or secrets

## Environment Variables
When adding new configuration:
1. Add to `apps/api/src/config/env.ts`
2. Add to `.env.example` with documentation
3. Add validation using Zod

## Database Changes
When modifying schema:
1. Create new migration in `supabase/migrations/`
2. Test migration: `pnpm db:migrate`
3. Update types if needed: `pnpm db:generate`

## API Changes
When adding/modifying routes:
1. Add route handler in `apps/api/src/routes/`
2. Register route in `apps/api/src/index.ts`
3. Update health endpoint if adding new service

## Shared Types
When adding shared types:
1. Add to appropriate file in `packages/shared/src/types/`
2. Export from index file
3. Rebuild shared package: `pnpm --filter shared build`
