#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pg_backup.sh — Daily pg_dump backup to S3
#
# Required environment variables:
#   DATABASE_URL        postgresql://user:pass@host:5432/dbname
#   S3_BUCKET           e.g. soroscan-backups
#   S3_PREFIX           e.g. pg-backups  (no trailing slash)
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION  e.g. us-east-1
#
# Optional:
#   AWS_ENDPOINT_URL    For MinIO / Localstack
#   BACKUP_RETENTION_DAYS  How many days to keep backups (default: 30)
# ---------------------------------------------------------------------------
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_PREFIX:=${S3_PREFIX:-pg-backups}}"
: "${BACKUP_RETENTION_DAYS:=30}"

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_FILE="/tmp/soroscan_${TIMESTAMP}.dump"
S3_KEY="${S3_PREFIX}/${TIMESTAMP}.dump.gz"

# Parse DATABASE_URL into pg_dump args
# Format: postgresql://user:pass@host:port/dbname
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

export PGPASSWORD="$DB_PASS"

echo "[$(date -u)] Starting pg_dump for database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}"

# Custom-format dump (supports parallel restore with pg_restore)
pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --compress=9 \
  --no-password \
  --file="$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -u)] Dump complete. Size: ${BACKUP_SIZE}"

# Upload to S3
AWS_ARGS=()
if [[ -n "${AWS_ENDPOINT_URL:-}" ]]; then
  AWS_ARGS+=(--endpoint-url "$AWS_ENDPOINT_URL")
fi

echo "[$(date -u)] Uploading to s3://${S3_BUCKET}/${S3_KEY}"
aws s3 cp "${AWS_ARGS[@]}" \
  "$BACKUP_FILE" \
  "s3://${S3_BUCKET}/${S3_KEY}" \
  --storage-class STANDARD_IA

echo "[$(date -u)] Upload complete."

# Tag with metadata
aws s3api put-object-tagging "${AWS_ARGS[@]}" \
  --bucket "$S3_BUCKET" \
  --key "$S3_KEY" \
  --tagging "TagSet=[{Key=db,Value=${DB_NAME}},{Key=host,Value=${DB_HOST}},{Key=timestamp,Value=${TIMESTAMP}}]" \
  2>/dev/null || true

# Prune backups older than BACKUP_RETENTION_DAYS
echo "[$(date -u)] Pruning backups older than ${BACKUP_RETENTION_DAYS} days..."
CUTOFF=$(date -u -d "${BACKUP_RETENTION_DAYS} days ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -v-"${BACKUP_RETENTION_DAYS}"d +"%Y-%m-%dT%H:%M:%SZ")  # macOS fallback

aws s3api list-objects-v2 "${AWS_ARGS[@]}" \
  --bucket "$S3_BUCKET" \
  --prefix "${S3_PREFIX}/" \
  --query "Contents[?LastModified<='${CUTOFF}'].Key" \
  --output text \
| tr '\t' '\n' \
| grep -v '^$' \
| while read -r key; do
    echo "[$(date -u)] Deleting old backup: s3://${S3_BUCKET}/${key}"
    aws s3 rm "${AWS_ARGS[@]}" "s3://${S3_BUCKET}/${key}"
  done

# Cleanup temp file
rm -f "$BACKUP_FILE"

echo "[$(date -u)] Backup job complete: s3://${S3_BUCKET}/${S3_KEY}"
