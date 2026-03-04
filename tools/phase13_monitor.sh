#!/usr/bin/env bash
set -euo pipefail

WORKER_BASE_URL="${WORKER_BASE_URL:-}"
ORACLE_BASE_URL="${ORACLE_BASE_URL:-}"
DURATION_HOURS="${DURATION_HOURS:-24}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-300}"

if [[ -z "$WORKER_BASE_URL" || -z "$ORACLE_BASE_URL" ]]; then
  cat >&2 <<'EOF'
Missing required environment variables.
Required:
  WORKER_BASE_URL
  ORACLE_BASE_URL
Optional:
  DURATION_HOURS (default 24)
  INTERVAL_SECONDS (default 300)
EOF
  exit 1
fi

WORKER_BASE_URL="${WORKER_BASE_URL%/}"
ORACLE_BASE_URL="${ORACLE_BASE_URL%/}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd node

end_epoch=$(( $(date +%s) + DURATION_HOURS * 3600 ))
iteration=0

echo "[monitor] Starting phase-13 monitor for ${DURATION_HOURS}h (interval ${INTERVAL_SECONDS}s)"
echo "[monitor] Worker: ${WORKER_BASE_URL}"
echo "[monitor] Oracle: ${ORACLE_BASE_URL}"

while [[ "$(date +%s)" -lt "$end_epoch" ]]; do
  iteration=$((iteration + 1))
  now_iso="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  worker_payload="$(curl -fsS "${WORKER_BASE_URL}/pipeline-health")"
  oracle_snapshot="$(curl -fsS "${ORACLE_BASE_URL}/api/public/website/snapshot")"

  summary_line="$(node -e '
    const worker = JSON.parse(process.argv[1]);
    const snap = JSON.parse(process.argv[2]);
    const now = Date.now();
    const website = worker.websiteTelemetry || {};
    const pending = Number(website.pendingBatches ?? worker.pendingBatches ?? 0);
    const dlq = Number(website.deadLetterBatches ?? 0);
    const retry = Number(website.retryCount ?? worker.consecutiveFailures ?? 0);
    const lastAck = Number(website.lastBatchAckAtUtc ?? 0);
    const ackLagMin = lastAck > 0 ? Math.max(0, Math.floor((now - lastAck) / 60000)) : -1;
    const snapGenerated = Number(snap.generatedAt ?? 0);
    const snapLagMin = snapGenerated > 0 ? Math.max(0, Math.floor((now - snapGenerated) / 60000)) : -1;
    const status = String(worker.status || "unknown");
    const out = [
      `status=${status}`,
      `pending=${pending}`,
      `dlq=${dlq}`,
      `retry=${retry}`,
      `ackLagMin=${ackLagMin}`,
      `snapshotLagMin=${snapLagMin}`
    ].join(" ");
    process.stdout.write(out);
  ' "$worker_payload" "$oracle_snapshot")"

  echo "[monitor] #${iteration} ${now_iso} ${summary_line}"

  # Hard failure conditions aligned with runtime contract objectives.
  node -e '
    const worker = JSON.parse(process.argv[1]);
    const snap = JSON.parse(process.argv[2]);
    const now = Date.now();
    const website = worker.websiteTelemetry || {};
    const pending = Number(website.pendingBatches ?? worker.pendingBatches ?? 0);
    const dlq = Number(website.deadLetterBatches ?? 0);
    const retry = Number(website.retryCount ?? worker.consecutiveFailures ?? 0);
    const snapGenerated = Number(snap.generatedAt ?? 0);
    const snapLagMin = snapGenerated > 0 ? Math.floor((now - snapGenerated) / 60000) : Number.MAX_SAFE_INTEGER;

    const hardFail = (
      String(worker.status || "unknown") === "critical" ||
      dlq > 0 ||
      retry >= 5 ||
      pending >= 25 ||
      snapLagMin > 195
    );
    if (hardFail) process.exit(2);
  ' "$worker_payload" "$oracle_snapshot" || {
    echo "[monitor] FAIL: hard threshold breached (status/dlq/retry/pending/snapshot lag)." >&2
    exit 2
  }

  sleep "$INTERVAL_SECONDS"
done

echo "[monitor] Completed phase-13 monitoring window successfully."
