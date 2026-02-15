#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/extension/.output/chrome-mv3"
PORT="${PORT:-8080}"

if [[ ! -d "${DIST_DIR}" ]]; then
  echo "Missing extension build output at ${DIST_DIR}." >&2
  echo "Run: pnpm --dir extension build" >&2
  exit 1
fi

cd "${DIST_DIR}" || exit 1
python3 -m http.server "${PORT}" > server.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID ${SERVER_PID} on port ${PORT}"

sleep 2

cd "${ROOT_DIR}" || exit 1
python3 verification/verify_popup.py "http://localhost:${PORT}/popup.html"
kill "${SERVER_PID}"
