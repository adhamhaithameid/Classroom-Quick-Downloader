#!/usr/bin/env bash
set -euo pipefail

WORKER_BASE_URL="${WORKER_BASE_URL:-}"
ORACLE_BASE_URL="${ORACLE_BASE_URL:-}"
WEBSITE_URL="${WEBSITE_URL:-}"
SITE_ORIGIN="${SITE_ORIGIN:-}"

if [[ -z "$WORKER_BASE_URL" || -z "$ORACLE_BASE_URL" || -z "$WEBSITE_URL" ]]; then
  cat >&2 <<'EOF'
Missing required environment variables.
Required:
  WORKER_BASE_URL   e.g. https://cqd-analytics.adhamhaithameid.workers.dev
  ORACLE_BASE_URL   e.g. https://oracle.example.com
  WEBSITE_URL       e.g. https://classroom-quick-downloader-website.pages.dev
Optional:
  SITE_ORIGIN       defaults to WEBSITE_URL origin
EOF
  exit 1
fi

if [[ -z "$SITE_ORIGIN" ]]; then
  SITE_ORIGIN="$WEBSITE_URL"
fi

strip_trailing_slash() {
  local value="$1"
  echo "${value%/}"
}

WORKER_BASE_URL="$(strip_trailing_slash "$WORKER_BASE_URL")"
ORACLE_BASE_URL="$(strip_trailing_slash "$ORACLE_BASE_URL")"
WEBSITE_URL="$(strip_trailing_slash "$WEBSITE_URL")"
SITE_ORIGIN="$(strip_trailing_slash "$SITE_ORIGIN")"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd node

check_code() {
  local url="$1"
  local expected="$2"
  local label="$3"
  local code
  code="$(curl -sS -o /tmp/cqd_phase13_smoke_body -w "%{http_code}" "$url" || true)"
  if [[ "$code" != "$expected" ]]; then
    echo "[smoke] FAIL: $label expected $expected got $code" >&2
    cat /tmp/cqd_phase13_smoke_body >&2 || true
    exit 1
  fi
  echo "[smoke] PASS: $label ($code)"
}

check_auth_gate() {
  local url="$1"
  local label="$2"
  local code
  code="$(curl -sS -o /tmp/cqd_phase13_smoke_body -w "%{http_code}" "$url" || true)"
  if [[ "$code" != "401" && "$code" != "403" ]]; then
    echo "[smoke] FAIL: $label expected 401/403 got $code" >&2
    cat /tmp/cqd_phase13_smoke_body >&2 || true
    exit 1
  fi
  echo "[smoke] PASS: $label auth-gated ($code)"
}

check_schema_v1() {
  local url="$1"
  local label="$2"
  local payload
  payload="$(curl -fsS "$url")"
  if ! echo "$payload" | node -e '
    let raw="";
    process.stdin.on("data", (c) => raw += c);
    process.stdin.on("end", () => {
      const data = JSON.parse(raw);
      if (data?.schemaVersion !== "1") process.exit(1);
    });
  '; then
    echo "[smoke] FAIL: $label missing schemaVersion=1" >&2
    echo "$payload" >&2
    exit 1
  fi
  echo "[smoke] PASS: $label schemaVersion=1"
}

check_optional_schema_v1() {
  local url="$1"
  local label="$2"
  local code
  code="$(curl -sS -o /tmp/cqd_phase13_smoke_body -w "%{http_code}" "$url" || true)"
  if [[ "$code" == "200" ]]; then
    local payload
    payload="$(cat /tmp/cqd_phase13_smoke_body)"
    if ! echo "$payload" | node -e '
      let raw="";
      process.stdin.on("data", (c) => raw += c);
      process.stdin.on("end", () => {
        const data = JSON.parse(raw);
        if (data?.schemaVersion !== "1") process.exit(1);
      });
    '; then
      echo "[smoke] FAIL: $label returned 200 but missing schemaVersion=1" >&2
      echo "$payload" >&2
      exit 1
    fi
    echo "[smoke] PASS: $label schemaVersion=1"
    return
  fi
  if [[ "$code" == "404" ]]; then
    echo "[smoke] WARN: $label not exposed on worker (404); continuing because Oracle is the read source of truth."
    return
  fi
  echo "[smoke] FAIL: $label expected 200 or 404 got $code" >&2
  cat /tmp/cqd_phase13_smoke_body >&2 || true
  exit 1
}

check_worker_ingest_contract() {
  local response
  response="$(curl -sS -X POST "$WORKER_BASE_URL/api/public/website/events" \
    -H "Origin: $SITE_ORIGIN" \
    -H "Content-Type: application/json" \
    -H "X-Requested-With: XMLHttpRequest" \
    --data '{"schemaVersion":"2","sessionId":"phase13-smoke","pagePath":"/smoke","events":[{"eventId":"invalid-schema","eventType":"cta","action":"install_click","placement":"phase13_smoke"}]}')"
  if ! echo "$response" | node -e '
    let raw="";
    process.stdin.on("data", (c) => raw += c);
    process.stdin.on("end", () => {
      const data = JSON.parse(raw);
      if (data?.ok !== false) process.exit(1);
      if (data?.schemaVersion !== "1") process.exit(1);
      if (!data?.error?.code) process.exit(1);
    });
  '; then
    echo "[smoke] FAIL: worker ingest error envelope is not compliant" >&2
    echo "$response" >&2
    exit 1
  fi
  echo "[smoke] PASS: worker ingest contract returns structured schemaVersion=1 error envelope"
}

echo "[smoke] Website availability"
check_code "$WEBSITE_URL/" "200" "website root"

echo "[smoke] Worker checks"
check_code "$WORKER_BASE_URL/health" "200" "worker health"
check_auth_gate "$WORKER_BASE_URL/admin/website/status" "worker admin auth gate"
check_optional_schema_v1 "$WORKER_BASE_URL/api/public/website/snapshot" "worker snapshot compatibility route"
check_worker_ingest_contract

echo "[smoke] Oracle checks"
check_code "$ORACLE_BASE_URL/health" "200" "oracle health"
check_auth_gate "$ORACLE_BASE_URL/api/admin/website/state" "oracle admin auth gate"
check_schema_v1 "$ORACLE_BASE_URL/api/public/website/snapshot" "oracle snapshot"

echo "[smoke] Website ingest checks"
SMOKE_EVENT_ID="smoke-$(date +%s)"
INGEST_RESPONSE="$(curl -fsS -X POST "$WORKER_BASE_URL/api/public/website/events" \
  -H "Origin: $SITE_ORIGIN" \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: XMLHttpRequest" \
  --data "{\"schemaVersion\":\"1\",\"sessionId\":\"phase13-smoke\",\"pagePath\":\"/smoke\",\"events\":[{\"eventId\":\"$SMOKE_EVENT_ID\",\"eventType\":\"cta\",\"action\":\"install_click\",\"placement\":\"phase13_smoke\"}]}")"

if ! echo "$INGEST_RESPONSE" | node -e '
  let raw="";
  process.stdin.on("data", (c) => raw += c);
  process.stdin.on("end", () => {
    const data = JSON.parse(raw);
    if (data?.ok !== true) process.exit(1);
  });
'; then
  echo "[smoke] FAIL: website ingest did not return ok=true" >&2
  echo "$INGEST_RESPONSE" >&2
  exit 1
fi
echo "[smoke] PASS: website ingest ok=true"

echo "[smoke] Phase 13 smoke checks passed."
