#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEPLOY=false
MONITOR=false
MONITOR_HOURS="${MONITOR_HOURS:-24}"
SKIP_PHASE12=false

usage() {
  cat <<'EOF'
Usage:
  bash tools/phase13_rollout.sh [--deploy] [--monitor] [--monitor-hours N] [--skip-phase12]

Default behavior:
  - validates phase-13 prerequisites
  - runs schema checks
  - runs phase-12 verification
  - runs phase-13 smoke checks

Options:
  --deploy         perform ordered deployments (Oracle -> Worker -> Website)
  --monitor        run monitoring window after smoke checks
  --monitor-hours  monitoring duration in hours (default: 24)
  --skip-phase12   skip phase12 verification step

Required env for smoke and monitor:
  WORKER_BASE_URL
  ORACLE_BASE_URL
  WEBSITE_URL
Optional:
  SITE_ORIGIN

Extra required env when --deploy is enabled:
  ORACLE_SSH_DEST
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_PAGES_PROJECT_NAME
  PUBLIC_ORACLE_API_BASE_URL
  PUBLIC_WORKER_BASE_URL
  PUBLIC_SITE_URL
Optional when --deploy is enabled:
  PUBLIC_BASE_PATH   SvelteKit base path (empty for root deployments)
  ORACLE_TARGET_REF  Oracle git ref (default: origin/main)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy)
      DEPLOY=true
      shift
      ;;
    --monitor)
      MONITOR=true
      shift
      ;;
    --monitor-hours)
      MONITOR_HOURS="${2:-}"
      shift 2
      ;;
    --skip-phase12)
      SKIP_PHASE12=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

require_env() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required env: $key" >&2
    exit 1
  fi
}

step() {
  echo
  echo "[phase13] $1"
}

run_cmd() {
  echo "+ $*"
  "$@"
}

step "Step 1/10: Runtime contract and runbook assets"
for path in \
  "ARCHITECTURE_RUNTIME_CONTRACT.md" \
  "docs/RUNBOOK_DEPLOYMENT.md" \
  "docs/RUNBOOK_INCIDENT_RESPONSE.md" \
  "docs/DATA_FLOW_WORKER_ORACLE_WEBSITE.md"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
done
echo "Runtime contract and runbooks are present."

step "Step 2/10: Schema and compatibility checks"
run_cmd bash tools/check_schema_compat.sh

step "Step 3-8/10: Strict verification (phase12 matrix)"
if [[ "$SKIP_PHASE12" == "true" ]]; then
  echo "Skipping phase12 verification by request (--skip-phase12)."
else
  run_cmd bash tools/phase12_verify.sh
fi

if [[ "$DEPLOY" == "true" ]]; then
  step "Step 9/10: Ordered deployment (Oracle -> Worker -> Website)"
  require_cmd pnpm
  require_env ORACLE_SSH_DEST
  require_env CLOUDFLARE_ACCOUNT_ID
  require_env CLOUDFLARE_API_TOKEN
  require_env CLOUDFLARE_PAGES_PROJECT_NAME
  require_env PUBLIC_ORACLE_API_BASE_URL
  require_env PUBLIC_WORKER_BASE_URL
  require_env PUBLIC_SITE_URL

  if [[ "${PUBLIC_BASE_PATH:-}" == "/" ]]; then
    echo "PUBLIC_BASE_PATH='/' is invalid for SvelteKit. Using empty base path for root deployment."
    PUBLIC_BASE_PATH=""
  fi

  run_cmd bash tools/deploy_manual.sh oracle
  run_cmd bash tools/deploy_manual.sh cloudflare

  step "Deploy website to Cloudflare Pages"
  run_cmd env \
    PUBLIC_BASE_PATH="${PUBLIC_BASE_PATH:-}" \
    PUBLIC_ORACLE_API_BASE_URL="$PUBLIC_ORACLE_API_BASE_URL" \
    PUBLIC_WORKER_BASE_URL="$PUBLIC_WORKER_BASE_URL" \
    PUBLIC_SITE_URL="$PUBLIC_SITE_URL" \
    pnpm -C website build
  run_cmd env CI=1 pnpm -C cloudflare-worker exec wrangler pages deploy ../website/build \
    --project-name "$CLOUDFLARE_PAGES_PROJECT_NAME" \
    --branch main \
    --commit-dirty=true
else
  step "Step 9/10: Deployment skipped (no --deploy flag)"
fi

step "Step 10/10: Smoke checks"
require_env WORKER_BASE_URL
require_env ORACLE_BASE_URL
require_env WEBSITE_URL
run_cmd bash tools/phase13_smoke.sh

if [[ "$MONITOR" == "true" ]]; then
  step "24h monitoring window (lag/retry/DLQ)"
  DURATION_HOURS="$MONITOR_HOURS" run_cmd bash tools/phase13_monitor.sh
else
  echo
  echo "[phase13] Monitoring skipped. Use:"
  echo "  DURATION_HOURS=24 WORKER_BASE_URL=... ORACLE_BASE_URL=... bash tools/phase13_monitor.sh"
fi

echo
echo "[phase13] Rollout sequence complete."
