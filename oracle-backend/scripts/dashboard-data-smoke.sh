#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD:-}"
COOKIE_JAR="${COOKIE_JAR:-$(mktemp)}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
  if [[ -z "${KEEP_COOKIE_JAR:-}" ]]; then
    rm -f "$COOKIE_JAR"
  fi
}
trap cleanup EXIT

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[FAIL] missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq

if [[ -z "$DASHBOARD_PASSWORD" ]]; then
  echo "[FAIL] set DASHBOARD_PASSWORD to run dashboard smoke checks" >&2
  exit 1
fi

pass() { echo "[PASS] $*"; }
fail() { echo "[FAIL] $*" >&2; exit 1; }

api_get() {
  local path="$1"
  local out="$2"
  local code
  code="$(curl -sS -o "$out" -w '%{http_code}' -b "$COOKIE_JAR" "$BASE_URL$path")"
  if [[ "$code" != "200" ]]; then
    echo "---- response body ($path) ----" >&2
    cat "$out" >&2 || true
    echo "--------------------------------" >&2
    fail "GET $path returned HTTP $code"
  fi
}

api_post_json() {
  local path="$1"
  local body="$2"
  local out="$3"
  local code
  local csrf_token=""
  csrf_token="$(awk '$6=="csrf_token"{print $7}' "$COOKIE_JAR" | tail -n1 || true)"
  local curl_args=(
    -sS -o "$out" -w '%{http_code}'
    -c "$COOKIE_JAR" -b "$COOKIE_JAR"
    -H 'Content-Type: application/json'
    -H 'X-Requested-With: XMLHttpRequest'
    -X POST "$BASE_URL$path"
    -d "$body"
  )
  if [[ -n "$csrf_token" ]]; then
    curl_args+=(-H "X-CSRF-Token: $csrf_token")
  fi
  code="$(curl "${curl_args[@]}")"
  if [[ "$code" != "200" ]]; then
    echo "---- response body ($path) ----" >&2
    cat "$out" >&2 || true
    echo "--------------------------------" >&2
    fail "POST $path returned HTTP $code"
  fi
}

# 1) Login
# Prime CSRF cookie first.
curl -sS -o /dev/null -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/"
api_post_json "/api/auth/login" "{\"password\":\"$DASHBOARD_PASSWORD\"}" "$TMP_DIR/login.json"
if [[ "$(jq -r '.ok // false' "$TMP_DIR/login.json")" != "true" ]]; then
  fail "login did not return ok=true"
fi
pass "authenticated"

# 2) Core dashboard data endpoints
api_get "/api/stats/summary" "$TMP_DIR/summary.json"
api_get "/api/stats/timeseries?range=all&granularity=day" "$TMP_DIR/timeseries_all.json"
api_get "/api/stats/breakdown?dimension=browser&from=1970-01-01&to=2100-01-01" "$TMP_DIR/breakdown_browser.json"
api_get "/api/admin/dashboard-links" "$TMP_DIR/dashboard_links.json"
api_get "/api/admin/deployments/targets" "$TMP_DIR/deployments_targets.json"
api_get "/api/admin/github/open-counts" "$TMP_DIR/github_counts.json"
api_get "/api/admin/creative/emails" "$TMP_DIR/creative_emails.json"
api_get "/api/admin/newsletter/subscribers" "$TMP_DIR/newsletter_subscribers.json"
api_get "/api/admin/oracle-logs?limit=20" "$TMP_DIR/oracle_logs.json"
api_get "/api/admin/alerts" "$TMP_DIR/alerts.json"
api_get "/api/admin/outbox/status" "$TMP_DIR/outbox_status.json"
api_get "/api/admin/flags" "$TMP_DIR/flags.json"

# 3) Schema sanity checks
jq -e '.ok == true and (.totalDownloads|type=="number") and (.totalSuccess|type=="number") and (.totalFail|type=="number")' "$TMP_DIR/summary.json" >/dev/null \
  || fail "/api/stats/summary shape check failed"
pass "summary endpoint shape"

jq -e '.ok == true and ((.points == null) or (.points|type=="array"))' "$TMP_DIR/timeseries_all.json" >/dev/null \
  || fail "/api/stats/timeseries shape check failed"
pass "timeseries endpoint shape"

jq -e '.ok == true and (.values|type=="array")' "$TMP_DIR/breakdown_browser.json" >/dev/null \
  || fail "/api/stats/breakdown shape check failed"
pass "breakdown endpoint shape"

jq -e '.ok == true and (.targets|type=="array") and ((.targets|length) >= 3)' "$TMP_DIR/deployments_targets.json" >/dev/null \
  || fail "/api/admin/deployments/targets missing expected targets"
pass "deployments targets shape"

jq -e '.ok == true and (.links|type=="object")' "$TMP_DIR/dashboard_links.json" >/dev/null \
  || fail "/api/admin/dashboard-links shape check failed"
pass "dashboard links shape"

jq -e '(.source|type=="string") and (.issuesKnown|type=="boolean") and (.prsKnown|type=="boolean") and (.branchesKnown|type=="boolean") and (.discussionsKnown|type=="boolean")' "$TMP_DIR/github_counts.json" >/dev/null \
  || fail "/api/admin/github/open-counts metadata check failed"
pass "github counters metadata"

# 4) Data-parity checks (proves values are generated from live storage, not UI constants)
summary_downloads="$(jq -r '.totalDownloads' "$TMP_DIR/summary.json")"
summary_success="$(jq -r '.totalSuccess' "$TMP_DIR/summary.json")"
summary_fail="$(jq -r '.totalFail' "$TMP_DIR/summary.json")"

series_downloads="$(jq -r '[((.points // [])[]?.downloads)] | add // 0' "$TMP_DIR/timeseries_all.json")"
series_success="$(jq -r '[((.points // [])[]?.success)] | add // 0' "$TMP_DIR/timeseries_all.json")"
series_fail="$(jq -r '[((.points // [])[]?.fail)] | add // 0' "$TMP_DIR/timeseries_all.json")"

if [[ "$summary_downloads" != "$series_downloads" ]]; then
  fail "download parity mismatch: summary=$summary_downloads timeseries=$series_downloads"
fi
if [[ "$summary_success" != "$series_success" ]]; then
  fail "success parity mismatch: summary=$summary_success timeseries=$series_success"
fi
if [[ "$summary_fail" != "$series_fail" ]]; then
  fail "fail parity mismatch: summary=$summary_fail timeseries=$series_fail"
fi
pass "summary vs timeseries parity"

# 5) Operational APIs return structured data
jq -e '.ok == true and (.logs|type=="array")' "$TMP_DIR/oracle_logs.json" >/dev/null \
  || fail "/api/admin/oracle-logs shape check failed"
jq -e '.ok == true and (.alerts|type=="array")' "$TMP_DIR/alerts.json" >/dev/null \
  || fail "/api/admin/alerts shape check failed"
jq -e '.ok == true' "$TMP_DIR/outbox_status.json" >/dev/null \
  || fail "/api/admin/outbox/status check failed"
jq -e '.ok == true and (.flags|type=="array")' "$TMP_DIR/flags.json" >/dev/null \
  || fail "/api/admin/flags shape check failed"
pass "admin operational APIs"

echo
pass "dashboard data smoke checks completed"
echo "Base URL: $BASE_URL"
echo "Summary totals: downloads=$summary_downloads success=$summary_success fail=$summary_fail"
echo "GitHub source: $(jq -r '.source' "$TMP_DIR/github_counts.json")"
