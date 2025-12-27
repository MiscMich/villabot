import { z } from 'zod';

// Helper to convert empty strings to undefined for optional fields
const emptyToUndefined = z.string().optional().transform(val => val === '' ? undefined : val);

const optionalString = emptyToUndefined;

const optionalUrl = z.preprocess(
  (val) => (val === '' ? undefined : val),
  z.string().url().optional()
);

const optionalStartsWith = (prefix: string) =>
  z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().startsWith(prefix).optional()
  );

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Google (optional - Drive sync won't work without these)
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:3000/auth/google/callback'),
  GOOGLE_DRIVE_FOLDER_ID: optionalString,

  // AI - OpenAI GPT-5-Nano (required for embeddings and response generation)
  OPENAI_API_KEY: z.string().startsWith('sk-').min(1),

  // Slack (optional - bot won't start without these)
  SLACK_BOT_TOKEN: optionalStartsWith('xoxb-'),
  SLACK_SIGNING_SECRET: optionalString,
  SLACK_APP_TOKEN: optionalStartsWith('xapp-'),

  // Stripe (optional for billing - empty string means disabled)
  STRIPE_SECRET_KEY: optionalStartsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: optionalStartsWith('whsec_'),
  STRIPE_STARTER_PRICE_ID: optionalStartsWith('price_'),
  STRIPE_PRO_PRICE_ID: optionalStartsWith('price_'),
  STRIPE_BUSINESS_PRICE_ID: optionalStartsWith('price_'),

  // App URLs - handle empty DOMAIN gracefully
  APP_URL: z.string().transform(val => val === '' || val === 'https://' ? 'http://localhost:3001' : val).pipe(z.string().url()),
  API_URL: z.string().transform(val => val === '' || val === 'https://api.' ? 'http://localhost:3000' : val).pipe(z.string().url()),

  // Redis (optional - falls back to in-memory rate limiting)
  REDIS_URL: optionalUrl,

  // Optional
  COMPANY_WEBSITE_URL: optionalUrl,
  DRIVE_POLL_INTERVAL_MS: z.string().transform(Number).default('300000'),
  SCRAPE_SCHEDULE: z.string().default('0 3 * * *'), // Cron: daily at 3 AM (sitemap-based detection makes this efficient)
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Sentry Error Tracking (optional - error tracking disabled without DSN)
  SENTRY_DSN: optionalUrl,
  APP_VERSION: optionalString,

  // Critical Error Alerts (optional - Slack webhook for critical errors)
  ALERT_SLACK_WEBHOOK_URL: optionalUrl,
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
