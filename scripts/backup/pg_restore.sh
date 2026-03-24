#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# pg_restore.sh — Restore a pg_dump backup from S3
#
# Usage:
#   ./pg_restore.sh [S3_KEY]
#
#   If S3_KEY is omitted, the most recent backup is used.
#
# Required environment variables:
#   DATABASE_URL        postgresql://user:pass@host:5432/dbname
#   S3_BUCKET           e.g. soroscan-backups
#   S3_PREFIX           e.g. pg-backups
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION
#
# Optional:
#   AWS_ENDPOINT_URL    For MinIO / Localstack
#   RESTORE_JOBS        Parallel restore jobs (default: 4)
# ---------------------------------------------------------------------------
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_PREFIX:=${S3_PREFIX:-pg-backups}}"
: "${RESTORE_JOBS:=4}"

AWS_ARGS=()
if [[ -n "${AWS_ENDPOINT_URL:-}" ]]; then
  AWS_ARGS+=(--endpoint-url "$AWS_ENDPOINT_URL")
fi

# Resolve S3 key — use argument or find latest
if [[ -n "${1:-}" ]]; then
  S3_KEY="$1"
else
  echo "[$(date -u)] No S3_KEY provided — finding latest backup..."
  S3_KEY=$(aws s3api list-objects-v2 "${AWS_ARGS[@]}" \
    --bucket "$S3_BUCKET" \
    --prefix "${S3_PREFIX}/" \
    --query "sort_by(Contents, &LastModified)[-1].Key" \
    --output text)

  if [[ -z "$S3_KEY" || "$S3_KEY" == "None" ]]; then
    echo "ERROR: No backups found in s3://${S3_BUCKET}/${S3_PREFIX}/" >&2
    exit 1
  fi
fi

echo "[$(date -u)] Restoring from: s3://${S3_BUCKET}/${S3_KEY}"

# Parse DATABASE_URL
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|postgresql://[^@]+@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

export PGPASSWORD="$DB_PASS"

RESTORE_FILE="/tmp/soroscan_restore.dump"

# Download backup
echo "[$(date -u)] Downloading backup..."
aws s3 cp "${AWS_ARGS[@]}" "s3://${S3_BUCKET}/${S3_KEY}" "$RESTORE_FILE"

echo "[$(date -u)] Download complete. Starting restore into ${DB_NAME}..."

# Drop existing connections and recreate DB
psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname=postgres \
  --no-password \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" \
  2>/dev/null || true

psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname=postgres \
  --no-password \
  -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"

psql \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname=postgres \
  --no-password \
  -c "CREATE DATABASE \"${DB_NAME}\";"

# Restore with parallel jobs
pg_restore \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --no-password \
  --jobs="$RESTORE_JOBS" \
  --no-owner \
  --no-privileges \
  "$RESTORE_FILE"

rm -f "$RESTORE_FILE"

echo "[$(date -u)] Restore complete. Database ${DB_NAME} is ready."
