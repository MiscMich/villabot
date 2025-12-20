# Rate Limiting Documentation

## Overview

The TeamBrain AI API implements comprehensive rate limiting to prevent abuse and ensure fair usage across all workspaces based on their subscription tiers.

## Rate Limit Types

### 1. API Endpoint Rate Limits

**General API Routes** (`100 requests/minute per workspace`)
- `/api/workspaces`
- `/api/team`
- `/api/config`
- `/api/analytics`
- `/api/errors`
- `/api/conversations`
- `/api/bots`
- `/api/feedback`
- `/api/setup`
- `/api/billing`

**Document Sync Routes** (`10 requests/minute per workspace`)
- `/api/documents` (sync operations)

### 2. Query-Based Rate Limits (Monthly)

Based on subscription tier:
- **Starter**: 500 queries/month
- **Pro**: 5,000 queries/month
- **Business**: 25,000 queries/month
- **Internal Workspaces**: Unlimited

## Implementation Details

### Storage Backend

- **Primary**: In-memory LRU cache (10,000 entries, 1-hour TTL)
- **Future**: Redis support (optional, for multi-instance deployments)

### Rate Limit Headers

All rate-limited endpoints return these headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-12-20T12:00:00Z
```

### Rate Limit Responses

**HTTP 429 - Rate Limit Exceeded**

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "limit": 100,
  "current": 101,
  "remaining": 0,
  "resetAt": "2025-12-20T12:00:00Z",
  "retryAfter": 60
}
```

**HTTP 429 - Monthly Limit Exceeded**

```json
{
  "error": "Monthly query limit exceeded",
  "code": "MONTHLY_LIMIT_EXCEEDED",
  "limit": 500,
  "current": 501,
  "remaining": 0,
  "resetAt": "2025-12-31T23:59:59Z",
  "retryAfter": 950400,
  "upgrade_url": "/billing"
}
```

## Bypassing Rate Limits

### Internal Workspaces

Workspaces with `is_internal = true` bypass all rate limits automatically.

```sql
UPDATE workspaces SET is_internal = true WHERE id = 'workspace-id';
```

### Platform Admins

Users with active `platform_admins` role bypass all rate limits.

```sql
INSERT INTO platform_admins (user_id, role, is_active)
VALUES ('user-id', 'super_admin', true);
```

### Excluded Endpoints

The following endpoints have **NO rate limiting**:
- `/health` - Health check
- `/api/auth` - Authentication
- `/auth` - Google OAuth
- `/api/webhooks` - External webhooks (Stripe, etc.)
- `/api/admin` - Platform admin routes

## Usage Tracking

### Query Usage

Every successful RAG query is tracked:

```typescript
import { trackQueryUsage } from './middleware/rateLimit.js';

// After successful query
await trackQueryUsage(workspaceId);
```

This increments the `usage_tracking.queries_count` for the current month.

### Database Functions

**Check Usage**:
```sql
SELECT * FROM get_usage_summary('workspace-id');
```

**Check Remaining Queries**:
```sql
SELECT
  queries_limit - queries_count as remaining
FROM get_or_create_usage_tracking('workspace-id');
```

**Reset Monthly Usage** (done automatically):
- New usage tracking record created on first day of each month
- Previous month's data retained for analytics

## Middleware Usage

### Applying Rate Limiters

```typescript
import {
  generalApiRateLimiter,
  documentSyncRateLimiter,
  checkQueryRateLimit
} from './middleware/rateLimit.js';

// General API (100/min)
app.use('/api/analytics', generalApiRateLimiter, analyticsRouter);

// Document sync (10/min)
app.use('/api/documents', documentSyncRateLimiter, documentsRouter);

// Query rate limiting (monthly limits)
// Applied in Slack bot handlers automatically
```

### Creating Custom Rate Limiters

```typescript
import { createRateLimiter } from './middleware/rateLimit.js';

const customLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50,
  skipInternalWorkspaces: true,
  keyPrefix: 'rl:custom',
});

app.use('/api/custom', customLimiter, customRouter);
```

## Slack Bot Integration

### Automatic Query Tracking

The Slack bot automatically tracks query usage:

```typescript
// In BotInstance.registerMentionHandler()
// After successful response:
await trackQueryUsage(this.workspaceId);
```

### Rate Limit Handling

If a workspace exceeds its monthly query limit:
1. Bot responds with upgrade message
2. Query is NOT processed
3. Usage counter is NOT incremented
4. User sees helpful error message

## Monitoring & Analytics

### View Usage

```sql
-- Current month usage
SELECT * FROM usage_tracking
WHERE workspace_id = 'workspace-id'
  AND period_start = DATE_TRUNC('month', CURRENT_DATE);

-- Daily breakdown
SELECT * FROM usage_daily
WHERE workspace_id = 'workspace-id'
  AND date >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY date DESC;
```

### Dashboard Integration

The admin dashboard displays:
- Current month query usage (progress bar)
- Queries remaining
- Days until reset
- Usage history charts

## Testing Rate Limits

### Manual Testing

```bash
# Test general API rate limit
for i in {1..105}; do
  curl -H "Authorization: Bearer $TOKEN" \
       -H "X-Workspace-ID: $WORKSPACE_ID" \
       http://localhost:3000/api/analytics
done

# Should return 429 after 100 requests
```

### Clear Rate Limits (Development)

```typescript
import { clearRateLimits } from './middleware/rateLimit.js';

// Clear all in-memory rate limit data
clearRateLimits();
```

## Configuration

### Environment Variables

None required for basic operation. Optional:

```bash
# Future Redis support
REDIS_URL=redis://localhost:6379
```

### Tier Limits

Defined in `packages/shared/src/constants.ts`:

```typescript
export const TIER_CONFIGS = {
  starter: {
    limits: {
      queriesPerMonth: 500,
      // ...
    }
  },
  // ...
}
```

## Performance Considerations

### In-Memory Cache

- **Capacity**: 10,000 rate limit entries
- **Eviction**: LRU (Least Recently Used)
- **TTL**: 1 hour per entry
- **Impact**: Minimal (<10MB memory)

### Database Queries

- Usage tracking uses PostgreSQL functions with caching
- Monthly usage checked once per query
- Daily snapshots for analytics

### Scalability

For multi-instance deployments:
1. Add Redis backend
2. Update `initializeRedis()` in `middleware/rateLimit.ts`
3. Share rate limit state across instances

## Troubleshooting

### Rate Limits Not Working

1. Check workspace context is available:
   ```typescript
   if (!req.workspace) {
     // Rate limiter requires workspace context
   }
   ```

2. Verify middleware order:
   ```typescript
   // authenticate + resolveWorkspace MUST come before rate limiters
   app.use('/api/route', authenticate, resolveWorkspace, rateLimiter, router);
   ```

### Internal Workspace Not Bypassing

Check database:
```sql
SELECT id, name, is_internal FROM workspaces WHERE id = 'workspace-id';
```

### Query Tracking Issues

Check database function:
```sql
SELECT increment_query_count('workspace-id');
-- Should return true if successful
```

## Security Notes

- Rate limits are per-workspace, not per-user
- Internal workspaces should only be used for testing
- Platform admin access should be tightly controlled
- Webhook endpoints must NOT have rate limiting
- Health checks must remain unrestricted

## Future Enhancements

1. **Redis Backend**: Distributed rate limiting for multi-instance deployments
2. **Dynamic Limits**: Adjust limits based on usage patterns
3. **Rate Limit Analytics**: Track which workspaces hit limits most often
4. **Burst Allowance**: Allow temporary bursts above limit
5. **Custom Limits**: Per-workspace custom rate limits for enterprise
