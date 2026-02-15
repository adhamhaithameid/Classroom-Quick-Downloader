#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/extension/.output/chrome-mv3"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"
SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT

if [[ ! -d "${DIST_DIR}" ]]; then
  echo "Missing extension build output at ${DIST_DIR}." >&2
  echo "Run: pnpm --dir extension build" >&2
  exit 1
fi

cd "${DIST_DIR}" || exit 1
python3 -m http.server "${PORT}" --bind "${HOST}" > server.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID ${SERVER_PID} on ${HOST}:${PORT}"

ready=0
for _ in {1..20}; do
  if python3 - "${HOST}" "${PORT}" <<'PY' >/dev/null 2>&1
import sys
from urllib.request import urlopen

host = sys.argv[1]
port = sys.argv[2]
with urlopen(f"http://{host}:{port}/popup.html", timeout=1):
    pass
PY
  then
    ready=1
    break
  fi
  sleep 0.25
done

if [[ "${ready}" -ne 1 ]]; then
  echo "Verification server did not become ready in time." >&2
  exit 1
fi

cd "${ROOT_DIR}" || exit 1
python3 verification/verify_popup.py "http://${HOST}:${PORT}/popup.html"
echo "Popup verification completed successfully."
