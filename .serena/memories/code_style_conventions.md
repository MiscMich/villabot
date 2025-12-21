# Code Style and Conventions

## TypeScript Configuration
- **Target**: ES2022
- **Module**: NodeNext
- **Strict Mode**: Enabled
- **noUnusedLocals**: true
- **noUnusedParameters**: true
- **noUncheckedIndexedAccess**: true
- **exactOptionalPropertyTypes**: true

## Module System
- ESM modules (`"type": "module"` in package.json)
- File extensions required in imports (`.js` suffix)

## Naming Conventions
- **Files**: kebab-case (e.g., `google-drive.ts`, `slack-bot.ts`)
- **Types/Interfaces**: PascalCase (e.g., `Document`, `SlackMessage`)
- **Functions**: camelCase (e.g., `processDocument`, `handleMessage`)
- **Constants**: UPPER_SNAKE_CASE for config objects (e.g., `CHUNK_CONFIG`)

## Project Structure
```
apps/api/src/
├── config/           # Environment configuration
├── routes/           # Express route handlers
├── services/         # Business logic
│   ├── google-drive/ # Drive API integration
│   ├── slack/        # Slack bot handlers
│   ├── rag/          # RAG pipeline
│   ├── supabase/     # Database client
│   ├── scraper/      # Website scraping
│   └── scheduler/    # Cron jobs
└── utils/            # Shared utilities
```

## Import Style
```typescript
// External packages first
import express from 'express';
import cors from 'cors';

// Internal imports with .js extension
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
```

## Error Handling
- Use try/catch with proper logging
- Centralized error handler in Express
- Graceful degradation when services unavailable

## Logging
- Winston logger with configurable levels
- Structured logging with metadata objects
- Log levels: info, debug, warn, error

## Type Exports
- Shared types in `packages/shared/src/types/`
- Re-exported from main index files
- Use workspace imports: `@teambrain/shared`
