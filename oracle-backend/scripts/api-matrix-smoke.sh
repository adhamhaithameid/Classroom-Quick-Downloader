#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD:-}"
SUPER_ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD:-}"
RUN_BASE_DASHBOARD_SMOKE="${RUN_BASE_DASHBOARD_SMOKE:-1}"
STRICT_CRITICAL="${STRICT_CRITICAL:-0}"
STRICT_HEALTH_READY="${STRICT_HEALTH_READY:-0}"
COOKIE_JAR="${COOKIE_JAR:-$(mktemp)}"
TMP_DIR="$(mktemp -d)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PASS_COUNT=0
SKIP_COUNT=0
CHECK_COUNT=0

cleanup() {
  if [[ "${KEEP_SMOKE_ARTIFACTS:-0}" != "1" ]]; then
    rm -rf "$TMP_DIR"
    if [[ -z "${KEEP_COOKIE_JAR:-}" ]]; then
      rm -f "$COOKIE_JAR"
    fi
  else
    echo "[INFO] kept smoke artifacts in: $TMP_DIR"
    echo "[INFO] cookie jar: $COOKIE_JAR"
  fi
}
trap cleanup EXIT

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[FAIL] missing required command: $1" >&2
    exit 1
  fi
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  CHECK_COUNT=$((CHECK_COUNT + 1))
  echo "[PASS] $*"
}

skip() {
  SKIP_COUNT=$((SKIP_COUNT + 1))
  CHECK_COUNT=$((CHECK_COUNT + 1))
  echo "[SKIP] $*"
}

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

slugify() {
  local v="$1"
  v="${v//\//_}"
  v="${v//\?/_}"
  v="${v//&/_}"
  v="${v//=/_}"
  v="${v//:/_}"
  echo "$v" | tr -cd 'A-Za-z0-9._-'
}

date_days_ago_utc() {
  local days="${1:-0}"
  if date -u -v-"${days}"d +%Y-%m-%d >/dev/null 2>&1; then
    date -u -v-"${days}"d +%Y-%m-%d
    return
  fi
  date -u -d "${days} day ago" +%Y-%m-%d
}

is_code_allowed() {
  local code="$1"
  local allowed_csv="$2"
  local token
  IFS=',' read -r -a _allowed <<< "$allowed_csv"
  for token in "${_allowed[@]}"; do
    token="$(echo "$token" | tr -d '[:space:]')"
    if [[ "$token" == "$code" ]]; then
      return 0
    fi
  done
  return 1
}

request_get() {
  local path="$1"
  local out="$2"
  curl -sS -o "$out" -w '%{http_code}' -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL$path"
}

request_get_with_headers() {
  local path="$1"
  local headers_out="$2"
  local body_out="$3"
  curl -sS -D "$headers_out" -o "$body_out" -w '%{http_code}' -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL$path"
}

request_post_json() {
  local path="$1"
  local body="$2"
  local out="$3"
  curl -sS -o "$out" -w '%{http_code}' \
    -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -H 'X-Requested-With: XMLHttpRequest' \
    -X POST "$BASE_URL$path" \
    -d "$body"
}

assert_json_expr() {
  local path="$1"
  local file="$2"
  local expr="$3"
  if ! jq -e "$expr" "$file" >/dev/null; then
    echo "---- response body ($path) ----" >&2
    cat "$file" >&2 || true
    echo "--------------------------------" >&2
    fail "$path JSON assertion failed: $expr"
  fi
}

run_get_json() {
  local path="$1"
  local expr="$2"
  local name="${3:-$path}"
  local out="$TMP_DIR/$(slugify "$path").json"
  local code
  code="$(request_get "$path" "$out")"
  if [[ "$code" != "200" ]]; then
    echo "---- response body ($path) ----" >&2
    cat "$out" >&2 || true
    echo "--------------------------------" >&2
    fail "GET $path returned HTTP $code"
  fi
  assert_json_expr "$path" "$out" "$expr"
  pass "$name"
}

run_post_json() {
  local path="$1"
  local body="$2"
  local expr="$3"
  local name="${4:-$path}"
  local out="$TMP_DIR/post_$(slugify "$path").json"
  local code
  code="$(request_post_json "$path" "$body" "$out")"
  if [[ "$code" != "200" ]]; then
    echo "---- response body ($path) ----" >&2
    cat "$out" >&2 || true
    echo "--------------------------------" >&2
    fail "POST $path returned HTTP $code"
  fi
  assert_json_expr "$path" "$out" "$expr"
  pass "$name"
}

run_post_json_guarded() {
  local path="$1"
  local body="$2"
  local expr="$3"
  local allowed_codes="$4"
  local name="$5"
  local out="$TMP_DIR/post_$(slugify "$path").json"
  local code
  code="$(request_post_json "$path" "$body" "$out")"

  if ! is_code_allowed "$code" "$allowed_codes"; then
    echo "---- response body ($path) ----" >&2
    cat "$out" >&2 || true
    echo "--------------------------------" >&2
    fail "POST $path returned HTTP $code (expected one of: $allowed_codes)"
  fi

  if [[ "$code" == "200" ]]; then
    assert_json_expr "$path" "$out" "$expr"
    pass "$name"
    return
  fi

  if [[ "$STRICT_CRITICAL" == "1" ]]; then
    echo "---- response body ($path) ----" >&2
    cat "$out" >&2 || true
    echo "--------------------------------" >&2
    fail "$name blocked by policy/feature flag in strict mode (HTTP $code)"
  fi

  local reason
  reason="$(jq -r '.error // .message // "policy_or_feature_restriction"' "$out" 2>/dev/null || echo "policy_or_feature_restriction")"
  skip "$name blocked (HTTP $code, $reason)"
}

require_cmd curl
require_cmd jq

if [[ -z "$DASHBOARD_PASSWORD" ]]; then
  fail "set DASHBOARD_PASSWORD to run API matrix smoke checks"
fi

if [[ "$RUN_BASE_DASHBOARD_SMOKE" == "1" ]]; then
  BASE_URL="$BASE_URL" DASHBOARD_PASSWORD="$DASHBOARD_PASSWORD" "$SCRIPT_DIR/dashboard-data-smoke.sh"
  pass "base dashboard-data smoke"
fi

today="$(date_days_ago_utc 0)"
yesterday="$(date_days_ago_utc 1)"
from1="$(date_days_ago_utc 7)"
to1="$yesterday"
from2="$(date_days_ago_utc 14)"
to2="$(date_days_ago_utc 8)"

run_get_json "/health" '.ok == true' "health"
run_get_json "/health/api" '.ok == true' "health api"
ready_out="$TMP_DIR/health_ready.json"
ready_code="$(request_get "/health/ready" "$ready_out")"
if [[ "$ready_code" == "200" ]]; then
  assert_json_expr "/health/ready" "$ready_out" '.ok == true' 
  pass "health ready"
elif [[ "$ready_code" == "503" ]]; then
  assert_json_expr "/health/ready" "$ready_out" '.ok == false and (.reasons|type=="array")'
  if [[ "$STRICT_HEALTH_READY" == "1" ]]; then
    echo "---- response body (/health/ready) ----" >&2
    cat "$ready_out" >&2 || true
    echo "---------------------------------------" >&2
    fail "health ready is failing and STRICT_HEALTH_READY=1"
  fi
  skip "health ready reports not-ready (503)"
else
  echo "---- response body (/health/ready) ----" >&2
  cat "$ready_out" >&2 || true
  echo "---------------------------------------" >&2
  fail "GET /health/ready returned unexpected HTTP $ready_code"
fi
health_db_out="$TMP_DIR/health_db.txt"
health_db_code="$(request_get "/health/db" "$health_db_out")"
if [[ "$health_db_code" != "200" ]]; then
  fail "GET /health/db returned HTTP $health_db_code"
fi
if [[ "$(cat "$health_db_out")" != "ok" ]]; then
  fail "/health/db did not return plain 'ok'"
fi
pass "health db"

run_get_json "/api/public/website/overview" '.ok == true and (.totals|type=="object") and (.installs|type=="object") and (.status|type=="object")' "public website overview"
run_get_json "/api/public/website/map" '.ok == true and .granularity == "country" and (.countries|type=="array")' "public website map"
run_get_json "/api/public/website/status" '.ok == true and (.status|type=="object")' "public website status"
run_get_json "/api/public/website/changelog" '.ok == true and (.entries|type=="array") and (.fullChangelogUrl|type=="string")' "public website changelog"
run_get_json "/api/public/website/uninstall" '.ok == true and (.stats|type=="object")' "public website uninstall stats"

# Prime cookies + CSRF preconditions for auth POST endpoints.
curl -sS -o /dev/null -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/"
login_payload="$(jq -cn --arg password "$DASHBOARD_PASSWORD" '{password:$password}')"
run_post_json "/api/auth/login" "$login_payload" '.ok == true' "auth login"
run_get_json "/api/auth/check" '.authenticated == true and .authRequired == true' "auth check"
run_get_json "/api/auth/stepup/check" '.ok == true and (.required|type=="boolean") and (.active|type=="boolean")' "step-up check"

metrics_headers="$TMP_DIR/metrics.headers"
metrics_body="$TMP_DIR/metrics.txt"
metrics_code="$(request_get_with_headers "/metrics" "$metrics_headers" "$metrics_body")"
if [[ "$metrics_code" != "200" ]]; then
  echo "---- response body (/metrics) ----" >&2
  cat "$metrics_body" >&2 || true
  echo "----------------------------------" >&2
  fail "GET /metrics returned HTTP $metrics_code"
fi
if ! grep -q "oracle_schema_drift_paths_total" "$metrics_body"; then
  fail "/metrics missing expected oracle_schema_drift_paths_total metric"
fi
pass "metrics endpoint"

run_get_json "/api/stats/summary" '.ok == true and (.totalDownloads|type=="number")' "stats summary"
run_get_json "/api/stats/timeseries?range=today&granularity=hour" '.ok == true and ((.points == null) or (.points|type=="array"))' "stats timeseries today/hour"
run_get_json "/api/stats/timeseries?range=all&granularity=day" '.ok == true and ((.points == null) or (.points|type=="array"))' "stats timeseries all/day"
run_get_json "/api/stats/breakdown?dimension=browser&from=1970-01-01&to=2100-01-01" '.ok == true and (.values|type=="array")' "stats breakdown browser"
run_get_json "/api/stats/comparison?from1=${from1}&to1=${to1}&from2=${from2}&to2=${to2}" '.ok == true' "stats comparison"
run_get_json "/api/stats/export?format=json&range=today&granularity=hour" '.ok == true and ((.points == null) or (.points|type=="array"))' "stats export json"

export_csv_headers="$TMP_DIR/export_csv.headers"
export_csv_body="$TMP_DIR/export_csv.csv"
export_csv_code="$(request_get_with_headers "/api/stats/export?format=csv&range=today&granularity=hour" "$export_csv_headers" "$export_csv_body")"
if [[ "$export_csv_code" != "200" ]]; then
  fail "GET /api/stats/export?format=csv returned HTTP $export_csv_code"
fi
if ! grep -qi '^content-type: text/csv' "$export_csv_headers"; then
  fail "stats export csv did not return text/csv content type"
fi
pass "stats export csv"

run_get_json "/api/deploy-status" 'type=="object"' "deploy status"
run_get_json "/api/pipeline/metrics" '.ok == true' "pipeline metrics"
run_get_json "/api/pipeline/failures" '.ok == true and (.recent|type=="array") and (.daily|type=="array")' "pipeline failures"

run_get_json "/api/admin/flags" '.ok == true and (.flags|type=="array")' "admin flags"
run_get_json "/api/admin/outbox/status" '.ok == true' "admin outbox status"
run_get_json "/api/admin/audit/verify-chain" '.ok == true' "admin audit chain"
run_get_json "/api/admin/alerts" '.ok == true and (.alerts|type=="array")' "admin alerts"
run_get_json "/api/admin/migrations/status" '.ok == true and (.sqlite.enabled == true)' "admin migrations status"
run_get_json "/api/admin/ha/status" '.ok == true' "admin ha status"
run_get_json "/api/admin/storage/status" '.ok == true and (.storage|type=="object")' "admin storage status"
run_get_json "/api/admin/dr/status" '.ok == true' "admin dr status"
run_get_json "/api/admin/dashboard-links" '.ok == true and (.links|type=="object")' "admin dashboard links"
run_get_json "/api/admin/github/open-counts" '(.source|type=="string") and (.issuesKnown|type=="boolean") and (.prsKnown|type=="boolean")' "admin github counters"
run_get_json "/api/admin/oracle-logs?limit=20" '.ok == true and (.logs|type=="array")' "admin oracle logs"
run_get_json "/api/admin/sheets/last-flush" '.ok == true and (.exists|type=="boolean")' "admin sheets last flush"
run_get_json "/api/admin/deployments/targets" '.ok == true and (.targets|type=="array") and (.aggregates|type=="object") and (.aggregates.usersTotal|type=="number") and (.aggregates.reviewsTotal|type=="number") and (.aggregates.browsers|type=="array")' "admin deployment targets"
run_get_json "/api/admin/creative/designs" '.ok == true and ((.designs|type=="array") or (.records|type=="array"))' "admin creative designs"
run_get_json "/api/admin/creative/emails" '.ok == true and ((.templates|type=="array") or (.records|type=="array"))' "admin creative emails"
run_get_json "/api/admin/newsletter/subscribers" '.ok == true and ((.subscribers|type=="array") or (.records|type=="array"))' "admin newsletter subscribers"
run_get_json "/api/admin/newsletter/campaigns" '.ok == true and ((.campaigns|type=="array") or (.records|type=="array"))' "admin newsletter campaigns"
run_post_json_guarded "/api/admin/deployments/sync" '{"dryRun":true}' '.ok == true and .dryRun == true' '200,403' "admin deployments sync dry-run"

run_get_json "/api/admin/records/list?type=deployment_target" '.ok == true and (.records|type=="array")' "records deployment_target"
run_get_json "/api/admin/records/list?type=deployment_update_sentence" '.ok == true and (.records|type=="array")' "records deployment_update_sentence"
run_get_json "/api/admin/records/list?type=extension_version_note" '.ok == true and (.records|type=="array")' "records extension_version_note"
run_get_json "/api/admin/records/list?type=creative_design" '.ok == true and (.records|type=="array")' "records creative_design"
run_get_json "/api/admin/records/list?type=creative_email_template" '.ok == true and (.records|type=="array")' "records creative_email_template"
run_get_json "/api/admin/records/list?type=newsletter_subscriber" '.ok == true and (.records|type=="array")' "records newsletter_subscriber"
run_get_json "/api/admin/records/list?type=newsletter_campaign" '.ok == true and (.records|type=="array")' "records newsletter_campaign"
run_get_json "/api/admin/records/list?type=website_user_changelog_entry" '.ok == true and (.records|type=="array")' "records website_user_changelog_entry"

stepup_required="$(jq -r '.required // false' "$TMP_DIR/_api_auth_stepup_check.json")"
if [[ "$stepup_required" != "true" ]]; then
  skip "critical matrix (step-up not required: feature_stepup_enforced=false)"
elif [[ -z "$SUPER_ADMIN_PASSWORD" ]]; then
  skip "critical matrix (set SUPER_ADMIN_PASSWORD to verify step-up and test critical dry-run endpoints)"
else
  run_post_json "/api/auth/stepup/start" '{}' '.ok == true and .required == true and (.challengeId|type=="string")' "step-up start"
  challenge_id="$(jq -r '.challengeId' "$TMP_DIR/post__api_auth_stepup_start.json")"
  verify_payload="$(jq -cn --arg challengeId "$challenge_id" --arg password "$SUPER_ADMIN_PASSWORD" '{challengeId:$challengeId,password:$password}')"
  run_post_json "/api/auth/stepup/verify" "$verify_payload" '.ok == true' "step-up verify"
  run_get_json "/api/auth/stepup/check" '.ok == true and .active == true' "step-up active"

  run_post_json_guarded "/api/admin/dr/drill" '{"dryRun":true}' '.ok == true and .dryRun == true' '200,403' "critical dr drill dry-run"
  run_post_json_guarded "/api/admin/retention/run" '{"dryRun":true,"policies":["pipeline_failure_logs","oracle_operation_logs","ingest_outbox_sent"]}' '.ok == true and .dryRun == true' '200,403' "critical retention dry-run"
  skip "critical backup run (not executed in smoke to avoid creating backup artifacts)"
  run_post_json_guarded "/api/admin/oracle-logs/delete-older" '{"days":30,"dryRun":true}' '.ok == true and .dryRun == true' '200,403' "critical oracle logs delete-older dry-run"
  run_post_json_guarded "/api/admin/oracle-logs/clear-all" '{"confirm":"CLEAR_ALL_LOGS","dryRun":true}' '.ok == true and .dryRun == true' '200,403' "critical oracle logs clear-all dry-run"
  run_post_json_guarded "/api/admin/danger/clear-data" '{"scope":"pipeline_failure_logs","dryRun":true}' '.ok == true and .dryRun == true' '200,403' "critical danger clear-data dry-run"
  run_post_json_guarded "/api/admin/sql/query" '{"sql":"SELECT id, ts_utc, level FROM oracle_operation_logs LIMIT 1"}' '.ok == true and (.rows|type=="array")' '200,403' "critical sql query"
  run_post_json_guarded "/api/admin/sql/exec" '{"sql":"DELETE FROM pipeline_failure_logs WHERE 1=0","dryRun":true}' '.ok == true and .dryRun == true' '200,403' "critical sql exec dry-run"
fi

echo
echo "[DONE] Oracle API matrix smoke completed"
echo "Base URL: $BASE_URL"
echo "Checks run: $CHECK_COUNT"
echo "Passed: $PASS_COUNT"
echo "Skipped: $SKIP_COUNT"
