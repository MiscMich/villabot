# Cluebase AI - API Reference

Complete API documentation for the Cluebase AI platform.

## Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://api.cluebase.ai/api`

## Authentication

All API endpoints (except auth routes) require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Getting a Token

Tokens are obtained through Supabase Auth. The dashboard handles this automatically.

---

## Health Check

### GET /health

Returns the health status of the API and connected services.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-20T10:00:00Z",
  "uptime": 86400,
  "services": {
    "supabase": "connected",
    "openai": "connected"
  },
  "integrations": {
    "activeSlackBots": 5,
    "workspacesWithGoogleDrive": 3
  },
  "version": "0.1.0"
}
```

Possible status values: `healthy`, `degraded`, `unhealthy`

**Note:** Platform health is based on core services (Supabase, OpenAI). Slack and Google Drive are per-workspace integrations shown for informational purposes only.

### GET /health/ready

Kubernetes readiness probe. Returns 200 when the service is ready to accept traffic.

**Response (200):**
```json
{
  "ready": true
}
```

**Response (503):**
```json
{
  "ready": false,
  "reason": "Database not available"
}
```

### GET /health/live

Kubernetes liveness probe. Returns 200 if the process is alive.

**Response:**
```json
{
  "alive": true
}
```

### GET /health/deep

Comprehensive deep health check. Tests actual functionality of each service.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-12-20T10:00:00Z",
  "totalLatencyMs": 245,
  "uptime": 86400,
  "version": "0.1.0",
  "checks": {
    "database": {
      "status": "pass",
      "latency": 45,
      "details": {
        "documents": 150,
        "chunks": 2340,
        "learnedFacts": 12
      }
    },
    "openai": {
      "status": "pass",
      "latency": 120,
      "details": {
        "embeddingDimensions": 768
      }
    },
    "vectorSearch": {
      "status": "pass",
      "latency": 35,
      "details": {
        "resultsReturned": 1
      }
    },
    "cache": {
      "status": "pass",
      "details": {
        "embedding": { "size": 50, "maxSize": 1000, "hitRate": "0.85" },
        "search": { "size": 25, "maxSize": 500, "hitRate": "0.72" },
        "response": { "size": 10, "maxSize": 200, "hitRate": "0.65" }
      }
    },
    "memory": {
      "status": "pass",
      "details": {
        "heapUsedMB": 128,
        "heapTotalMB": 256,
        "rssMB": 312,
        "heapUsagePercent": 50
      }
    },
    "circuitBreakers": {
      "status": "pass",
      "details": {
        "openai": { "state": "CLOSED", "failureCount": 0, "healthy": true },
        "googleDrive": { "state": "CLOSED", "failureCount": 0, "healthy": true }
      }
    },
    "rateLimiter": {
      "status": "pass",
      "details": {
        "backend": "redis",
        "redisAvailable": true
      }
    }
  }
}
```

**Check status values:** `pass`, `fail`

**Overall status logic:**
- `healthy`: All checks pass
- `degraded`: Non-critical checks failing
- `unhealthy`: Database or OpenAI failing (503 status code)

---

## Workspaces

### GET /workspaces

List all workspaces the authenticated user belongs to.

**Response:**
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "My Team",
      "slug": "my-team",
      "tier": "pro",
      "role": "owner"
    }
  ]
}
```

### POST /workspaces

Create a new workspace.

**Request:**
```json
{
  "name": "My Team",
  "slug": "my-team"
}
```

---

## Documents

### GET /documents

List documents in the workspace.

**Query Parameters:**
- `category` - Filter by category (optional)
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset (default: 0)

### POST /documents/sync

Trigger a manual document sync from Google Drive.

### DELETE /documents/:id

Remove a document from the knowledge base.

---

## Bots

### GET /bots

List all bots in the workspace.

### POST /bots

Create a new bot.

**Request:**
```json
{
  "name": "Support Bot",
  "slackBotToken": "xoxb-...",
  "slackAppToken": "xapp-...",
  "systemPrompt": "You are a helpful support assistant..."
}
```

### PATCH /bots/:id

Update bot configuration.

### DELETE /bots/:id

Delete a bot.

### POST /bots/:id/restart

Restart a bot's Slack connection.

---

## Analytics

### GET /analytics

Get usage analytics for the workspace.

**Query Parameters:**
- `period` - Time period: `day`, `week`, `month` (default: week)

**Response:**
```json
{
  "totalQueries": 1234,
  "successfulResponses": 1180,
  "avgResponseTime": 2.3,
  "topDocuments": [...],
  "dailyUsage": [...]
}
```

---

## Feedback

### GET /feedback

List user feedback on bot responses.

**Query Parameters:**
- `filter` - Filter: `all`, `helpful`, `unhelpful`, `unreviewed`

### PATCH /feedback/:id

Mark feedback as reviewed.

---

## Team

### GET /team

List team members in the workspace.

### POST /team/invite

Invite a new team member.

**Request:**
```json
{
  "email": "user@example.com",
  "role": "member"
}
```

### PATCH /team/:userId

Update member role.

### DELETE /team/:userId

Remove team member.

---

## Billing

### GET /billing

Get current subscription status.

### POST /billing/checkout

Create a Stripe checkout session.

**Request:**
```json
{
  "tier": "pro",
  "billingPeriod": "monthly"
}
```

### POST /billing/portal

Create a Stripe billing portal session.

---

## Admin (Platform Admins Only)

### GET /admin/stats

Get platform-wide statistics.

### GET /admin/workspaces

List all workspaces on the platform.

### POST /admin/workspaces/internal

Create an internal/test workspace (bypasses billing).

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Google Drive Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `DRIVE_NOT_CONNECTED` | 400 | Google Drive not connected to workspace |
| `DRIVE_AUTH_EXPIRED` | 401 | OAuth token expired - user must reconnect |
| `DRIVE_AUTH_INVALID` | 401 | OAuth token revoked/invalid - user must reconnect |
| `DRIVE_PERMISSION_DENIED` | 500 | Folder access denied - check sharing settings |
| `DRIVE_FOLDER_NOT_FOUND` | 500 | Folder was deleted or moved |
| `DRIVE_QUOTA_EXCEEDED` | 500 | Google API quota exceeded - retry later |
| `DRIVE_NETWORK_ERROR` | 500 | Network error connecting to Google |
| `DRIVE_SYNC_FAILED` | 500 | Generic sync failure |

---

## Rate Limits

Rate limits vary by subscription tier:

| Tier | Requests/minute | Queries/month |
|------|-----------------|---------------|
| Starter | 60 | 500 |
| Pro | 120 | 5,000 |
| Business | 300 | 25,000 |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Setup (Onboarding)

Setup endpoints manage workspace onboarding flow. These guide users through configuring Slack bots and Google Drive connections.

### GET /setup/status

Get the current onboarding status for a workspace.

**Query Parameters:**
- `workspaceId` - Optional workspace ID (falls back to authenticated user's workspace)

**Response:**
```json
{
  "completed": false,
  "currentStep": 1,
  "steps": {
    "slackConnected": false,
    "driveConnected": true,
    "botConfigured": false
  }
}
```

### POST /setup/test-slack

Test Slack credentials before committing to setup.

**Request Body:**
```json
{
  "botToken": "xoxb-...",
  "appToken": "xapp-..."
}
```

**Response (success):**
```json
{
  "success": true,
  "teamId": "T01234567",
  "teamName": "My Workspace",
  "botName": "Cluebase Bot"
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Invalid token",
  "code": "INVALID_SLACK_TOKEN"
}
```

**Rate Limit:** 5 requests per 5 minutes per IP

### GET /setup/google-auth-url

Get the OAuth authorization URL for Google Drive connection.

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

The returned URL includes `setup=true` parameter to redirect back to the setup wizard after OAuth.

### POST /setup/complete

Complete the onboarding process and create the workspace configuration.

**Authentication Required:** Yes

**Request Body:**
```json
{
  "botName": "Operations Bot",
  "botType": "operations",
  "slackBotToken": "xoxb-...",
  "slackAppToken": "xapp-...",
  "slackSigningSecret": "optional-signing-secret"
}
```

**Bot Types:** `general`, `operations`, `marketing`, `sales`, `hr`, `technical`

**Response:**
```json
{
  "success": true,
  "workspaceId": "uuid",
  "botId": "uuid",
  "message": "Setup completed successfully"
}
```

**Error Codes:**
- `DUPLICATE_SLACK_TOKEN` - Token already registered to another workspace
- `INVALID_SLACK_TOKEN` - Token format is invalid
- `SETUP_FAILED` - General setup failure

**Rate Limit:** 3 requests per hour per user

### DELETE /setup/reset

Reset workspace setup (development only).

**Authentication Required:** Yes

**Response (403 in production):**
```json
{
  "success": false,
  "error": "Setup reset is disabled in production"
}
```

---

## Google Drive

All Drive endpoints use workspace context from the authenticated user's session.

### GET /drive/status

Get Google Drive connection status for the workspace.

**Response:**
```json
{
  "connected": true,
  "connectedAt": "2024-12-20T10:00:00Z"
}
```

### GET /auth/google

Get the OAuth authorization URL. Redirects user to Google consent screen.

**Query Parameters:**
- `workspaceId` - Associate OAuth tokens with this workspace
- `source` - Origin page: `settings` or `setup` (affects redirect)

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/..."
}
```

### GET /auth/google/callback

OAuth callback handler. Stores tokens with workspace association and redirects to dashboard.

### GET /auth/status

Get Google Drive auth status.

**Query Parameters:**
- `workspaceId` - Check status for specific workspace (optional)

**Response:**
```json
{
  "google": {
    "connected": true,
    "connectedAt": "2024-12-20T10:00:00Z"
  }
}
```

### DELETE /auth/google

Disconnect Google Drive for the workspace.

**Query Parameters:**
- `workspaceId` - Disconnect for specific workspace

### POST /documents/sync/full

Trigger manual Drive sync for the workspace.

**Response:**
```json
{
  "success": true,
  "added": 5,
  "updated": 2,
  "removed": 0,
  "errors": []
}
```

**Error Response (401):**
```json
{
  "error": "Google Drive authorization expired. Please reconnect your Drive.",
  "code": "DRIVE_AUTH_EXPIRED"
}
```

---

## Conversations

### GET /conversations

List Slack conversation threads.

**Query Parameters:**
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset (default: 0)
- `botId` - Filter by bot ID (optional)

### GET /conversations/:sessionId

Get full conversation thread with messages.

---

## Bot Configuration

### GET /config

Get bot configuration (legacy endpoint).

### PATCH /config

Update bot configuration.

---

## Platform Feedback

### GET /platform-feedback

List platform feedback submissions.

### POST /platform-feedback

Submit platform feedback.

### POST /platform-feedback/:id/vote

Vote on feedback item.

---

## Error Logs (Admin)

### GET /errors

List error logs with filtering.

**Query Parameters:**
- `service` - Filter by service: `slack`, `api`, `sync`
- `severity` - Filter by severity: `low`, `medium`, `high`, `critical`
- `limit` - Number of results (default: 100)

### DELETE /errors/cleanup

Delete old error logs (admin only).
