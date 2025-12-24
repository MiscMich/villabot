---
description: Deploy to production via Coolify
---

# Deployment Workflow

## Pre-Deployment Checklist
1. Ensure all tests pass:
// turbo
```bash
pnpm typecheck && pnpm lint && pnpm test
```

2. Ensure build succeeds:
// turbo
```bash
pnpm build
```

3. Check for uncommitted changes:
```bash
git status
```

## Deployment Steps
1. Push to main branch (triggers automatic deployment):
```bash
git push origin main
```

2. Monitor deployment in Coolify:
   - Dashboard: http://178.156.192.101:8000
   - Check GitHub Actions for deployment status

3. Verify health after deployment:
// turbo
```bash
curl -s https://api.cluebase.ai/health | jq
```

4. Check dashboard is accessible:
// turbo
```bash
curl -s -o /dev/null -w "%{http_code}" https://cluebase.ai
```

## Rollback (if needed)
1. Revert to previous commit:
```bash
git revert HEAD
git push origin main
```

2. Or use Coolify dashboard to redeploy previous version
