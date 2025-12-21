# Cluebase AI - Comprehensive Deployment Analysis

**Date**: 2025-12-21
**Analyst**: Claude Code

---

## Executive Summary

The SSL certificate issues stem from **Cloudflare proxy (orange cloud) interfering with Let's Encrypt HTTP-01 ACME challenges**. Traefik cannot obtain valid certificates because Cloudflare's "Always Use HTTPS" setting redirects the HTTP challenge to HTTPS before it reaches the server.

**Root Cause**: Cloudflare + Let's Encrypt HTTP-01 incompatibility
**Impact**: All domains show `NET::ERR_CERT_AUTHORITY_INVALID`
**Fix Required**: Use Cloudflare Origin Certificates OR configure ACME bypass rules

---

## Architecture Analysis

### Current Setup

```
Users → Cloudflare (Proxy ON) → Server:443 → Traefik → Containers
                                    ↓
                          Let's Encrypt HTTP-01
                          (BLOCKED by Cloudflare)
```

### Components

| Component | Status | Notes |
|-----------|--------|-------|
| Coolify | Running | v4.0.0-beta.455 |
| Traefik | Running | v3.6.5 |
| cluebase-dashboard | `running:unhealthy` | Container health check failing |
| cluebase-api | `running:unknown` | Health returns degraded |
| Supabase | Running | All services up |

### Cloudflare Configuration

From docs, DNS records are set with **Proxy: Yes** (orange cloud):
- `cluebase.ai` → 178.156.192.101 (Proxied)
- `api.cluebase.ai` → 178.156.192.101 (Proxied)
- `supabase.cluebase.ai` → 178.156.192.101 (Proxied)

---

## Problem Chain

1. **Cloudflare proxies all traffic** (orange cloud enabled)
2. **"Always Use HTTPS" is enabled** in Cloudflare
3. **Let's Encrypt ACME challenge starts** on port 80
4. **Cloudflare intercepts** the HTTP request
5. **Cloudflare redirects** `http://cluebase.ai/.well-known/acme-challenge/TOKEN` → HTTPS
6. **Challenge fails** because ACME server expects HTTP response
7. **No valid certificate** is issued
8. **Traefik serves default/self-signed cert**
9. **Cloudflare Full (Strict)** rejects invalid cert → 526 error
10. **Users see** "self-signed certificate" or "invalid certificate" errors

---

## Solution Options

### Option 1: Cloudflare Origin Certificates (RECOMMENDED)

Use Cloudflare's free origin certificates instead of Let's Encrypt. These are trusted by Cloudflare when proxying and work with Full (Strict) mode.

**Steps**:
1. In Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate
2. Generate certificate for `*.cluebase.ai` and `cluebase.ai`
3. Save cert and key to `/data/coolify/proxy/certs/` on server
4. Modify Traefik to use origin cert instead of ACME
5. Set Cloudflare SSL mode to "Full (strict)"

**Pros**:
- No ACME challenges needed
- Works perfectly with proxied mode
- 15-year certificate validity
- Simpler configuration

**Cons**:
- Certificates only work when traffic goes through Cloudflare
- Requires manual Traefik configuration changes

### Option 2: Configure ACME Bypass in Cloudflare

Create Configuration Rules to allow HTTP-01 challenges to pass through.

**Steps**:
1. Cloudflare Dashboard → Rules → Configuration Rules
2. Create rule:
   - Name: "Allow ACME Challenges"
   - Expression: `(starts_with(http.request.uri.path, "/.well-known/acme-challenge/"))`
   - Settings:
     - Automatic HTTPS Rewrites: OFF
     - SSL: OFF (for this path only)
3. Disable global "Always Use HTTPS" OR use another rule to replicate it for other paths

**Pros**:
- Keeps Let's Encrypt certificates
- Minimal server-side changes

**Cons**:
- More complex Cloudflare configuration
- May need to manage multiple rules

### Option 3: DNS-01 Challenge (Alternative)

Use DNS-01 instead of HTTP-01 for ACME validation.

**Steps**:
1. Configure Traefik to use Cloudflare DNS-01 challenge
2. Create Cloudflare API token with DNS edit permissions
3. Update Coolify Traefik configuration

**Pros**:
- Works with proxied domains
- Supports wildcard certificates

**Cons**:
- Requires Cloudflare API token in server
- More complex Traefik setup in Coolify

---

## Other Issues Identified

### 1. Dashboard Health Check Failing

**Symptom**: `running:unhealthy`

**Possible Causes**:
- Dashboard container is running but health endpoint not responding
- Startup timing issues
- Internal errors during rendering

**Investigation Needed**:
- Check container logs: `docker logs dashboard-m8s04gk4w0osko0sgw48cw4s-*`
- Verify Next.js is serving on port 3000

### 2. API Health Degraded

**Symptom**: Health returns `degraded`

**Cause**: Expected - Slack and Google Drive integrations are not configured

**Not Blocking**: Core RAG functionality works without these

### 3. Traefik Dynamic Config Not Used

The `traefik/` directory in the repo has custom routers/TLS config, but Coolify manages Traefik configuration via container labels, not file-based config. This config is essentially unused.

### 4. Dashboard Port Mismatch

In `traefik/dynamic/routers.yml`:
```yaml
dashboard:
  loadBalancer:
    servers:
      - url: "http://dashboard:3001"  # Port 3001
```

But the actual container exposes port 3000. This confirms the dynamic config is not being used (Coolify handles routing).

---

## Recommended Fix Sequence

### Immediate Fix (Option 1 - Origin Certs)

1. **SSH to server**: `ssh root@178.156.192.101`

2. **Create certificate directory**:
   ```bash
   mkdir -p /data/coolify/proxy/certs
   cd /data/coolify/proxy/certs
   ```

3. **Generate Origin Certificate in Cloudflare**:
   - Go to SSL/TLS → Origin Server → Create Certificate
   - Hostnames: `cluebase.ai`, `*.cluebase.ai`
   - Validity: 15 years
   - Save as `origin.pem` (certificate) and `origin-key.pem` (private key)

4. **Upload certificates to server**:
   ```bash
   # Copy certificate content
   nano /data/coolify/proxy/certs/origin.pem
   # Copy private key content
   nano /data/coolify/proxy/certs/origin-key.pem
   ```

5. **Create Traefik dynamic config**:
   ```bash
   nano /data/coolify/proxy/dynamic/cloudflare-origin.yml
   ```
   Content:
   ```yaml
   tls:
     stores:
       default:
         defaultCertificate:
           certFile: /traefik/certs/origin.pem
           keyFile: /traefik/certs/origin-key.pem
   ```

6. **Restart Traefik**:
   ```bash
   docker restart coolify-proxy
   ```

7. **Verify in Cloudflare**:
   - SSL/TLS → Overview → Set to "Full (strict)"

---

## Codebase Quality Assessment

### Dockerfiles: ✅ GOOD
- Multi-stage builds for small images
- Non-root user execution
- Proper signal handling with dumb-init
- Production dependencies only in final stage

### Docker Compose (Coolify): ✅ GOOD
- Uses `expose` instead of `ports` (correct for Traefik)
- Health checks defined
- Build args for Next.js public env vars
- Restart policy configured

### Environment Variables: ✅ GOOD
- Secrets not in code
- Proper separation of build-time vs runtime vars
- Fallback defaults where appropriate

### Areas for Improvement
1. The `traefik/` directory is unused - consider removing or documenting
2. `docker-compose.prod.yml` vs `docker-compose.coolify.yml` may cause confusion
3. No redis service defined in Coolify (API defaults to redis:6379 which won't work)

---

## Verification Checklist

After applying fix:

- [ ] `curl -I https://cluebase.ai` returns HTTP 200
- [ ] `curl https://api.cluebase.ai/health` returns JSON
- [ ] Browser shows valid certificate (lock icon)
- [ ] Dashboard loads landing page
- [ ] Sign up flow works
- [ ] Dashboard protected routes accessible after login

---

## Files Referenced

- `apps/api/docker-compose.coolify.yml`
- `apps/dashboard/docker-compose.coolify.yml`
- `apps/api/Dockerfile`
- `apps/dashboard/Dockerfile`
- `traefik/dynamic/routers.yml` (unused by Coolify)
- `traefik/dynamic/tls.yml` (unused by Coolify)
- `docs/COOLIFY_DEPLOYMENT.md`
