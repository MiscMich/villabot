/**
 * Auth API Zod schemas
 * Covers Google OAuth and setup
 */

import { z } from 'zod';
import { NullableTimestampSchema } from './common.js';

// ============================================================================
// Auth Status Schemas
// ============================================================================

/** Auth status response */
export const AuthStatusResponseSchema = z.object({
  google: z.object({
    connected: z.boolean(),
    connectedAt: NullableTimestampSchema,
  }),
});

/** Google auth URL response */
export const GoogleAuthUrlResponseSchema = z.object({
  authUrl: z.string(),
});

// ============================================================================
// Google Drive Schemas
// ============================================================================

/** Drive status response */
export const DriveStatusResponseSchema = z.object({
  connected: z.boolean(),
  connectedAt: NullableTimestampSchema,
  legacy: z.boolean().optional(),
});

/** Drive folder schema */
export const DriveFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  modifiedTime: z.string(),
  parentId: z.string().optional(),
});

/** Drive folders response */
export const DriveFoldersResponseSchema = z.object({
  folders: z.array(DriveFolderSchema),
  nextPageToken: z.string().optional(),
});

// ============================================================================
// Setup Schemas
// ============================================================================

/** Setup status response */
export const SetupStatusResponseSchema = z.object({
  completed: z.boolean(),
  completedAt: NullableTimestampSchema,
  steps: z.object({
    workspace: z.boolean(),
    slack: z.boolean(),
    googleDrive: z.boolean(),
    bot: z.boolean(),
  }),
});

/** Test database request */
export const TestDatabaseRequestSchema = z.object({
  url: z.string().url(),
  serviceKey: z.string(),
});

/** Test database response */
export const TestDatabaseResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

/** Test AI request */
export const TestAIRequestSchema = z.object({
  openaiKey: z.string(),
});

/** Test AI response */
export const TestAIResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

/** Test Slack request */
export const TestSlackRequestSchema = z.object({
  botToken: z.string(),
  appToken: z.string(),
});

/** Test Slack response */
export const TestSlackResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  workspace: z.string().optional(),
  botUser: z.string().optional(),
  error: z.string().optional(),
});

/** Complete setup request */
export const CompleteSetupRequestSchema = z.object({
  config: z.object({
    database: z.object({
      url: z.string(),
      serviceKey: z.string(),
    }),
    ai: z.object({
      openaiKey: z.string(),
    }),
    slack: z.object({
      botToken: z.string(),
      appToken: z.string(),
      signingSecret: z.string().optional(),
    }),
    googleDrive: z.object({
      authenticated: z.boolean(),
      selectedFolders: z.array(z.string()).optional(),
    }).optional(),
    website: z.object({
      url: z.string(),
      maxPages: z.number().optional(),
    }).optional(),
    bot: z.object({
      name: z.string(),
      slug: z.string(),
      personality: z.string().optional(),
      instructions: z.string().optional(),
    }),
    workspaceId: z.string().uuid(),
  }),
});

/** Complete setup response */
export const CompleteSetupResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  bot: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type AuthStatusResponse = z.infer<typeof AuthStatusResponseSchema>;
export type GoogleAuthUrlResponse = z.infer<typeof GoogleAuthUrlResponseSchema>;
export type DriveStatusResponse = z.infer<typeof DriveStatusResponseSchema>;
export type DriveFolder = z.infer<typeof DriveFolderSchema>;
export type DriveFoldersResponse = z.infer<typeof DriveFoldersResponseSchema>;
export type SetupStatusResponse = z.infer<typeof SetupStatusResponseSchema>;
export type TestDatabaseRequest = z.infer<typeof TestDatabaseRequestSchema>;
export type TestDatabaseResponse = z.infer<typeof TestDatabaseResponseSchema>;
export type TestAIRequest = z.infer<typeof TestAIRequestSchema>;
export type TestAIResponse = z.infer<typeof TestAIResponseSchema>;
export type TestSlackRequest = z.infer<typeof TestSlackRequestSchema>;
export type TestSlackResponse = z.infer<typeof TestSlackResponseSchema>;
export type CompleteSetupRequest = z.infer<typeof CompleteSetupRequestSchema>;
export type CompleteSetupResponse = z.infer<typeof CompleteSetupResponseSchema>;
