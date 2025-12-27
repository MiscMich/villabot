// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a page is visited.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://e385bffce476deb6d0eb67c1235b02db@o4510196542275584.ingest.us.sentry.io/4510607800729600',

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Enable logging integration
  enableLogs: true,

  // Integrations
  integrations: [
    // Capture console errors/warnings as Sentry logs
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
    // Replay sessions for debugging
    Sentry.replayIntegration({
      // Capture 10% of all sessions in production
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Capture 10% of sessions for replay
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Capture 100% of sessions with errors for replay
  replaysOnErrorSampleRate: 1.0,

  // Filter out known non-critical errors
  ignoreErrors: [
    // Network errors that are expected
    'NetworkError',
    'ChunkLoadError',
    // User-caused validation errors
    'ValidationError',
    // Auth redirects
    'NEXT_REDIRECT',
  ],

  // Add environment context
  environment: process.env.NODE_ENV,
});
