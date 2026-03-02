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
ORACLE_SSH_DEST="${ORACLE_SSH_DEST:-}"
ORACLE_SSH_KEY="${ORACLE_SSH_KEY:-$HOME/.ssh/oracle_key}"
ORACLE_REMOTE_REPO_DIR="${ORACLE_REMOTE_REPO_DIR:-\$HOME/Classroom-Quick-Downloader}"

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
  pnpm -C "$ROOT_DIR/cloudflare-worker" run deploy
}

deploy_oracle() {
  require_cmd ssh
  if [[ ! -f "$ORACLE_SSH_KEY" ]]; then
    echo "Oracle SSH key not found: $ORACLE_SSH_KEY" >&2
    exit 1
  fi
  echo "[oracle] deploying remotely via SSH"
  echo "  target: $ORACLE_SSH_DEST"
  echo "  key: $ORACLE_SSH_KEY"
  ssh -i "$ORACLE_SSH_KEY" "$ORACLE_SSH_DEST" "REPO_DIR=$ORACLE_REMOTE_REPO_DIR bash -s" <<'EOF'
set -euo pipefail
if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone https://github.com/adhamhaithameid/Classroom-Quick-Downloader.git "$REPO_DIR"
fi
bash "$REPO_DIR/oracle-backend/scripts/deploy_main_inplace.sh"
EOF
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

Environment overrides:
  ORACLE_SSH_DEST        SSH destination (default: ubuntu@129.151.233.229)
  ORACLE_SSH_KEY         SSH key path (default: ~/.ssh/oracle_key)
  ORACLE_REMOTE_REPO_DIR Repo path on server (default: $HOME/Classroom-Quick-Downloader)
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
