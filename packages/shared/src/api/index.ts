/**
 * API Zod Schemas
 * Central export for all API contract schemas
 *
 * Usage:
 * - Import schemas for request/response validation
 * - Use z.infer<typeof Schema> for TypeScript types
 * - Schemas work on both frontend (type inference) and backend (validation)
 */

// Re-export zod for convenience
export { z } from 'zod';

// Client utilities for type-safe API calls
export * from './client.js';

// Type-safe API contracts (tRPC-like pattern)
export * from './contracts.js';
export * from './typed-client.js';

// Common schemas and enums
export * from './common.js';

// Domain-specific schemas
export * from './admin.js';
export * from './analytics.js';
export * from './auth.js';
export * from './bots.js';
export * from './conversations.js';
export * from './documents.js';
export * from './feedback.js';
export * from './platform-feedback.js';
export * from './workspaces.js';
