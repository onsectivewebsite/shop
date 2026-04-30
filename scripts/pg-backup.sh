#!/usr/bin/env bash
# Phase 5 — daily Postgres backup.
#
# Streams `pg_dump` through gzip to S3. No on-disk intermediate so the
# script works on a small VPS. Designed to run from cron once a day.
#
# Inputs (env):
#   DATABASE_URL     postgres://user:pass@host:port/db   (required)
#   BACKUP_S3_URI    s3://bucket/prefix                  (required)
#   BACKUP_LABEL     'prod' or 'staging'                 (default: prod)
#   AWS_REGION       region for the bucket               (default: us-east-1)
#
# Output key:
#   <BACKUP_S3_URI>/<LABEL>/YYYY/MM/DD/full-<HHMM>.sql.gz
#
# Retention is enforced by an S3 lifecycle policy on the bucket — far more
# reliable than fighting `aws s3 ls` and date math here. Suggested rule:
#   transition to STANDARD_IA after 30 days
#   expire after 365 days
#
# Exit codes:
#   0  ok
#   1  config missing
#   2  pg_dump failed (mid-stream)
#   3  s3 upload failed

set -euo pipefail

LABEL="${BACKUP_LABEL:-prod}"
REGION="${AWS_REGION:-us-east-1}"
START=$(date +%s)

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[pg-backup] DATABASE_URL is required" >&2
  exit 1
fi
if [[ -z "${BACKUP_S3_URI:-}" ]]; then
  echo "[pg-backup] BACKUP_S3_URI is required (e.g. s3://onsective-backups/pg)" >&2
  exit 1
fi

STAMP_DATE=$(date -u +%Y/%m/%d)
STAMP_TIME=$(date -u +%H%M)
HOST=$(hostname -s 2>/dev/null || echo unknown)

KEY="${BACKUP_S3_URI%/}/${LABEL}/${STAMP_DATE}/full-${STAMP_TIME}.sql.gz"

echo "[pg-backup] start label=${LABEL} target=${KEY} host=${HOST}"

# --no-owner / --no-privileges keeps the dump portable across role names —
# we re-grant on restore. -Fp = plain text so the dump is grep-able if you
# need to fish a single row out without a full restore.
#
# Pipefail catches a mid-stream pg_dump failure even though gzip succeeds on
# the truncated input. The shell's exit status reflects whichever stage
# failed.
if ! pg_dump \
      --dbname="${DATABASE_URL}" \
      --no-owner \
      --no-privileges \
      --format=plain \
      --verbose \
      2> >(grep -E "(ERROR|FATAL|^pg_dump:)" | head -50 >&2) \
    | gzip -9 \
    | aws s3 cp \
        --region "${REGION}" \
        --metadata "label=${LABEL},host=${HOST},started=${START}" \
        --content-type "application/gzip" \
        --expected-size 0 \
        - "${KEY}"
then
  echo "[pg-backup] FAILED at $(date -u +%FT%TZ)" >&2
  exit 2
fi

ELAPSED=$(( $(date +%s) - START ))
SIZE=$(aws s3api head-object \
        --region "${REGION}" \
        --bucket "$(echo "${BACKUP_S3_URI}" | sed -E 's|s3://([^/]+).*|\1|')" \
        --key "$(echo "${KEY}" | sed -E 's|s3://[^/]+/||')" \
        --query 'ContentLength' --output text 2>/dev/null || echo "?")

echo "[pg-backup] done elapsed=${ELAPSED}s size=${SIZE}B key=${KEY}"
