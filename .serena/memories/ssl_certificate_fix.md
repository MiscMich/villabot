# SSL Certificate Fix for cluebase.ai

## Issue (2025-12-21)
- `cluebase.ai` shows `NET::ERR_CERT_AUTHORITY_INVALID`
- `api.cluebase.ai` works correctly with valid SSL
- Dashboard container is `running:healthy` but Traefik serves default cert

## Root Cause
Let's Encrypt certificate failed to issue for cluebase.ai during initial deployment (container was unhealthy during ACME challenge).

## Fix
Restart Traefik proxy via Coolify Dashboard:
1. http://178.156.192.101:8000 → Servers → localhost → Restart Proxy

Or via SSH:
```bash
docker restart coolify-proxy
```

If that doesn't work, force regeneration:
```bash
rm /data/coolify/proxy/acme.json
docker restart coolify-proxy
```

## Verification
After fix, test: `curl -I https://cluebase.ai`
Should show valid Let's Encrypt certificate (issuer: R3 or similar)
