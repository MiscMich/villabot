# Cluebase AI - Platform Admin Guide

Guide for platform administrators managing the Cluebase AI SaaS platform.

## Accessing Admin Panel

1. Navigate to `/admin` in the dashboard
2. You must have `is_platform_admin = true` on your user profile
3. Admin routes are protected by role-based access control

## Admin Dashboard Overview

### Platform Statistics

The admin overview (`/admin`) displays:

- **Total Workspaces**: All registered workspaces
- **Total Users**: Platform-wide user count
- **Estimated MRR**: Monthly recurring revenue from subscriptions
- **Active Bots**: Currently running Slack bots

### Tier Breakdown

Visual breakdown of workspaces by subscription tier:
- Starter (blue)
- Pro (purple)
- Business (gold)

### Growth Chart

30-day trend showing:
- New workspace signups
- User growth
- Query volume

## Managing Workspaces

### Workspace List (`/admin/workspaces`)

**Filters:**
- Search by name or slug
- Filter by tier (Starter/Pro/Business)
- Filter by status (Active/Suspended)
- Filter internal workspaces

**Actions:**
- View workspace details
- Edit workspace settings
- Create internal workspace

### Workspace Details (`/admin/workspaces/[id]`)

**Statistics:**
- Team member count
- Document count
- Bot count
- Monthly query usage

**Management:**
- Edit workspace name/slug
- Change subscription tier
- View team members
- View bots

## Internal Workspaces

Internal workspaces are for:
- Testing and development
- Demo accounts
- Internal team use
- Partner accounts

### Creating Internal Workspace

1. Go to `/admin/workspaces`
2. Click "Create Internal Workspace"
3. Fill in:
   - Workspace name
   - Admin email (creates user if needed)
   - Internal notes (for tracking purpose)

### Internal Workspace Features

- **No billing required**: Bypasses Stripe
- **Unlimited limits**: No restrictions on documents, queries, etc.
- **No rate limits**: API rate limiting disabled
- **Marked clearly**: Purple "Internal" badge in admin panel

## User Management

### Platform Admin Access

To grant platform admin access:

```sql
UPDATE user_profiles
SET is_platform_admin = true
WHERE email = 'admin@yourcompany.com';
```

### Viewing Users

The admin panel shows all users with:
- Email
- Workspaces they belong to
- Role in each workspace
- Account status

## Monitoring

### Health Checks

- **Bot Health**: Each bot reports health status
- **API Health**: `/health` endpoint
- **Database**: Connection pool monitoring

### Error Tracking

The platform logs errors with:
- Timestamp
- Workspace context
- Stack trace
- Request details

## Rate Limiting

### Tier-Based Limits

| Tier | Requests/min | Queries/month |
|------|--------------|---------------|
| Starter | 60 | 500 |
| Pro | 120 | 2,000 |
| Business | 300 | 10,000 |
| Internal | Unlimited | Unlimited |

### Monitoring Usage

Track usage through:
- Analytics dashboard
- Database queries on `analytics` table
- Stripe usage records

## Billing Administration

### Stripe Dashboard

Access Stripe for:
- Subscription management
- Payment history
- Invoice generation
- Refund processing

### Handling Issues

**Failed Payments:**
1. Stripe sends webhook
2. Workspace marked as `past_due`
3. Grace period before suspension

**Subscription Changes:**
1. User initiates via billing portal
2. Stripe processes change
3. Webhook updates database

## Security

### Access Control

- All admin routes require `is_platform_admin`
- API validates admin status on each request
- Audit log tracks admin actions

### Audit Log

Admin actions are logged:
```sql
SELECT * FROM admin_audit_log
ORDER BY created_at DESC
LIMIT 100;
```

### Data Access

Platform admins can:
- View workspace statistics
- Edit workspace configuration
- Create internal workspaces

Platform admins cannot:
- View document content
- Access Slack messages
- Read user passwords (hashed)

## Troubleshooting

### Bot Not Connecting

1. Check Slack tokens are valid
2. Verify Socket Mode is enabled
3. Check bot health status in admin
4. Review error logs

### Workspace Can't Upload Documents

1. Check Google OAuth token expiry
2. Verify Drive folder permissions
3. Check document limits for tier
4. Review sync error in documents table

### Billing Issues

1. Check Stripe dashboard for details
2. Verify webhook is receiving events
3. Check subscription status in database
4. Review Stripe logs

## Database Queries

### Active Workspaces

```sql
SELECT w.name, w.tier,
       COUNT(DISTINCT wm.user_id) as members,
       COUNT(DISTINCT d.id) as documents
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
LEFT JOIN documents d ON w.id = d.workspace_id
WHERE w.subscription_status = 'active'
GROUP BY w.id
ORDER BY members DESC;
```

### Monthly Usage by Tier

```sql
SELECT w.tier,
       COUNT(DISTINCT w.id) as workspaces,
       COUNT(a.id) as total_queries
FROM workspaces w
LEFT JOIN analytics a ON w.id = a.workspace_id
  AND a.event_type = 'query'
  AND a.created_at > NOW() - INTERVAL '30 days'
GROUP BY w.tier;
```

### Error Rate by Bot

```sql
SELECT b.name,
       COUNT(*) FILTER (WHERE f.is_helpful = false) as unhelpful,
       COUNT(*) as total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE f.is_helpful) / NULLIF(COUNT(*), 0), 1) as satisfaction
FROM bots b
LEFT JOIN response_feedback f ON b.id = f.bot_id
WHERE f.created_at > NOW() - INTERVAL '7 days'
GROUP BY b.id
ORDER BY satisfaction;
```

## Support Escalation

For issues beyond admin panel capabilities:

1. Check application logs
2. Query database directly
3. Review Stripe/Supabase dashboards
4. Contact development team
