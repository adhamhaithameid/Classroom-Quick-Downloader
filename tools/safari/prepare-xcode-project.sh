#!/usr/bin/env bash
set -euo pipefail

echo "Safari support is temporarily disabled."
echo "This script is retained for future re-enable only."
exit 1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXTENSION_DIR="${ROOT_DIR}/extension"

WEBEXT_DIR="${WEBEXT_DIR:-${EXTENSION_DIR}/.output/safari-mv2}"
PROJECT_DIR="${PROJECT_DIR:-${EXTENSION_DIR}/.output/safari-xcode}"
APP_NAME="${SAFARI_APP_NAME:-Classroom Quick Downloader Safari}"
BUNDLE_ID="${SAFARI_BUNDLE_ID:-dev.adhamhaitham.cqd.safari}"
AUTO_BUILD="${AUTO_BUILD:-1}"
OPEN_XCODE="${OPEN_XCODE:-0}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: Safari packaging requires macOS (xcrun safari-web-extension-converter)." >&2
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Error: xcrun not found. Install Xcode Command Line Tools first." >&2
  exit 1
fi

if [[ "${SKIP_XCODE_FIRST_LAUNCH_CHECK:-0}" != "1" ]] && command -v xcodebuild >/dev/null 2>&1; then
  if ! xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then
    echo "Error: Xcode first-launch tasks are incomplete." >&2
    echo "Run this once, then retry:" >&2
    echo "  sudo xcodebuild -runFirstLaunch" >&2
    exit 1
  fi
fi

if [[ ! -d "${WEBEXT_DIR}" ]]; then
  if [[ "${AUTO_BUILD}" == "1" ]]; then
    echo "Safari build not found at ${WEBEXT_DIR}. Building extension first..."
    pnpm -C "${EXTENSION_DIR}" run safari
  else
    echo "Error: Safari build directory missing: ${WEBEXT_DIR}" >&2
    exit 1
  fi
fi

mkdir -p "${PROJECT_DIR}"

echo "Converting Web Extension to Xcode project..."
set +e
CONVERTER_OUTPUT="$(
  xcrun safari-web-extension-converter "${WEBEXT_DIR}" \
    --project-location "${PROJECT_DIR}" \
    --app-name "${APP_NAME}" \
    --bundle-identifier "${BUNDLE_ID}" \
    --force \
    --no-open 2>&1
)"
CONVERTER_STATUS=$?
set -e

if [[ ${CONVERTER_STATUS} -ne 0 ]]; then
  echo "${CONVERTER_OUTPUT}" >&2
  echo >&2
  echo "Safari converter failed." >&2
  echo "If this machine is new, run: sudo xcodebuild -runFirstLaunch" >&2
  echo "Then rerun: pnpm -C extension run safari:xcode" >&2
  exit ${CONVERTER_STATUS}
fi

echo "${CONVERTER_OUTPUT}"

echo
echo "Safari Xcode project prepared:"
echo "  ${PROJECT_DIR}"
echo
echo "Next:"
echo "1) Open the generated .xcodeproj in Xcode."
echo "2) Set Signing Team for app + extension targets."
echo "3) Run the container app once to register extension in Safari."
echo "4) Enable extension in Safari > Settings > Extensions."

if [[ "${OPEN_XCODE}" == "1" ]]; then
  PROJECT_FILE="$(find "${PROJECT_DIR}" -maxdepth 2 -type d -name '*.xcodeproj' | head -n 1 || true)"
  if [[ -n "${PROJECT_FILE}" ]]; then
    open "${PROJECT_FILE}"
  fi
fi
