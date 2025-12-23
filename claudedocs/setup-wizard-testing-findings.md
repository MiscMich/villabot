# Setup Wizard Testing Findings

**Date**: 2025-12-23
**Environment**: Production (cluebase.ai)
**Coolify Deployment**: Commit `79f18a3` (with fixes)

## Testing Summary

### Post-Fix Verification (2025-12-23)

Tested the complete setup wizard flow on production after deploying fixes:

| Step | Name | Status | Notes |
|------|------|--------|-------|
| 1 | Welcome | ✅ Passed | Get Started button works |
| 2 | Workspace | ✅ Passed | Name/slug auto-generation works |
| 3 | Slack | ✅ Passed | Connection test successful with real credentials |
| 4 | Google Drive | ✅ **Fixed** | **Skip now works!** Continue button enabled without auth |
| 5 | Knowledge Sources | ✅ Passed | Optional step, can skip |
| 6 | Bot Configuration | ✅ Passed | Pre-filled defaults work |
| 7 | Review/Launch | ✅ Passed | Shows summary correctly, Google Drive shows "Not configured" |

### Bug Fix Verification

**Bug 1 (Google Drive Not Skippable)**: ✅ **FIXED**
- Continue button is now purple/active on Google Drive step
- Successfully advances to Step 5 without connecting to Google

**Bug 2 (OAuth Redirect Resets State)**: ⏳ Not tested in this session
- Requires actual Google OAuth flow to verify

## Bugs Found & Fixed

### Bug 1: Google Drive Step Not Skippable

**Location**: `apps/dashboard/src/app/setup/page.tsx:1082`

**Symptom**: Continue button was disabled on Google Drive step unless user authenticated with Google, even though Google Drive is optional.

**Root Cause**: The `canProceed()` function returned `config.googleDrive.authenticated` for step 3, requiring authentication.

**Fix Applied**:
```typescript
// Before
case 3:
  return config.googleDrive.authenticated;

// After
case 3:
  return true; // Google Drive is optional - can skip
```

### Bug 2: OAuth Redirect Resets Wizard State

**Locations**:
- `apps/dashboard/src/app/setup/page.tsx` (multiple changes)
- `apps/api/src/routes/auth.ts:32-73`

**Symptom**: Clicking "Connect with Google" redirected to OAuth, but when returning, the entire wizard was reset to step 1 with all form data lost.

**Root Cause**:
1. OAuth uses `window.location.href` redirect which unmounts the React component
2. React state is lost on component unmount
3. OAuth callback always redirected to `/settings?google_connected=true` instead of back to setup wizard
4. No state persistence mechanism before/after OAuth redirect

**Fixes Applied**:

1. **Backend - Updated OAuth callback** (`apps/api/src/routes/auth.ts`):
   - Check for `state=setup` query parameter from OAuth
   - Redirect to `/setup?google_auth=success` when coming from setup wizard
   - Redirect to `/setup?google_auth=error` on failure from setup wizard
   - Keep existing `/settings` redirect for non-setup flows

2. **Frontend - Save state before OAuth** (`GoogleDriveStep` component):
   - Accept `fullConfig` and `currentStep` props
   - Save complete wizard config to `sessionStorage.setup_wizard_config`
   - Save current step to `sessionStorage.setup_wizard_step`
   - Then redirect to OAuth

3. **Frontend - Restore state after OAuth** (`SetupWizard` component):
   - Added `useSearchParams` to detect OAuth callback
   - Added `useEffect` to check for `google_auth` param on mount
   - Restore config from sessionStorage if returning from OAuth
   - Update `googleDrive.authenticated` based on OAuth result
   - Clean up sessionStorage and URL after restore

## Files Changed

1. `apps/dashboard/src/app/setup/page.tsx`:
   - Added `useEffect`, `useSearchParams` imports
   - Added `searchParams` hook usage
   - Added useEffect for OAuth state restoration
   - Updated `GoogleDriveStep` props to accept `fullConfig`, `currentStep`
   - Updated `handleConnect` to save state before redirect
   - Updated component usage to pass new props
   - Fixed `canProceed()` for Google Drive step

2. `apps/api/src/routes/auth.ts`:
   - Updated `/google/callback` to check `state` parameter
   - Conditional redirect based on state (setup vs settings)
   - Error handling with appropriate redirects

## Deployment Notes

These changes need to be:
1. Committed to git
2. Pushed to `main` branch
3. Coolify will auto-deploy (webhook trigger)

After deployment, verify:
- Google Drive step can be skipped
- OAuth flow preserves wizard state
- Workspace name, Slack credentials retained after Google auth

## Related Components

- `apps/api/src/routes/setup.ts` - Adds `&state=setup` to OAuth URL (already working)
- Session storage keys: `setup_wizard_config`, `setup_wizard_step`, `setup_pending_google_auth`

## Conclusion

**All 7 wizard steps tested successfully on production (cluebase.ai).**

The critical fix (Google Drive skip) is verified working:
- Continue button is enabled without Google authentication
- Wizard correctly shows Google Drive as "Not configured" on review screen
- Full wizard flow completes without requiring any optional integrations

## Testing Credentials Used

Slack app credentials were tested successfully:
- Bot Token: `xoxb-5511936867697-*****` (masked)
- Connection test passed
