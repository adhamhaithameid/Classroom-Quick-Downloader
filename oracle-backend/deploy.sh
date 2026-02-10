#!/usr/bin/env bash
set -euo pipefail

# Backward-compatible wrapper. The old deployment flow used destructive
# down/prune operations and legacy branch names. Keep this entrypoint, but
# forward to the current safe in-place deploy flow.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/scripts/deploy_main_inplace.sh" "$@"
