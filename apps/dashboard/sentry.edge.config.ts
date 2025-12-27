// This file configures the initialization of Sentry for edge features (Middleware, Edge API routes).
// The config you add here will be used whenever one of the edge features is loaded.
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

  // Add environment context
  environment: process.env.NODE_ENV,
});
