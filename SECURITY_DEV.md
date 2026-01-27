# Security & Remote Configuration

## System Timing

All analytics systems now work together in harmony:

| Time | System | Action |
|------|--------|--------|
| 12:00-12:59 AM | Extension | **BLACKOUT** - No requests to Cloudflare |
| 12:00 AM UTC | Worker | Alarm → flush buffer to Oracle |
| 12:15 AM | Oracle | Scheduler → flush DB to Google Sheets |
| 1:00 AM+ | Extension | Send ALL accumulated events |

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
- `ORACLE_ENDPOINT`: Oracle backend URL

### Oracle
- `SHEETS_ID`: Google Sheets spreadsheet ID
- `GOOGLE_CREDS_PATH`: Service account JSON path
- `KUMA_PUSH_URL`: Uptime Kuma push URL (optional)
- `ARCHIVER_PATH`: Path to archiver binary
