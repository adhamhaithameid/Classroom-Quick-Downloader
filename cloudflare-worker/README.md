# Cloudflare Worker – CQD Analytics

This package is the **backend analytics service** for Classroom Quick Downloader.

Stack:

- **Cloudflare Worker** (`cqd-analytics`) – HTTP entrypoint
- **Durable Object** (`DownloadsDurable`) – durable counters + buffered raw events
- Optional **Oracle VM** backend for batch storage

---

## Endpoints Overview

All paths are relative to your Worker URL, e.g.:

```text
 https://cqd-analytics.adhamhaithameid.workers.dev
```

1. POST /track – Ingestion

Called by the extension.

CORS enabled.

Accepts:

```
{
  "events": [
    {
      "status": "success",          // "success" | "fail"
      "file_type": "pdf",           // e.g. "pdf", "pptx"
      "browser": "chrome",
      "os": "mac",
      "ext_version": "0.0.0",
      "duration_ms": 1200,
      "bypass_used": false,
      "error_type": null,
      "language": "en-US",
      "timestamp": 1765092900685
    }
  ]
}
```

Each event = one file with a final status.

The Durable Object updates:

totalEvents = success + fail

totalDownloads = success

totalSuccess

totalFail

plus breakdowns by type, browser, OS, etc.

2. GET /stats – JSON Stats

Returns the full state:

```
{
  "ok": true,
  "totalEvents": 98,
  "totalDownloads": 95,
  "totalSuccess": 95,
  "totalFail": 3,
  "pendingEvents": 98,
  "lastEventAt": 1765092900685,
  "lastFlushAt": null,
  "counters": {
    "byStatus": { "success": 95, "fail": 3 },
    "byType": { "pdf": 30, "pptx": 65 },
    "byBrowser": { "chrome": 98 },
    "byOs": { "mac": 98 },
    "byExtVersion": { "0.0.0": 98 },
    "byLanguage": { "en-US": 98 }
  }
}
```

Useful for:

Debugging numeric drift.

Building a custom admin UI later.

3. GET /health – Health Snapshot

Cheaper JSON version, suitable for monitoring:

```
{
  "ok": true,
  "totalEvents": 98,
  "totalDownloads": 95,
  "totalSuccess": 95,
  "totalFail": 3,
  "pendingEvents": 98,
  "lastEventAt": 1765092900685,
  "lastFlushAt": null
}
```

4. GET / – Mini Dashboard (GUI)

Small HTML dashboard:

Shows:

- Total Downloads (success)

- Total Success

- Total Fail

- Total Events

- Pending buffer size

- Last event time

- Last flush time

- Breakdown by type + status

- Auto-refreshes every 5 seconds.

Visit in browser:
```
https://cqd-analytics.adhamhaithameid.workers.dev/
```

🔧 Debugging Endpoints (for now)

You can keep these while you’re building and remove/protect them later.

1. POST /debug/reset – Reset All Counters

Resets all counters and clears the buffer in the Durable Object.

URL:
```
https://cqd-analytics.<your-workers-subdomain>.workers.dev/debug/reset
```

Example (terminal):
```
curl -X POST \
  "https://cqd-analytics.<your-workers-subdomain>.workers.dev/debug/reset"
```

Response:

{ "ok": true, "reset": true }


Use this when you want to:

Zero everything.

Perform a clean test (e.g. click Download All for 5 files).

Compare the new /stats output vs what you expect.

⚠ In production, you should:

Protect this endpoint with a secret header, OR

Remove it entirely.

2. Quick manual checks

See raw stats:
```
https://cqd-analytics.<your-workers-subdomain>.workers.dev/stats
```

Check health:
```
https://cqd-analytics.<your-workers-subdomain>.workers.dev/health
```

Open GUI dashboard:
```
https://cqd-analytics.<your-workers-subdomain>.workers.dev/
```