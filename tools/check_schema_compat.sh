#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

oracle_file="${ROOT_DIR}/oracle-backend/internal/handlers/public_website.go"
worker_file="${ROOT_DIR}/cloudflare-worker/src/downloads_do.ts"
website_file="${ROOT_DIR}/website/src/lib/types/public.ts"

extract_oracle_version() {
  sed -nE 's/^[[:space:]]*publicWebsiteSchemaVersion[[:space:]]*=[[:space:]]*"([^"]+)".*$/\1/p' "$oracle_file" | head -n1
}

extract_worker_version() {
  sed -nE 's/^[[:space:]]*const[[:space:]]+WEBSITE_EVENTS_SCHEMA_VERSION[[:space:]]*=[[:space:]]*"([^"]+)".*$/\1/p' "$worker_file" | head -n1
}

extract_website_version() {
  sed -nE "s/^export type PublicSchemaVersion = '([^']+)';$/\1/p" "$website_file" | head -n1
}

oracle_version="$(extract_oracle_version)"
worker_version="$(extract_worker_version)"
website_version="$(extract_website_version)"

if [[ -z "${oracle_version}" || -z "${worker_version}" || -z "${website_version}" ]]; then
  echo "Schema compatibility check failed: unable to extract schema versions."
  echo "oracle=${oracle_version:-<missing>} worker=${worker_version:-<missing>} website=${website_version:-<missing>}"
  exit 1
fi

if [[ "${oracle_version}" != "${worker_version}" || "${oracle_version}" != "${website_version}" ]]; then
  echo "Schema compatibility mismatch detected:"
  echo "  oracle-backend: ${oracle_version}"
  echo "  cloudflare-worker: ${worker_version}"
  echo "  website: ${website_version}"
  exit 1
fi

echo "Schema compatibility check passed (version=${oracle_version})"
