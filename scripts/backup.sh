#!/bin/bash
#
# TeamBrain AI - Backup Script
# Creates daily backups of database and volumes
#
# Usage: ./scripts/backup.sh
# Cron:  0 2 * * * /path/to/backup.sh
#

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$DATE"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +%H:%M:%S)] ERROR:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +%H:%M:%S)] WARNING:${NC} $1"
}

# Create backup directory
mkdir -p "$BACKUP_PATH"

log "Starting backup to $BACKUP_PATH"

# Backup Supabase database
log "Backing up Supabase database..."
if docker compose -f docker-compose.supabase.yml exec -T db pg_dump -U postgres postgres > "$BACKUP_PATH/supabase.sql" 2>/dev/null; then
    gzip "$BACKUP_PATH/supabase.sql"
    log "Database backup complete: supabase.sql.gz"
else
    warn "Supabase database backup skipped (container not running)"
fi

# Backup application database (if using separate)
log "Backing up application data..."
if docker compose exec -T api sh -c 'echo "ok"' 2>/dev/null; then
    # Export any local data if needed
    log "Application container is running"
fi

# Backup Docker volumes
log "Backing up Docker volumes..."

# Letsencrypt certificates
if docker volume inspect teambrain-ai_letsencrypt >/dev/null 2>&1; then
    docker run --rm \
        -v teambrain-ai_letsencrypt:/data:ro \
        -v "$BACKUP_PATH":/backup \
        alpine tar czf /backup/letsencrypt.tar.gz -C /data .
    log "Letsencrypt backup complete"
fi

# Supabase storage
if docker volume inspect teambrain-supabase_supabase-storage >/dev/null 2>&1; then
    docker run --rm \
        -v teambrain-supabase_supabase-storage:/data:ro \
        -v "$BACKUP_PATH":/backup \
        alpine tar czf /backup/supabase-storage.tar.gz -C /data .
    log "Supabase storage backup complete"
fi

# Create backup manifest
cat > "$BACKUP_PATH/manifest.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "hostname": "$(hostname)",
    "files": [
$(ls -la "$BACKUP_PATH" | tail -n +4 | awk '{print "        \"" $9 "\": " $5 ","}' | sed '$ s/,$//')
    ]
}
EOF

# Cleanup old backups
log "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true

# Report
BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
log "Backup complete! Size: $BACKUP_SIZE"
log "Location: $BACKUP_PATH"

# List backup contents
echo ""
echo "Backup contents:"
ls -lh "$BACKUP_PATH"
