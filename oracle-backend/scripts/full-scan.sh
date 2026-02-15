#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v go >/dev/null 2>&1; then
  echo "error: go is required"
  exit 1
fi

ensure_worker_toolchain() {
  if ! command -v node >/dev/null 2>&1; then
    echo "error: node is required for cloudflare-worker checks" >&2
    exit 1
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "error: pnpm is required for cloudflare-worker checks" >&2
    exit 1
  fi

  local node_major
  node_major="$(node -p 'parseInt(process.versions.node.split(".")[0], 10)' 2>/dev/null || echo 0)"
  if [[ -z "$node_major" || "$node_major" -lt 20 ]]; then
    echo "error: node >= 20 is required for deterministic cloudflare-worker checks (found: $(node -v 2>/dev/null || echo unknown))" >&2
    exit 1
  fi

  local workspace_pkg expected_pnpm current_pnpm
  workspace_pkg="$ROOT_DIR/../package.json"
  expected_pnpm=""
  if [[ -f "$workspace_pkg" ]]; then
    expected_pnpm="$(
      node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const pm=(p.packageManager||"").trim();if(pm.startsWith("pnpm@"))process.stdout.write(pm.slice(5));' \
      "$workspace_pkg" 2>/dev/null || true
    )"
  fi

  if [[ -n "$expected_pnpm" ]]; then
    current_pnpm="$(pnpm --version 2>/dev/null || true)"
    if [[ "$current_pnpm" != "$expected_pnpm" ]]; then
      echo "[oracle-scan] pnpm version mismatch (expected $expected_pnpm, found ${current_pnpm:-unknown})"
      if command -v corepack >/dev/null 2>&1; then
        corepack prepare "pnpm@$expected_pnpm" --activate >/dev/null 2>&1 || true
        current_pnpm="$(pnpm --version 2>/dev/null || true)"
      fi
      if [[ "$current_pnpm" != "$expected_pnpm" ]]; then
        echo "error: pnpm $expected_pnpm required; install or activate it before running full-scan" >&2
        exit 1
      fi
    fi
  fi
}

echo "[oracle-scan] running go test"
go test ./... -count=1

echo "[oracle-scan] running go vet"
go vet ./...

if ! command -v gosec >/dev/null 2>&1; then
  echo "[oracle-scan] installing gosec"
  go install github.com/securego/gosec/v2/cmd/gosec@v2.22.9
fi

if ! command -v govulncheck >/dev/null 2>&1; then
  echo "[oracle-scan] installing govulncheck"
  go install golang.org/x/vuln/cmd/govulncheck@v1.1.4
fi

GO_BIN_DIR="$(go env GOPATH)/bin"

echo "[oracle-scan] running gosec with tracked suppressions"
"$GO_BIN_DIR/gosec" -track-suppressions ./...

echo "[oracle-scan] running govulncheck"
"$GO_BIN_DIR/govulncheck" ./...

WORKER_DIR="$ROOT_DIR/../cloudflare-worker"
if [ -f "$WORKER_DIR/package.json" ]; then
  ensure_worker_toolchain

  echo "[oracle-scan] ensuring cloudflare-worker deps are installed"
  pnpm -C "$WORKER_DIR" install --frozen-lockfile

  echo "[oracle-scan] running cloudflare-worker tests"
  pnpm -C "$WORKER_DIR" test

  echo "[oracle-scan] running cloudflare-worker lint"
  pnpm -C "$WORKER_DIR" lint
fi

echo "[oracle-scan] complete"
