/**
 * Middleware Exports
 * Central export for all authentication and authorization middleware
 */

// Authentication
export { authenticate, optionalAuth, requireRole } from './auth.js';

// Workspace resolution
export {
  resolveWorkspace,
  requireWorkspaceAdmin,
  requireWorkspaceOwner,
  getWorkspaceId,
  hasWorkspaceRole,
} from './workspace.js';

// Subscription and usage
export {
  checkSubscription,
  checkUsageLimit,
  trackUsage,
  requireFeature,
  getUsageSummary,
} from './subscription.js';

// Rate limiting
export {
  generalApiRateLimiter,
  documentSyncRateLimiter,
  inviteAcceptRateLimiter,
  isPlatformAdmin,
} from './rateLimit.js';

// Request validation
export { validateBody, validateQuery, validateParams } from './validation.js';
