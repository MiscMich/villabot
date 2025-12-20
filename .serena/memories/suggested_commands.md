# Development Commands

## Installation
```bash
pnpm install          # Install all dependencies
```

## Development
```bash
pnpm dev              # Start API server (port 3000)
pnpm dev:dashboard    # Start dashboard (port 3001)
```

## Building
```bash
pnpm build            # Build all packages
```

## Code Quality
```bash
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint
pnpm test             # Run tests with Vitest
```

## Database
```bash
pnpm db:migrate       # Run database migrations
pnpm db:generate      # Generate types from Supabase
```

## Individual Package Commands
```bash
# API (from apps/api or root with --filter)
pnpm --filter api dev
pnpm --filter api build
pnpm --filter api test
pnpm --filter api test:watch

# Dashboard (from apps/dashboard)
pnpm --filter dashboard dev
pnpm --filter dashboard build
pnpm --filter dashboard lint

# Shared (from packages/shared)
pnpm --filter shared build
pnpm --filter shared dev  # Watch mode
```

## Health Check
```bash
curl http://localhost:3000/health
curl http://localhost:3000/        # API info
```

## System Commands (macOS/Darwin)
```bash
git status            # Check git status
git branch            # List branches
ls -la                # List files with details
find . -name "*.ts"   # Find TypeScript files
grep -r "pattern" .   # Search for pattern
```
