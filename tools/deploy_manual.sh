#!/usr/bin/env bash
set -euo pipefail

# Manual deployment helper.
# Use this after merging PRs to deploy Cloudflare and/or Oracle from main.
#
# Usage:
#   ./tools/deploy_manual.sh cloudflare
#   ./tools/deploy_manual.sh oracle
#   ./tools/deploy_manual.sh all

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-help}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

deploy_cloudflare() {
  require_cmd pnpm
  echo "[cloudflare] validating worker..."
  pnpm -C "$ROOT_DIR/cloudflare-worker" validate
  echo "[cloudflare] deploying worker..."
  pnpm -C "$ROOT_DIR/cloudflare-worker" deploy
}

deploy_oracle() {
  local script_path="$ROOT_DIR/oracle-backend/scripts/deploy_main_inplace.sh"
  if [[ ! -x "$script_path" ]]; then
    echo "Oracle deploy script is missing or not executable: $script_path" >&2
    exit 1
  fi
  echo "[oracle] running in-place deploy..."
  bash "$script_path"
}

case "$MODE" in
  cloudflare)
    deploy_cloudflare
    ;;
  oracle)
    deploy_oracle
    ;;
  all)
    deploy_cloudflare
    deploy_oracle
    ;;
  help|-h|--help)
    cat <<'EOF'
Usage:
  ./tools/deploy_manual.sh cloudflare
  ./tools/deploy_manual.sh oracle
  ./tools/deploy_manual.sh all
EOF
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    echo "Expected one of: cloudflare | oracle | all | help" >&2
    exit 1
    ;;
esac
if [[ "$MODE" != "help" && "$MODE" != "-h" && "$MODE" != "--help" ]]; then
  echo "Manual deployment completed."
fi
