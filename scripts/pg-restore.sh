#!/usr/bin/env bash
# Phase 5 — Postgres restore drill.
#
# Pulls a backup from S3, restores it into a *separate* throwaway database,
# and runs a smoke query. Never restores into production. Designed to be run
# manually as part of a monthly drill — see DEPLOY.md §5.x.
#
# Inputs (env):
#   BACKUP_S3_URI         s3://bucket/prefix                 (required)
#   RESTORE_DATABASE_URL  postgres://user:pass@host/restore_db
#                         must be a **non-prod** database — script refuses
#                         if the dbname matches /onsective_prod|onsective$/
#                         (required)
#   AWS_REGION            default us-east-1
#
# Args:
#   $1  S3 key (full s3://… URI) OR a date in YYYY-MM-DD form
#       — if a date, the script picks the latest backup from that day.
#
# Usage:
#   ./scripts/pg-restore.sh 2026-04-30
#   ./scripts/pg-restore.sh s3://onsective-backups/pg/prod/2026/04/30/full-0300.sql.gz
#
# Exit codes:
#   0  drill passed (smoke query returned plausible row count)
#   1  config missing / refused
#   2  download failed
#   3  restore failed
#   4  smoke query failed

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"

if [[ -z "${BACKUP_S3_URI:-}" || -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "[pg-restore] BACKUP_S3_URI and RESTORE_DATABASE_URL are both required" >&2
  exit 1
fi
if [[ -z "${1:-}" ]]; then
  echo "[pg-restore] usage: $0 <s3://… | YYYY-MM-DD>" >&2
  exit 1
fi

# Refuse to restore into production. Production db names end in 'prod' or
# match the bare app name. This is defence-in-depth — the user should also
# pass a non-prod URL.
DBNAME=$(echo "${RESTORE_DATABASE_URL}" | sed -E 's|.*/([^/?]+)(\?.*)?|\1|')
case "${DBNAME}" in
  *prod|onsective)
    echo "[pg-restore] REFUSING to restore into '${DBNAME}' — looks like prod" >&2
    exit 1
    ;;
esac

# Resolve arg → S3 URI.
if [[ "${1}" == s3://* ]]; then
  KEY="${1}"
else
  # Treat as YYYY-MM-DD; pick the latest object from that date.
  YEAR="${1:0:4}"
  MONTH="${1:5:2}"
  DAY="${1:8:2}"
  PREFIX="${BACKUP_S3_URI%/}/prod/${YEAR}/${MONTH}/${DAY}/"
  BUCKET=$(echo "${BACKUP_S3_URI}" | sed -E 's|s3://([^/]+).*|\1|')
  PREFIX_KEY=$(echo "${PREFIX}" | sed -E "s|s3://${BUCKET}/||")
  LATEST=$(aws s3api list-objects-v2 \
            --region "${REGION}" \
            --bucket "${BUCKET}" \
            --prefix "${PREFIX_KEY}" \
            --query 'sort_by(Contents, &LastModified)[-1].Key' \
            --output text)
  if [[ -z "${LATEST}" || "${LATEST}" == "None" ]]; then
    echo "[pg-restore] no backups found under ${PREFIX}" >&2
    exit 2
  fi
  KEY="s3://${BUCKET}/${LATEST}"
fi

echo "[pg-restore] source=${KEY}"
echo "[pg-restore] target=${RESTORE_DATABASE_URL%@*}@…"
START=$(date +%s)

# Stream S3 → gunzip → psql. Same no-disk pattern as the backup.
if ! aws s3 cp --region "${REGION}" "${KEY}" - \
    | gunzip \
    | psql --dbname="${RESTORE_DATABASE_URL}" --quiet --set ON_ERROR_STOP=1 > /dev/null
then
  echo "[pg-restore] restore FAILED" >&2
  exit 3
fi

# Smoke query: expect a non-trivial number of products + categories. Tunable
# per environment — the point is "did anything end up in there".
ROWS=$(psql --dbname="${RESTORE_DATABASE_URL}" --tuples-only --no-align \
       --command='SELECT COUNT(*) FROM "Product"' 2>/dev/null || echo 0)
CATS=$(psql --dbname="${RESTORE_DATABASE_URL}" --tuples-only --no-align \
       --command='SELECT COUNT(*) FROM "Category"' 2>/dev/null || echo 0)

ELAPSED=$(( $(date +%s) - START ))

if (( ROWS > 0 && CATS >= 8 )); then
  echo "[pg-restore] PASS elapsed=${ELAPSED}s products=${ROWS} categories=${CATS}"
  exit 0
else
  echo "[pg-restore] SMOKE FAILED elapsed=${ELAPSED}s products=${ROWS} categories=${CATS}" >&2
  exit 4
fi
