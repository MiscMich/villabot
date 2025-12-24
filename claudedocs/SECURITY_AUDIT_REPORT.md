# Security Audit Report: Cluebase AI Platform

**Audit Date:** 2025-12-24
**Auditor:** Security Assessment
**Scope:** Secrets management, third-party integrations, deployment security

---

## Executive Summary

This security audit identified **5 CRITICAL**, **4 HIGH**, **3 MEDIUM**, and **2 LOW** severity findings across secrets management, third-party integrations, and deployment configurations. The most urgent issue is the exposure of production secrets in version-controlled files.

---

## Findings by Severity

### CRITICAL (Immediate Action Required)

#### 1. Production Secrets Committed to Git Repository
**Severity:** CRITICAL
**Location:** `/.env` (lines 1-75), `/.env.production` (tracked in git)

**Description:**
The `.env` file contains live production secrets including:
- Supabase service role key (JWT with full database access)
- OpenAI API key (sk-proj-...)
- Google OAuth client secret
- Slack bot tokens and signing secrets
- Gemini API key

The `.env.production` file is tracked in git (`git ls-files` confirms this).

**Evidence:**
```
/.env:17: SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...
/.env:35: OPENAI_API_KEY=sk-proj-...
/.env:46-48: Slack credentials (xoxb-, xapp-, signing secret)
```

**Impact:**
- Complete database compromise possible
- Unauthorized API usage and billing
- Slack bot hijacking

**Remediation:**
1. **IMMEDIATELY** rotate ALL exposed credentials
2. Remove `.env` and `.env.production` from git history using `git filter-branch` or BFG Repo-Cleaner
3. Add `.env.production` to `.gitignore`
4. Use secrets management (e.g., HashiCorp Vault, AWS Secrets Manager)

---

#### 2. Service Role Key Logged to Console in E2E Tests
**Severity:** CRITICAL
**Location:** `/apps/dashboard/e2e/setup/global.setup.ts:25`

**Description:**
The Supabase service role key prefix is logged to console during E2E test setup:
```typescript
console.log('[Global Setup] Service key prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 50) + '...');
```

**Impact:**
- Service role key partially exposed in CI/CD logs
- May be captured in test reports or monitoring systems

**Remediation:**
Remove this log statement or redact entirely:
```typescript
console.log('[Global Setup] Service key: [REDACTED]');
```

---

#### 3. Slack Tokens Returned in API Responses
**Severity:** CRITICAL
**Location:** `/apps/api/src/routes/bots.ts` (lines 37, 57, 83, etc.)

**Description:**
The bots API uses `select('*')` which returns all columns including:
- `slack_bot_token`
- `slack_app_token`
- `slack_signing_secret`

These credentials are returned to the frontend in API responses.

**Evidence:**
```typescript
// apps/api/src/routes/bots.ts:37
const { data: bots } = await supabase.from('bots').select('*')
// Response includes slack_bot_token, slack_app_token, slack_signing_secret
```

**Impact:**
- Tokens visible in browser DevTools Network tab
- Tokens may be logged by proxies, WAFs, or monitoring tools
- XSS vulnerability would expose all Slack credentials

**Remediation:**
Use explicit column selection excluding credentials:
```typescript
.select('id, name, slug, description, status, bot_type, personality, system_instructions, created_at, updated_at')
```
Or create a sanitization function to strip credentials before returning.

---

#### 4. CORS Configured with Wildcard Origin
**Severity:** CRITICAL
**Location:** `/apps/api/src/index.ts:38`

**Description:**
CORS is configured with `cors()` without any origin restrictions:
```typescript
app.use(cors());
```

This allows any website to make authenticated requests to the API.

**Impact:**
- Cross-site request forgery (CSRF) attacks possible
- Malicious websites can access authenticated API endpoints
- Token theft if combined with XSS

**Remediation:**
Configure explicit allowed origins:
```typescript
app.use(cors({
  origin: [env.APP_URL],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Workspace-ID']
}));
```

---

#### 5. Error Details Leaked to Client in Setup Endpoint
**Severity:** CRITICAL
**Location:** `/apps/api/src/routes/setup.ts:470-481`

**Description:**
Internal error details are returned to clients including:
- Database error codes
- Stack traces (in error object)
- Internal hint messages

```typescript
const errorDetails = {
  message: error.message,
  code: error?.code,
  details: error?.details,
  hint: error?.hint,
  stack: error?.stack,  // Stack trace included!
};
res.status(500).json({
  error: error.message,
  details: errorDetails.code || errorDetails.details,  // Leaks internal info
});
```

**Impact:**
- Information disclosure aids attackers in targeting vulnerabilities
- Database structure and logic exposed

**Remediation:**
Return generic error messages to clients:
```typescript
logger.error('Setup failed', { error: errorDetails });
res.status(500).json({
  success: false,
  error: 'Setup failed. Please try again.'
});
```

---

### HIGH Severity

#### 6. Potential SSRF in Website Scraper
**Severity:** HIGH
**Location:** `/apps/api/src/services/scraper/website.ts`

**Description:**
The website scraper accepts user-provided URLs (`websiteUrl`) and fetches them without SSRF protection:
- No blocklist for private IP ranges (127.0.0.1, 10.x.x.x, 192.168.x.x, etc.)
- No blocklist for cloud metadata endpoints (169.254.169.254)
- Follows redirects without validation

**Evidence:**
```typescript
// website.ts:56
const websiteUrl = configuredUrl || env.COMPANY_WEBSITE_URL;
// ... later fetches this URL with puppeteer
await page.goto(url, { waitUntil: 'networkidle2' });
```

**Impact:**
- Access to internal network resources
- Cloud metadata endpoint exposure (AWS credentials, etc.)
- Port scanning of internal infrastructure

**Remediation:**
1. Validate URLs against a blocklist before fetching:
```typescript
const BLOCKED_HOSTS = ['127.0.0.1', 'localhost', '169.254.169.254'];
const BLOCKED_NETWORKS = ['10.', '172.16.', '172.17.', '192.168.'];

function isBlockedUrl(url: string): boolean {
  const parsed = new URL(url);
  if (BLOCKED_HOSTS.includes(parsed.hostname)) return true;
  for (const net of BLOCKED_NETWORKS) {
    if (parsed.hostname.startsWith(net)) return true;
  }
  return false;
}
```
2. Disable redirect following or validate redirects

---

#### 7. No Rate Limiting on Webhook Endpoints
**Severity:** HIGH
**Location:** `/apps/api/src/index.ts:88`

**Description:**
Webhook endpoints (`/api/webhooks`) have no rate limiting:
```typescript
// Webhooks - NO rate limiting (external services like Stripe)
app.use('/api/webhooks', webhooksRouter);
```

While webhooks use signature verification, lack of rate limiting enables:
- Denial of service through replay attacks (valid old payloads)
- Resource exhaustion

**Remediation:**
Add basic rate limiting even for webhooks:
```typescript
app.use('/api/webhooks', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // limit each IP to 100 requests per minute
}), webhooksRouter);
```

---

#### 8. Google OAuth Tokens Stored Without Encryption
**Severity:** HIGH
**Location:** `/apps/api/src/routes/auth.ts:14`, `/apps/api/src/routes/drive.ts:19`

**Description:**
Google Drive OAuth refresh tokens are stored in `bot_config` table without encryption:
```typescript
const TOKENS_KEY = 'google_drive_tokens';
// Tokens stored as plain JSON
```

**Impact:**
- Database breach exposes all OAuth tokens
- Tokens can be used to access Google Drive data indefinitely (refresh tokens don't expire)

**Remediation:**
1. Encrypt tokens at rest using AES-256
2. Use a key management service for encryption keys
3. Consider using Google's Token Encryption API

---

#### 9. Slack Signing Secret Not Validated for Socket Mode
**Severity:** HIGH
**Location:** `/apps/api/src/services/slack/instance.ts`

**Description:**
While Socket Mode is used (which is more secure than webhooks), the signing secret is collected but not actively used for validation in the current implementation. If the app is switched to webhook mode, requests would not be verified.

Additionally, the Bolt SDK is configured without explicitly enabling request verification:
```typescript
this.app = new App({
  token: bot.slackBotToken,
  appToken: bot.slackAppToken,
  socketMode: true,
  // No signingSecret configured for Bolt
});
```

**Remediation:**
Configure signing secret in Bolt app for defense in depth:
```typescript
this.app = new App({
  token: bot.slackBotToken,
  appToken: bot.slackAppToken,
  signingSecret: bot.slackSigningSecret, // Add this
  socketMode: true,
});
```

---

### MEDIUM Severity

#### 10. Puppeteer Running with Sandbox Disabled
**Severity:** MEDIUM
**Location:** `/apps/api/src/services/scraper/website.ts:128-130`

**Description:**
Puppeteer is launched with sandbox disabled:
```typescript
browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
```

**Impact:**
- If malicious JavaScript on scraped page exploits browser vulnerability, attacker gains container access
- Reduced defense in depth

**Remediation:**
In production, configure proper sandboxing or run in a more isolated environment (e.g., separate container with minimal privileges).

---

#### 11. Broad SELECT Statements May Expose Sensitive Fields
**Severity:** MEDIUM
**Location:** Multiple routes using `select('*')`

**Description:**
Many API routes use `select('*')` which returns all database columns. This is fragile as new sensitive columns added to tables would automatically be exposed.

**Evidence:**
Files with `select('*')`:
- `bots.ts` (7 instances)
- `billing.ts` (6 instances)
- `users-auth.ts` (3 instances)
- `workspaces.ts` (3 instances)
- And 15+ more

**Remediation:**
Use explicit column selection in all queries. Create TypeScript interfaces that define exactly which fields should be returned.

---

#### 12. Session/Token Expiry Not Enforced for Slack Bots
**Severity:** MEDIUM
**Location:** `/apps/api/src/services/slack/manager.ts`

**Description:**
Slack bot tokens stored in database have no expiry tracking. If a token is compromised, there's no automatic rotation or invalidation mechanism.

**Remediation:**
1. Track token creation dates
2. Implement token rotation reminders
3. Add ability to force token rotation from admin panel

---

### LOW Severity

#### 13. Verbose Error Logging May Capture Sensitive Data
**Severity:** LOW
**Location:** Multiple files

**Description:**
Error logging includes full error objects which may contain sensitive data in error contexts:
```typescript
logger.error('Failed to start bot', { error });
```

If `error` contains user data or tokens, they may be logged.

**Remediation:**
Sanitize error objects before logging:
```typescript
logger.error('Failed to start bot', {
  message: error.message,
  code: error.code
});
```

---

#### 14. No Security Headers Configured
**Severity:** LOW
**Location:** `/apps/api/src/index.ts`

**Description:**
The Express app doesn't set security headers:
- No `X-Content-Type-Options`
- No `X-Frame-Options`
- No `Strict-Transport-Security`
- No `Content-Security-Policy`

**Remediation:**
Add helmet middleware:
```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

## Positive Security Findings

The following security measures are correctly implemented:

1. **Stripe Webhook Signature Verification** (`/apps/api/src/routes/webhooks.ts:69-80`)
   - Uses `stripe.webhooks.constructEvent()` with proper signature verification
   - Raw body preserved for signature calculation

2. **Docker Security Best Practices** (`/apps/api/Dockerfile`, `/apps/dashboard/Dockerfile`)
   - Non-root user created and used (`cluebase` / `nextjs`)
   - Multi-stage builds prevent leaking build dependencies
   - Using `dumb-init` for proper signal handling
   - Production-only dependencies installed

3. **Input Validation with Zod** (`/apps/api/src/config/env.ts`)
   - Environment variables validated with strict schemas
   - Token format validation (xoxb-, xapp-, sk_, etc.)

4. **Rate Limiting Implementation** (`/apps/api/src/middleware/rateLimit.ts`)
   - Per-workspace rate limiting
   - Redis support for distributed limiting
   - Bypass for platform admins

5. **OAuth Scope Limitation** (`/apps/api/src/services/google-drive/client.ts:61-64`)
   - Google Drive scopes limited to readonly

6. **Website Scraper Protections**
   - Respects robots.txt
   - Rate limiting between requests
   - Stays within same domain

---

## Remediation Priority

### Immediate (Within 24 Hours)
1. Rotate all exposed credentials in `.env` file
2. Remove `.env` from git history
3. Fix CORS wildcard configuration
4. Remove token logging in E2E setup

### Short-term (Within 1 Week)
1. Implement explicit column selection in all API routes
2. Add SSRF protection to scraper
3. Encrypt stored OAuth tokens
4. Configure Slack signing secret in Bolt

### Medium-term (Within 1 Month)
1. Add security headers with helmet
2. Implement token rotation for Slack bots
3. Sanitize all error logging
4. Add rate limiting to webhook endpoints

---

## Appendix: Files Requiring Changes

| File | Priority | Changes Required |
|------|----------|------------------|
| `/.gitignore` | CRITICAL | Add `.env.production` |
| `/apps/api/src/index.ts` | CRITICAL | Configure CORS origins |
| `/apps/api/src/routes/bots.ts` | CRITICAL | Use explicit column selection |
| `/apps/api/src/routes/setup.ts` | CRITICAL | Sanitize error responses |
| `/apps/dashboard/e2e/setup/global.setup.ts` | CRITICAL | Remove key logging |
| `/apps/api/src/services/scraper/website.ts` | HIGH | Add SSRF protection |
| `/apps/api/src/services/slack/instance.ts` | HIGH | Add signing secret |
| `/apps/api/src/routes/auth.ts` | HIGH | Encrypt OAuth tokens |

---

*Report generated by security audit process. All findings should be verified and remediated in order of severity.*
