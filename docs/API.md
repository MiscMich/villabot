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
    "supabase": true,
    "slack": true,
    "openai": true,
    "googleDrive": true
  }
}
```

Possible status values: `healthy`, `degraded`, `unhealthy`

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

### GET /setup/status

Get the current onboarding status for a workspace.

### POST /setup/slack

Configure Slack credentials during setup.

### POST /setup/drive

Connect Google Drive during setup.

### POST /setup/complete

Mark onboarding as complete.

---

## Google Drive

### GET /drive/status

Get Google Drive connection status.

### POST /drive/auth

Initiate Google Drive OAuth flow.

### GET /drive/callback

OAuth callback handler.

### POST /drive/sync

Trigger manual Drive sync.

### DELETE /drive/disconnect

Disconnect Google Drive.

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
