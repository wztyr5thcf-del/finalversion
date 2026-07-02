#!/usr/bin/env bash
# ============================================================================
# Creatools PostgreSQL Backup Script
# Creates a compressed backup of the database and optionally uploads to S3
# ============================================================================
set -euo pipefail

# Configuration
BACKUP_DIR="/opt/creatools/backups"
RETENTION_DAYS=7
S3_BUCKET="${BACKUP_S3_BUCKET:-}"  # Optional: S3 bucket for offsite backups
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="creatools_backup_${TIMESTAMP}.sql.gz"

# Load environment variables
DEPLOY_DIR="/opt/creatools/app/deploy"
if [ -f "$DEPLOY_DIR/.env" ]; then
    set -a
    source "$DEPLOY_DIR/.env"
    set +a
fi

# Validate DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is not set."
    echo "Please set it in $DEPLOY_DIR/.env or export it."
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup: $BACKUP_FILE"

# Perform backup using pg_dump
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
echo "  Backup created: $BACKUP_DIR/$BACKUP_FILE ($BACKUP_SIZE)"

# Upload to S3 if bucket is configured
if [ -n "$S3_BUCKET" ]; then
    echo "  Uploading to S3: s3://$S3_BUCKET/backups/$BACKUP_FILE"
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$S3_BUCKET/backups/$BACKUP_FILE" --quiet
    echo "  S3 upload complete."
fi

# Clean up old backups (local)
echo "  Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "creatools_backup_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

REMAINING=$(find "$BACKUP_DIR" -name "creatools_backup_*.sql.gz" | wc -l)
echo "  Remaining local backups: $REMAINING"

echo "Backup complete!"
echo ""
echo "---"
echo "To set up automated daily backups, add this to crontab:"
echo "  crontab -e"
echo "  # Daily backup at 2 AM"
echo "  0 2 * * * /opt/creatools/app/deploy/backup.sh >> /opt/creatools/logs/backup.log 2>&1"
echo ""
echo "To restore from backup:"
echo "  gunzip -c $BACKUP_DIR/$BACKUP_FILE | psql \$DATABASE_URL"
