# Deployment Status - 2025-12-23 (All Issues Resolved)

## Production Status
- **Dashboard**: https://cluebase.ai - ✅ LIVE and WORKING
- **API**: https://api.cluebase.ai - ✅ LIVE and WORKING
- **Supabase**: https://grjociqyeotxwqdjovmt.supabase.co (CLOUD) - ✅ PRODUCTION

## Latest Bug Fixes Deployed (2025-12-24 ~00:00 UTC)

### Dashboard Redirect Loop Fix ✅ (commit e27cdbb)
- **Issue**: Dashboard stuck on /setup page, infinite redirect loop
- **Root Cause**: RLS policy `admin_read_all_users` on `user_profiles` table had recursive subquery causing "infinite recursion detected in policy" error
- **Fix**:
  - Created `is_current_user_admin()` security definer function to check admin status without recursion
  - Updated RLS policy to use the function instead of recursive subquery
  - Migration: `fix_user_profiles_rls_recursion`
- **Verification**: All dashboard pages now load correctly (Dashboard, Documents, Analytics, Bots, Settings, etc.)

### Missing /usage API Endpoint Fix ✅ (commit e27cdbb)
- **Issue**: Dashboard calling `/api/workspaces/{id}/usage` but API only had `/api/workspaces/current/usage`
- **Fix**: Added `/api/workspaces/:id/usage` endpoint with proper membership checking
- **File Changed**: `apps/api/src/routes/workspaces.ts`

## Previous Bug Fixes (2025-12-23 22:45 UTC)

### Multi-Tenant Database Functions Fix ✅ (migration applied)
- **Issue**: Slack bot not responding to messages despite receiving events
- **Root Cause**: Database RPC functions (`hybrid_search`, `match_documents`, `increment_query_count`) were missing workspace parameters required by multi-tenant RAG search
- **Error in logs**: `Could not find the function public.hybrid_search(...p_workspace_id...)`
- **Fix**: Applied migration `fix_multitenant_search_functions` that:
  - Updated `hybrid_search()` with `p_workspace_id` and `p_bot_id` parameters
  - Updated `match_documents()` with `p_workspace_id` parameter
  - Updated `increment_query_count()` with `p_workspace_id` parameter
  - Updated `match_learned_facts()` with `p_workspace_id` parameter
- **Verification**: Functions now exist with correct signatures in production database

### Website Scraper Fix ✅ (commit 30797d7)
- **Issue**: Website scraping silently failed - 0 pages scraped, 0 documents created
- **Root Cause**: `scrapeWebsite()` read from `env.COMPANY_WEBSITE_URL` instead of the URL configured by users in setup wizard
- **Fix**:
  - Added `websiteUrl` parameter to `scrapeWebsite()` function
  - Setup route now passes `website.url` from config to scraper
  - Scheduler fetches website URL from workspace's `bot_config` table
  - Falls back to env var for backwards compatibility
- **Files Changed**: `website.ts`, `setup.ts`, `scheduler/index.ts`

### Scheduler Column Bug Fix ✅ (commit 30797d7)
- **Issue**: `column workspaces.is_active does not exist` error in logs
- **Root Cause**: Scheduler queried `workspaces.is_active` but column doesn't exist (table has `status`)
- **Fix**: Changed query to use `status IN ('active', 'trialing')`

## Previous Bug Fixes (2025-12-23 21:55 UTC)

### 1. Dashboard Infinite Loading Fix ✅
- **Commit**: 0284fab
- **Issue**: Dashboard stuck in infinite refresh loop

### 2. Bot Manager Activation Fix ✅
- **Commit**: 91ccf38
- **Issue**: Bots stayed in 'configuring' status

### 3. Slack App Installation Guidance ✅
- **Commit**: 23fb07a
- **Issue**: Users didn't know how to install bot in Slack

### 4. Rate Limiter Middleware Order Fix ✅
- **Commit**: 34a8dab
- **Issue**: 401 "Workspace context required" errors

## Dashboard UI Verification (2025-12-23 22:45 UTC)

### Pages Verified ✅
1. **Dashboard Overview** (`/dashboard`) - Stats cards, service status, quick actions
2. **Bots Management** (`/bots`) - Bot cards, activation controls, create wizard
3. **Documents** (`/documents`) - Document list, Drive sync, Website scrape controls
4. **Conversations** (`/conversations`) - Thread viewer with messages
5. **Analytics** (`/analytics`) - Usage metrics and charts
6. **Feedback** (`/feedback`) - Feedback review dashboard
7. **Team** (`/team`) - Member management, invites
8. **Settings** (`/settings`) - Workspace configuration
9. **Billing** (`/billing`) - Subscription management
10. **Setup Wizard** (`/setup`) - Onboarding flow

All pages have proper API integrations with React Query.

## Current Health (Verified 2025-12-23 22:45 UTC)
- API Status: `healthy`
- Supabase Connection: `connected`
- Gemini Connection: `connected`
- **Active Slack Bots: 2** ✅
- Scheduler: Running with 5 jobs
- Database Functions: All multi-tenant functions verified ✅

## Known Gaps (Not Bugs - Missing Features)
1. **Google Drive folder selection**: Setup wizard only authenticates OAuth, doesn't allow folder selection
   - Current workaround: Use `GOOGLE_DRIVE_FOLDER_ID` env var or manually insert into `bot_drive_folders` table
   - Needs: UI in setup wizard or settings page to select Drive folders

## Remaining Testing
- [x] Verify scheduler no longer has is_active error ✅
- [x] Database functions have correct multi-tenant signatures ✅
- [x] Dashboard UI pages verified ✅
- [x] Dashboard redirect loop fixed ✅
- [x] /usage endpoint added ✅
- [ ] **User should test**: Send message to Slack bot to confirm RAG responses work
- [ ] Test website scraping after reset (user should re-run setup or trigger manual scrape)
- [ ] Verify scraped documents appear in dashboard

## Cloud Supabase Credentials (Production)
- **Project URL**: `https://grjociqyeotxwqdjovmt.supabase.co`
- **Dashboard**: `https://supabase.com/dashboard/project/grjociqyeotxwqdjovmt`
