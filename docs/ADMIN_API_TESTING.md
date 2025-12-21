# Platform Admin API - Testing Guide

## Prerequisites

1. Create a platform admin user in the database:
```sql
UPDATE user_profiles 
SET is_platform_admin = TRUE 
WHERE email = 'your-admin@example.com';
```

2. Get an authentication token:
```bash
# Login to get JWT token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "your-admin@example.com", "password": "yourpassword"}'
```

Export the token for convenience:
```bash
export TOKEN="your-jwt-token-here"
```

## API Endpoints

### 1. Get Platform Statistics

```bash
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "totalWorkspaces": 10,
  "payingWorkspaces": 8,
  "internalWorkspaces": 2,
  "activeWorkspaces": 9,
  "trialingWorkspaces": 1,
  "totalUsers": 25,
  "adminUsers": 2,
  "starterWorkspaces": 3,
  "proWorkspaces": 4,
  "businessWorkspaces": 1,
  "estimatedMrr": 500,
  "totalDocuments": 150,
  "totalConversations": 300,
  "totalBots": 12,
  "newWorkspaces30d": 3,
  "newWorkspaces7d": 1
}
```

### 2. List Workspaces (with filters)

```bash
# List all workspaces
curl "http://localhost:3000/api/admin/workspaces" \
  -H "Authorization: Bearer $TOKEN"

# Filter by tier and status
curl "http://localhost:3000/api/admin/workspaces?tier=pro&status=active" \
  -H "Authorization: Bearer $TOKEN"

# Search by name/email
curl "http://localhost:3000/api/admin/workspaces?search=acme" \
  -H "Authorization: Bearer $TOKEN"

# Only internal workspaces
curl "http://localhost:3000/api/admin/workspaces?isInternal=true" \
  -H "Authorization: Bearer $TOKEN"

# With pagination
curl "http://localhost:3000/api/admin/workspaces?page=2&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Sort by queries
curl "http://localhost:3000/api/admin/workspaces?sortBy=queries_this_month&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Get Workspace Details

```bash
curl "http://localhost:3000/api/admin/workspaces/{workspace-id}" \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "tier": "pro",
  "status": "active",
  "isInternal": false,
  "ownerId": "uuid",
  "ownerEmail": "owner@acme.com",
  "ownerName": "John Doe",
  "memberCount": 5,
  "documentCount": 25,
  "botCount": 2,
  "conversationCount": 50,
  "queriesThisMonth": 150,
  "lastActivity": "2025-01-15T10:30:00Z",
  "createdAt": "2024-12-01T00:00:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

### 4. Create Internal Workspace

```bash
curl -X POST http://localhost:3000/api/admin/workspaces/internal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Workspace",
    "ownerEmail": "test@example.com",
    "notes": "Internal testing workspace"
  }'
```

Expected response:
```json
{
  "id": "new-workspace-uuid",
  "message": "Internal workspace created successfully"
}
```

### 5. Update Workspace

```bash
# Change tier
curl -X PATCH "http://localhost:3000/api/admin/workspaces/{workspace-id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "business"}'

# Change status
curl -X PATCH "http://localhost:3000/api/admin/workspaces/{workspace-id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'

# Mark as internal
curl -X PATCH "http://localhost:3000/api/admin/workspaces/{workspace-id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isInternal": true, "notes": "Converted to internal account"}'
```

### 6. List Users

```bash
# All users
curl "http://localhost:3000/api/admin/users" \
  -H "Authorization: Bearer $TOKEN"

# Search by email/name
curl "http://localhost:3000/api/admin/users?search=john" \
  -H "Authorization: Bearer $TOKEN"

# Only platform admins
curl "http://localhost:3000/api/admin/users?isAdmin=true" \
  -H "Authorization: Bearer $TOKEN"

# With pagination
curl "http://localhost:3000/api/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### 7. Toggle Platform Admin Status

```bash
# Grant admin access
curl -X POST "http://localhost:3000/api/admin/users/{user-id}/admin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isAdmin": true}'

# Revoke admin access
curl -X POST "http://localhost:3000/api/admin/users/{user-id}/admin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isAdmin": false}'
```

Expected response:
```json
{
  "message": "User granted platform admin access"
}
```

### 8. Get Audit Log

```bash
# All audit entries
curl "http://localhost:3000/api/admin/audit-log" \
  -H "Authorization: Bearer $TOKEN"

# Filter by action
curl "http://localhost:3000/api/admin/audit-log?action=create_internal_workspace" \
  -H "Authorization: Bearer $TOKEN"

# Filter by target type
curl "http://localhost:3000/api/admin/audit-log?targetType=workspace" \
  -H "Authorization: Bearer $TOKEN"

# Filter by admin
curl "http://localhost:3000/api/admin/audit-log?adminId={admin-user-id}" \
  -H "Authorization: Bearer $TOKEN"

# With pagination
curl "http://localhost:3000/api/admin/audit-log?page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "data": [
    {
      "id": "uuid",
      "adminId": "admin-uuid",
      "adminEmail": "admin@example.com",
      "action": "create_internal_workspace",
      "targetType": "workspace",
      "targetId": "workspace-uuid",
      "details": {
        "name": "Test Workspace",
        "ownerEmail": "test@example.com"
      },
      "ipAddress": "192.168.1.1",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 50,
  "totalPages": 2
}
```

## Error Cases

### 1. Non-admin user attempts access

```bash
# Should return 403 Forbidden
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer $NON_ADMIN_TOKEN"
```

Response:
```json
{
  "error": "Platform admin access required",
  "code": "ADMIN_REQUIRED"
}
```

### 2. Unauthenticated request

```bash
# Should return 401 Unauthorized
curl http://localhost:3000/api/admin/stats
```

Response:
```json
{
  "error": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

### 3. Admin tries to remove own admin status

```bash
# Should return 400 Bad Request
curl -X POST "http://localhost:3000/api/admin/users/{your-own-id}/admin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isAdmin": false}'
```

Response:
```json
{
  "error": "Cannot remove your own admin status",
  "code": "SELF_DEMOTION"
}
```

## Testing Checklist

- [ ] Platform stats returns correct aggregated data
- [ ] Workspace listing with no filters returns all workspaces
- [ ] Workspace search filter works (name, email, slug)
- [ ] Workspace tier filter works
- [ ] Workspace status filter works
- [ ] Workspace isInternal filter works
- [ ] Workspace sorting works (all fields)
- [ ] Workspace pagination works correctly
- [ ] Workspace details returns complete information
- [ ] Internal workspace creation works
- [ ] Internal workspace has unlimited limits in database
- [ ] Workspace update changes tier correctly
- [ ] Workspace update changes status correctly
- [ ] Workspace update changes isInternal flag
- [ ] User listing with no filters returns all users
- [ ] User search filter works
- [ ] User isAdmin filter works
- [ ] User pagination works correctly
- [ ] Grant admin status works
- [ ] Revoke admin status works
- [ ] Self-demotion is prevented
- [ ] Audit log records all admin actions
- [ ] Audit log includes admin email
- [ ] Audit log includes IP address
- [ ] Audit log filters work (action, targetType, adminId)
- [ ] Non-admin users receive 403 on all routes
- [ ] Unauthenticated requests receive 401 on all routes
- [ ] All actions appear in audit log with correct details
