#!/usr/bin/env bash
set -euo pipefail

echo "Safari support is temporarily disabled."
echo "This script is retained for future re-enable only."
exit 1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXTENSION_DIR="${ROOT_DIR}/extension"
PROJECT_DIR="${PROJECT_DIR:-${EXTENSION_DIR}/.output/safari-xcode}"
DERIVED_DATA_DIR="${DERIVED_DATA_DIR:-${PROJECT_DIR}/DerivedData}"

SCHEME="${SAFARI_SCHEME:-Classroom Quick Downloader Safari (macOS)}"
CONFIGURATION="${SAFARI_CONFIGURATION:-Debug}"

echo "[1/5] Build Safari web extension package"
pnpm -C "${EXTENSION_DIR}" run safari

echo "[2/5] Convert extension to Xcode project"
bash "${SCRIPT_DIR}/prepare-xcode-project.sh"

PROJECT_FILE="$(find "${PROJECT_DIR}" -maxdepth 2 -type d -name '*.xcodeproj' | head -n 1 || true)"
if [[ -z "${PROJECT_FILE}" ]]; then
  echo "Error: could not find generated .xcodeproj under ${PROJECT_DIR}" >&2
  exit 1
fi

echo "[3/5] Compile macOS Safari container app"
xcodebuild \
  -project "${PROJECT_FILE}" \
  -scheme "${SCHEME}" \
  -configuration "${CONFIGURATION}" \
  -derivedDataPath "${DERIVED_DATA_DIR}" \
  CODE_SIGNING_ALLOWED=NO \
  build >/tmp/cqd_safari_xcodebuild.log 2>&1 || {
    echo "Xcode build failed. Last 120 lines:" >&2
    tail -n 120 /tmp/cqd_safari_xcodebuild.log >&2
    exit 1
  }

APP_PATH="$(find "${DERIVED_DATA_DIR}/Build/Products/${CONFIGURATION}" -maxdepth 1 -type d -name 'Classroom Quick Downloader Safari.app' | head -n 1 || true)"
if [[ -z "${APP_PATH}" ]]; then
  echo "Error: built app not found under ${DERIVED_DATA_DIR}/Build/Products/${CONFIGURATION}" >&2
  exit 1
fi

echo "[4/5] Launch Safari container app"
open "${APP_PATH}"

if [[ "${OPEN_SAFARI_EXTENSIONS:-1}" == "1" ]]; then
  echo "[5/5] Open Safari extension settings"
  osascript <<'APPLESCRIPT'
tell application "Safari"
  activate
  open location "safari://extensions"
end tell
APPLESCRIPT
fi

echo
echo "Local Safari flow completed."
echo "App path: ${APP_PATH}"
echo "If extension is still disabled, enable it in Safari > Settings > Extensions."
