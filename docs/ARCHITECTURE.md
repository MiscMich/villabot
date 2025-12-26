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

-- Google Drive tokens (stored in bot_config JSONB column)
bot_config.google_drive_tokens
-- Contains: access_token, refresh_token, expiry_date
```

**Note**: Google Drive OAuth tokens are stored per-bot in `bot_config.google_drive_tokens` (JSONB), not at the workspace level. This allows different bots to connect to different Google accounts if needed.

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

## Security Considerations

### Defense in Depth

1. **Authentication**: Supabase Auth with JWT tokens
2. **Authorization**: RLS policies on all tables
3. **API Validation**: Workspace middleware on all routes
4. **Credential Isolation**: Per-workspace token storage
5. **Rate Limiting**: Per-workspace, tier-based limits

### Sensitive Data Handling

- OAuth tokens encrypted at rest (Supabase encryption)
- Slack tokens never exposed to frontend
- API keys stored in environment variables only
- No cross-workspace data access possible

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
