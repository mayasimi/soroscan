#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# wal_restore.sh — PostgreSQL restore_command for PITR from S3
#
# Configure in recovery.conf / postgresql.conf (PG12+):
#   restore_command = '/scripts/wal_restore.sh %f %p'
#
# Required environment variables:
#   S3_BUCKET
#   S3_WAL_PREFIX   e.g. wal-archive
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_DEFAULT_REGION
#
# Optional:
#   AWS_ENDPOINT_URL
# ---------------------------------------------------------------------------
set -euo pipefail

WAL_FILE="$1"   # %f — WAL filename
WAL_PATH="$2"   # %p — destination path

: "${S3_BUCKET:?S3_BUCKET is required}"
: "${S3_WAL_PREFIX:=wal-archive}"

AWS_ARGS=()
if [[ -n "${AWS_ENDPOINT_URL:-}" ]]; then
  AWS_ARGS+=(--endpoint-url "$AWS_ENDPOINT_URL")
fi

S3_KEY="${S3_WAL_PREFIX}/${WAL_FILE}"

aws s3 cp "${AWS_ARGS[@]}" \
  "s3://${S3_BUCKET}/${S3_KEY}" \
  "$WAL_PATH" \
  --only-show-errors

echo "[$(date -u)] WAL restored: s3://${S3_BUCKET}/${S3_KEY} -> ${WAL_PATH}"
