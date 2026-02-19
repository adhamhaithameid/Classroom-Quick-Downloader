# Security & Remote Configuration

> Last updated: 2026-02-19 (v1.3.5).

> Update (2026-02-15): Latest changes include CI coverage-gate hardening for extension analytics storage migration fallback, popup stats race-condition guards, structured step-up auth error handling in Oracle dashboard, and backend/worker auth-security hardening. See /CHANGELOG.md for details.

## System Timing

All analytics systems now work together in harmony:

| Time (UTC) | System | Action |
|------------|--------|--------|
| 00:00 | Worker | Alarm → flush buffer to Oracle |
| 00:15 | Oracle | Scheduler → flush DB to Google Sheets |
| 01:00–03:00 | Extension | Randomized daily flush window (configurable) |
| Ongoing | Extension | Stale events (≥24h) or time-based flush (if enabled) |

---

## Remote Config (Controllable from Dashboard)

| Setting | Default | Description |
|---------|---------|-------------|
| `batchSize` | 50 | Events per request |
| `maxDailyRequests` | 50 | Max requests/day |
| `maxRetry` | 5 | Retries before drop |
| `maxEventsPerRequest` | 5000 | Max events in one Oracle flush |
| `maxBufferSize` | 50000 | Max events in Worker buffer |
| `flushMode` | `next_day` | When to send |
| `timeFlushMinutes` | {low:1440, mid:1440, high:1440} | Time-based intervals |
| `dailyFlushWindowStartUtc` | 1 | Daily window start hour (UTC) |
| `dailyFlushWindowMinutes` | 120 | Daily window length (minutes) |
| `cancelHoldDelayMs` | 1000 | UI safety delay before cancel |

---

## Admin Endpoints

### Get Current Config + Stats
```bash
curl https://your-worker.workers.dev/stats
```

Returns: `remoteConfig`, `bufferStatus`, `nextAlarmAt`, `requestsToday`, etc.

### Update Config
```bash
curl -X POST https://your-worker.workers.dev/admin/update-config \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -d '{"batchSize": 25, "maxDailyRequests": 30}'
```

### Emergency Kill Switch
```bash
curl -X POST .../admin/cut-power -H "X-Admin-Secret: SECRET"
curl -X POST .../admin/restore-power -H "X-Admin-Secret: SECRET"
```

---

## Environment Variables

### Worker
- `DO_SHARED_SECRET`: Admin auth secret
- `DASHBOARD_PASSWORD`: Worker dashboard login secret (separate from `DO_SHARED_SECRET`)
- `ORACLE_ENDPOINT`: Oracle backend URL
- `DANGER_PASSWORD`: Danger Zone password

### Oracle
- `SHEETS_ID`: Google Sheets spreadsheet ID
- `GOOGLE_CREDS_PATH`: Service account JSON path
- `KUMA_PUSH_URL`: Uptime Kuma push URL (optional)
- `ARCHIVER_PATH`: Path to archiver binary
- `ARCHIVER_SHARED_SECRET`: Secret header for the archiver (required when dashboard auth is enabled)
- `ALLOW_LOOPBACK_BYPASS`: Set to `true` to allow loopback auth bypass (dev only)
- `ALLOW_EMPTY_DASHBOARD_PASSWORD`: Set to `true` to allow an empty dashboard password (dev only)
