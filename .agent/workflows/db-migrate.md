---
description: Create and run database migrations
---

# Database Migration Workflow

## Creating a New Migration
1. Determine the next migration number:
```bash
ls supabase/migrations/ | tail -5
```

2. Create a new migration file:
```bash
touch "supabase/migrations/$(date +%Y%m%d%H%M%S)_<description>.sql"
```

3. Write the migration SQL with:
   - Forward migration (CREATE, ALTER, etc.)
   - Use `IF NOT EXISTS` for safety
   - Add comments explaining the change

## Running Migrations
1. Apply migrations to Supabase Cloud:
```bash
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

2. Verify the migration was applied:
```bash
npx supabase db diff --db-url "$SUPABASE_DB_URL"
```

## Rollback (Manual)
1. Create a rollback migration with the reverse operations
2. Apply the rollback migration

## Best Practices
- Always test migrations locally first
- Include RLS policies for new tables
- Add indexes for frequently queried columns
- Document the purpose of each migration
