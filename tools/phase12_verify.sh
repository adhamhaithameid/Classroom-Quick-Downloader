#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log_step() {
  echo
  echo "[phase12] $1"
}

run_cmd() {
  echo "+ $*"
  "$@"
}

log_step "Schema compatibility contract"
run_cmd bash tools/check_schema_compat.sh

log_step "Unit coverage targets"
run_cmd pnpm -C website run test:unit
run_cmd pnpm -C cloudflare-worker run test:regression
run_cmd pnpm -C oracle-backend run test:regression

log_step "Functional flow targets"
run_cmd pnpm run test:functional

log_step "Integration flow targets"
run_cmd pnpm run test:integration:all

log_step "Regression safety targets"
run_cmd pnpm run test:regression

log_step "Load and stress targets"
run_cmd pnpm run test:load
run_cmd pnpm run test:stress

log_step "Security, UI, fuzz, reliability targets"
run_cmd pnpm run test:security:all
run_cmd pnpm run test:ui
run_cmd pnpm run test:fuzz:all
run_cmd pnpm run test:reliability

log_step "Smoke closure targets"
run_cmd pnpm run test:smoke

log_step "Per-package strict closure"
run_cmd pnpm -C website run test:strict
run_cmd pnpm -C cloudflare-worker run test:strict
run_cmd pnpm -C oracle-backend run test:strict

log_step "Phase 12 verification complete"
echo "All strict phase-12 suites passed."
