#!/usr/bin/env bash
set -euo pipefail

# Deprecated compatibility wrapper.
# Use scripts/deploy_main_inplace.sh directly for all new docs, automation, and
# operator workflows. This file stays only so older muscle-memory commands do
# not break while the runbooks finish converging on the real deploy entrypoint.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/scripts/deploy_main_inplace.sh" "$@"
