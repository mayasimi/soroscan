#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# wal_archive.sh — PostgreSQL archive_command for WAL shipping to S3
#
# Configure in postgresql.conf:
#   wal_level = replica
#   archive_mode = on
#   archive_command = '/scripts/wal_archive.sh %p %f'
#
# Required environment variables (set in postgres container env):
#   S3_BUCKET
#   S3_WAL_PREFIX   e.g. wal-archive  (default)
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION
#
# Optional:
#   AWS_ENDPOINT_URL
# ---------------------------------------------------------------------------
set -euo pipefail

WAL_PATH="$1"   # %p — absolute path to WAL file
WAL_FILE="$2"   # %f — WAL filename only

: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_WAL_PREFIX:=wal-archive}"

AWS_ARGS=()
if [[ -n "${AWS_ENDPOINT_URL:-}" ]]; then
  AWS_ARGS+=(--endpoint-url "$AWS_ENDPOINT_URL")
fi

S3_KEY="${S3_WAL_PREFIX}/${WAL_FILE}"

aws s3 cp "${AWS_ARGS[@]}" \
  "$WAL_PATH" \
  "s3://${S3_BUCKET}/${S3_KEY}" \
  --only-show-errors

echo "[$(date -u)] WAL archived: ${WAL_FILE} -> s3://${S3_BUCKET}/${S3_KEY}"
