# Cluebase AI - Architecture Overview

This document describes the multi-tenant architecture and workspace isolation model.

## Multi-Tenant Model

Cluebase AI uses a **shared database, isolated data** multi-tenant architecture. All workspaces share the same infrastructure but data is completely isolated using PostgreSQL Row Level Security (RLS).

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Cluebase Platform                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │ Workspace A │    │ Workspace B │    │ Workspace C │    ...       │
│  │             │    │             │    │             │              │
│  │ - Documents │    │ - Documents │    │ - Documents │              │
│  │ - Bots      │    │ - Bots      │    │ - Bots      │              │
│  │ - Team      │    │ - Team      │    │ - Team      │              │
│  │ - Slack App │    │ - Slack App │    │ - Slack App │              │
│  │ - Drive     │    │ - Drive     │    │ - Drive     │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                              │                                       │
│                    ┌─────────┴─────────┐                            │
│                    │ Shared Database   │                            │
│                    │ (PostgreSQL + RLS)│                            │
│                    └───────────────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
```

## Workspace Isolation

### Database-Level Isolation

Every table containing customer data includes a `workspace_id` column and RLS policies:

| Table | Isolation | Description |
|-------|-----------|-------------|
| `documents` | Per-workspace | Document metadata |
| `document_chunks` | Per-workspace | Chunked content + embeddings |
| `bots` | Per-workspace | Bot configurations |
| `thread_sessions` | Per-workspace | Slack conversation threads |
| `thread_messages` | Per-workspace | Individual messages |
| `learned_facts` | Per-workspace | User-taught corrections |
| `analytics` | Per-workspace | Usage events |
| `response_feedback` | Per-workspace | Feedback on responses |
| `workspace_members` | Per-workspace | Team membership |

### RLS Policy Example

```sql
-- Users can only view documents in workspaces they belong to
CREATE POLICY "workspace_isolation" ON documents
FOR ALL USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  )
);
```

### API-Level Isolation

All API endpoints validate workspace membership before returning data:

```typescript
// Every request is scoped to user's current workspace
app.use('/api/*', workspaceMiddleware); // Sets req.workspaceId

// All queries include workspace filter
const documents = await db.documents.findMany({
  where: { workspace_id: req.workspaceId }
});
```

## Integration Architecture

### Slack Bot Integration

Each workspace creates and manages their own Slack app:

```
Workspace A                    Slack
┌────────────────┐            ┌────────────────┐
│ Bot Token A    │────────────│ Slack App A    │
│ (xoxb-...)     │            │ (in Team A)    │
└────────────────┘            └────────────────┘

Workspace B                    Slack
┌────────────────┐            ┌────────────────┐
│ Bot Token B    │────────────│ Slack App B    │
│ (xoxb-...)     │            │ (in Team B)    │
└────────────────┘            └────────────────┘
```

**Why per-workspace Slack apps?**
- Slack requires each app to be installed per-workspace
- Each customer controls their own app permissions
- Token revocation is isolated to one workspace
- Customers can customize bot name/icon in their Slack

**User Setup Flow:**
1. User creates a Slack app at api.slack.com
2. Enables Socket Mode and Event Subscriptions
3. Installs app to their Slack workspace
4. Copies Bot Token (`xoxb-...`) and App Token (`xapp-...`) to Cluebase

### Google Drive Integration

The platform owns a single OAuth application; users authenticate their Google accounts:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Platform OAuth App                              │
│              (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)              │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
       ┌────────────┐  ┌────────────┐  ┌────────────┐
       │ Workspace A│  │ Workspace B│  │ Workspace C│
       │            │  │            │  │            │
       │ OAuth Token│  │ OAuth Token│  │ OAuth Token│
       │ (per-user) │  │ (per-user) │  │ (per-user) │
       │     │      │  │     │      │  │     │      │
       │     ▼      │  │     ▼      │  │     ▼      │
       │ User's     │  │ User's     │  │ User's     │
       │ Drive      │  │ Drive      │  │ Drive      │
       └────────────┘  └────────────┘  └────────────┘
```

**Why platform-managed OAuth?**
- Users don't need Google Cloud Console access
- One-click "Connect Google Drive" experience
- Platform handles token refresh automatically
- Simpler user onboarding

**User Setup Flow:**
1. User clicks "Connect Google Drive" button
2. Redirected to Google OAuth consent screen
3. Grants read access to Drive files
4. Token stored securely in workspace record

### Token Storage

Credentials are stored in the database:

```sql
-- Bot-level Slack tokens (per-bot credentials)
bots.slack_bot_token      -- OAuth bot token (xoxb-...)
bots.slack_app_token      -- Socket Mode app token (xapp-...)
bots.slack_team_id        -- Slack workspace ID

-- Google Drive tokens (stored in bot_config with workspace isolation)
bot_config.key            -- 'google_drive_tokens'
bot_config.workspace_id   -- Associates tokens with workspace
bot_config.value          -- JSONB: { access_token, refresh_token, expiry_date, connected_at }
```

**Note**: Google Drive OAuth tokens are stored per-workspace in `bot_config` with `workspace_id` foreign key. The OAuth flow encodes workspace context in the state parameter, ensuring tokens are associated with the correct workspace on callback. Legacy tokens (with `workspace_id = null`) are automatically migrated during setup completion.

## User Roles

### Platform Roles

| Role | Scope | Description |
|------|-------|-------------|
| **Platform Admin** | All workspaces | Full platform access, can view all workspaces |
| **User** | Own workspaces | Standard user with workspace-scoped access |

Platform admin is determined by `user_profiles.is_platform_admin = true`.

### Workspace Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full control, billing, delete workspace |
| **Admin** | Manage team, bots, documents |
| **Member** | View dashboard, use bot |

## Data Flow

### Query Flow (RAG Pipeline)

```
1. User asks question in Slack
   │
2. Bot receives message via Socket Mode
   │
3. API validates workspace from bot credentials
   │
4. Hybrid search runs ONLY on workspace's chunks
   │  ├─ Vector search (semantic similarity)
   │  └─ BM25 search (keyword matching)
   │
5. RRF fusion combines results
   │
6. OpenAI generates response with sources
   │
7. Response sent to Slack thread
```

### Document Sync Flow

```
1. User connects Google Drive
   │
2. OAuth tokens stored in workspace record
   │
3. Sync job fetches files from user's Drive
   │
4. Documents chunked and embedded
   │
5. Chunks stored with workspace_id
   │
6. Available for RAG queries
```

## Subscription Tiers

Limits are enforced per-workspace:

| Limit | Starter | Pro | Business |
|-------|---------|-----|----------|
| Queries/month | 500 | 5,000 | 25,000 |
| Documents | 1,000 | 10,000 | 50,000 |
| Bots | 1 | 3 | 10 |
| Team members | 3 | 10 | Unlimited |

Billing is managed via Stripe with `workspace.stripe_customer_id` and `workspace.stripe_subscription_id`.

## Resilience Patterns

### Circuit Breakers

The platform implements the circuit breaker pattern to prevent cascading failures when external services experience issues:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Circuit Breaker State Machine                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────┐         failures >= threshold        ┌─────────┐              │
│   │ CLOSED  │ ────────────────────────────────────▶│  OPEN   │              │
│   │(normal) │                                      │(fail    │              │
│   └────▲────┘                                      │ fast)   │              │
│        │                                           └────┬────┘              │
│        │                                                │                   │
│        │      success >= threshold                      │ reset timeout     │
│        │      ┌────────────┐                            │                   │
│        └──────│ HALF_OPEN  │◀───────────────────────────┘                   │
│               │ (testing)  │                                                │
│               └──────┬─────┘                                                │
│                      │ failure                                              │
│                      └────────▶ back to OPEN                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Configured Circuit Breakers:**

| Service | Failure Threshold | Reset Timeout | Success Threshold |
|---------|-------------------|---------------|-------------------|
| OpenAI | 5 failures | 30 seconds | 2 successes |
| Google Drive | 5 failures | 60 seconds | 2 successes |
| Slack (per-bot) | 3 failures | 60 seconds | 1 success |

**Files:**
- `apps/api/src/utils/circuit-breaker.ts` - Implementation
- `apps/api/src/services/rag/embeddings.ts` - OpenAI integration
- `apps/api/src/services/google-drive/client.ts` - Drive integration

### Rate Limiting

Dual-mode rate limiting with automatic failover:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         Rate Limiting Architecture                          │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   Request → ┌─────────────────┐    ┌─────────────┐                        │
│             │  Redis Check    │───▶│ Rate Limit  │──▶ Allow/Reject        │
│             │  (if available) │    │   Logic     │                        │
│             └────────┬────────┘    └─────────────┘                        │
│                      │                    ▲                                │
│              Redis   │                    │                                │
│            unavailable                    │                                │
│                      ▼                    │                                │
│             ┌─────────────────┐           │                                │
│             │ In-Memory LRU   │───────────┘                                │
│             │ (fallback)      │                                            │
│             └─────────────────┘                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Atomic Redis operations (INCR + PEXPIRE pipeline)
- Automatic fallback to in-memory when Redis unavailable
- LRU eviction prevents memory bloat in fallback mode

**File:** `apps/api/src/middleware/rateLimit.ts`

### Error Boundaries (Dashboard)

React error boundaries prevent full-page crashes:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             Error Boundary Tree                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   <App>                                                                    │
│     └── <ErrorBoundary resetKey={pathname}>                               │
│           └── <DashboardLayout>                                           │
│                 ├── <Sidebar />                                           │
│                 └── <MainContent>                                         │
│                       ├── <Page A /> ← error caught here                 │
│                       └── <Page B />   doesn't affect Page B             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Components:**
- `ErrorBoundary` - Full-page error UI with retry button
- `InlineErrorBoundary` - Minimal inline error state
- `withErrorBoundary` - HOC for wrapping components

**File:** `apps/dashboard/src/components/error-boundary.tsx`

### SSE Reconnection

EventSource client with robust reconnection:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         SSE Reconnection Strategy                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   Connection lost                                                          │
│        │                                                                   │
│        ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐ │
│   │              Exponential Backoff with Jitter                         │ │
│   │                                                                      │ │
│   │  Attempt 1: 1s + jitter(0-30%)  ≈ 1.0-1.3s                         │ │
│   │  Attempt 2: 2s + jitter(0-30%)  ≈ 2.0-2.6s                         │ │
│   │  Attempt 3: 4s + jitter(0-30%)  ≈ 4.0-5.2s                         │ │
│   │  Attempt 4: 8s + jitter(0-30%)  ≈ 8.0-10.4s                        │ │
│   │  ...                                                                 │ │
│   │  Max delay capped at 30 seconds                                     │ │
│   │  Max 10 reconnection attempts                                       │ │
│   └─────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│   Heartbeat Monitoring:                                                    │
│   - Server sends heartbeat every 30 seconds                               │
│   - Client timeout: 45 seconds                                            │
│   - Stale connection detected → force reconnect                           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**File:** `apps/dashboard/src/lib/sync-events.ts`

## Security Considerations

### Defense in Depth

1. **Authentication**: Supabase Auth with JWT tokens
2. **Authorization**: RLS policies on all tables (including `admin_audit_log`)
3. **API Validation**: Workspace middleware on all routes
4. **Credential Isolation**: Per-workspace token storage
5. **Rate Limiting**: Per-workspace, tier-based limits + IP-based for auth endpoints
6. **CSRF Protection**: Cryptographic state tokens for OAuth flows
7. **Circuit Breakers**: Fail-fast on external service outages

### OAuth Security

Google OAuth flow includes multiple security layers:
- **CSRF State Tokens**: 256-bit cryptographic tokens stored in database
- **Token Expiry**: 10-minute window prevents stale attacks
- **One-Time Use**: Tokens consumed on validation (replay attack prevention)
- **Workspace Validation**: Admin/owner role required to connect Drive
- **Cleanup**: Automatic purging of expired tokens

### Rate Limiting

| Endpoint Type | Limit | Purpose |
|--------------|-------|---------|
| Login | 5/min per IP | Brute force prevention |
| Signup | 3/min per IP | Spam account prevention |
| Password Reset | 3/min per IP | Email bombing prevention |
| Invite Accept | 10/min per IP | Token guessing prevention |
| General API | 100/min per workspace | Fair usage |
| Document Sync | 10/min per workspace | Resource protection |

### Database Security

- **RLS on all tables**: Including `admin_audit_log` for audit trail protection
- **SECURITY DEFINER functions**: All use `SET search_path = public, pg_temp` to prevent schema injection
- **Service role isolation**: Backend uses service role for trusted operations only

### Sensitive Data Handling

- OAuth tokens encrypted at rest (Supabase encryption)
- Slack tokens never exposed to frontend
- API keys stored in environment variables only
- No cross-workspace data access possible
- Audit logging for all admin actions

## Infrastructure

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Coolify + Traefik                         │
│                        (SSL Termination, Routing)                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│   Dashboard   │    │   API Server   │    │   Supabase     │
│  (Next.js)    │    │   (Express)    │    │  (PostgreSQL)  │
│   Port 3001   │    │   Port 3000    │    │   Port 8000    │
└───────────────┘    └────────────────┘    └────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌────────────────┐    ┌────────────────┐
│   Slack API   │    │    OpenAI      │    │  Google Drive  │
│  (Per-Bot)    │    │  (Platform)    │    │  (Per-User)    │
└───────────────┘    └────────────────┘    └────────────────┘
```

## Related Documentation

- [DATABASE.md](./DATABASE.md) - Full database schema
- [API.md](./API.md) - API endpoint reference
- [ADMIN.md](./ADMIN.md) - Platform admin documentation
- [DASHBOARD.md](./DASHBOARD.md) - User dashboard guide
