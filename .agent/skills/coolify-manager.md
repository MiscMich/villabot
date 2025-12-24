# Coolify Manager Skill

Manage and troubleshoot Coolify deployments.

## When to Use

- Debugging down WordPress sites on Coolify
- Checking service health, logs, or status
- Managing deployments, services, or applications
- SSL certificate issues
- Fixing .htaccess or PHP configuration issues

## Quick Reference

### Check Service Status
```bash
# List all resources with status
coolify resource list

# Get detailed service info
coolify service get SERVICE_UUID

# Check specific application
coolify app get APP_UUID
```

### Check Logs
```bash
# Application logs
coolify app logs APP_UUID

# Get more lines
coolify app logs APP_UUID --lines 500
```

### Start/Stop/Restart
```bash
# Services
coolify service start SERVICE_UUID
coolify service stop SERVICE_UUID
coolify service restart SERVICE_UUID

# Applications
coolify app start APP_UUID
coolify app stop APP_UUID
coolify app restart APP_UUID
```

### Deploy Applications
```bash
# Deploy by UUID
coolify deploy APP_UUID

# Check deployment status
coolify deploy list APP_UUID
```

### Environment Variables
```bash
# List env vars
coolify app env list APP_UUID

# Add/update env var
coolify app env set APP_UUID VAR_NAME "value"

# Delete env var
coolify app env delete APP_UUID VAR_NAME

# Restart to apply changes
coolify app restart APP_UUID
```

## WordPress Troubleshooting

### Accessing Container
**Via Coolify Web Terminal:**
1. Navigate to Coolify dashboard
2. Go to WordPress service
3. Click "Terminal" in sidebar
4. Select "wordpress" container

WordPress files: `/var/www/html/`

### Site Down After .htaccess Edit
1. Access container terminal
2. Check .htaccess: `cat /var/www/html/.htaccess`
3. Remove problematic line: `sed -i '$d' /var/www/html/.htaccess`

### PHP Configuration Limits
```bash
echo "php_value max_input_vars 3000" >> /var/www/html/.htaccess
echo "php_value upload_max_filesize 64M" >> /var/www/html/.htaccess
echo "php_value post_max_size 128M" >> /var/www/html/.htaccess
echo "php_value memory_limit 256M" >> /var/www/html/.htaccess
```

### REST API Check
```bash
curl https://site.com/wp-json/
```

## SSL Certificate Check
```bash
echo | openssl s_client -servername domain.com -connect domain.com:443 2>/dev/null | openssl x509 -noout -dates -subject -issuer
```

## Common Patterns

### Pattern: Service is Down
1. Check status: `coolify resource list`
2. Get details: `coolify service get UUID`
3. Check logs: `coolify app logs APP_UUID`
4. Identify issue from logs
5. Fix (restart, update config, fix files)
6. Verify: `coolify resource list`

### Pattern: Deployment Issues
1. List recent deployments
2. Check application logs
3. Fix identified issues
4. Trigger new deployment

## Your Coolify Instance

- **Dashboard**: http://178.156.192.101:8000
- **API Token**: Stored in `~/.claude/coolify-mcp/.env`
