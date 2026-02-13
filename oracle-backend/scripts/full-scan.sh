#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v go >/dev/null 2>&1; then
  echo "error: go is required"
  exit 1
fi

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

echo "[oracle-scan] running gosec (excluding G701 false positives)"
"$GO_BIN_DIR/gosec" -exclude=G701 ./...

echo "[oracle-scan] running govulncheck"
"$GO_BIN_DIR/govulncheck" ./...

echo "[oracle-scan] complete"
