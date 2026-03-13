#!/usr/bin/env bash
set -euo pipefail

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

assert_https_url() {
  local label="$1"
  local url="$2"
  case "$url" in
    https://*) ;;
    *)
      echo "${label} must start with https:// (got: ${url})" >&2
      exit 1
      ;;
  esac
}

retry_http_code() {
  local url="$1"
  local expected="$2"
  local attempts="${3:-10}"
  local sleep_seconds="${4:-3}"

  local code="000"
  local i
  for i in $(seq 1 "$attempts"); do
    code="$(curl -sS -o /tmp/https-smoke-body.txt -w "%{http_code}" "$url" || true)"
    if [[ "$code" == "$expected" ]]; then
      return 0
    fi
    sleep "$sleep_seconds"
  done

  echo "HTTP check failed for ${url}: expected ${expected}, got ${code}" >&2
  cat /tmp/https-smoke-body.txt >&2 || true
  return 1
}

require_var ORACLE_ENDPOINT
require_var PUBLIC_WORKER_BASE_URL
require_var PUBLIC_SITE_URL

ORACLE_ENDPOINT="${ORACLE_ENDPOINT%/}"
PUBLIC_WORKER_BASE_URL="${PUBLIC_WORKER_BASE_URL%/}"
PUBLIC_SITE_URL="${PUBLIC_SITE_URL%/}"

assert_https_url "ORACLE_ENDPOINT" "$ORACLE_ENDPOINT"
assert_https_url "PUBLIC_WORKER_BASE_URL" "$PUBLIC_WORKER_BASE_URL"
assert_https_url "PUBLIC_SITE_URL" "$PUBLIC_SITE_URL"

echo "[https-smoke] worker health"
retry_http_code "${PUBLIC_WORKER_BASE_URL}/health" "200" "20" "3"
grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' /tmp/https-smoke-body.txt

echo "[https-smoke] worker snapshot"
snapshot_payload="$(curl -fsS "${PUBLIC_WORKER_BASE_URL}/api/public/website/snapshot")"
echo "${snapshot_payload}" | grep -Eq '"schemaVersion"[[:space:]]*:[[:space:]]*"1"'

echo "[https-smoke] worker ingest from allowed site origin"
site_origin="$(printf '%s' "${PUBLIC_SITE_URL}" | sed -E 's#(https?://[^/]+).*#\1#')"
event_id="https-smoke-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}-$(date +%s)"
ingest_payload="$(cat <<JSON
{"schemaVersion":"1","sessionId":"https-smoke","pagePath":"/ci/https-smoke","events":[{"eventId":"${event_id}","eventType":"cta","action":"install_click","placement":"hero_install"}]}
JSON
)"
ingest_response="$(curl -fsS -X POST "${PUBLIC_WORKER_BASE_URL}/api/public/website/events" \
  -H "Origin: ${site_origin}" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  --data "${ingest_payload}")"
echo "${ingest_response}" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'

echo "[https-smoke] oracle health"
retry_http_code "${ORACLE_ENDPOINT}/health" "200" "20" "3"
grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' /tmp/https-smoke-body.txt

echo "[https-smoke] oracle public snapshot"
oracle_snapshot_payload="$(curl -fsS "${ORACLE_ENDPOINT}/api/public/website/snapshot")"
echo "${oracle_snapshot_payload}" | grep -Eq '"schemaVersion"[[:space:]]*:[[:space:]]*"1"'

echo "[https-smoke] website health"
retry_http_code "${PUBLIC_SITE_URL}" "200" "20" "3"

echo "[https-smoke] all checks passed"
