# CQD Analytics – Cloudflare Worker + Durable Object

This package is the **backend analytics layer** for the Classroom Quick Downloader (CQD) extension.

It performs three main functions:

1. **Ingest:** Accepts batched analytics events from the extension via `POST /track`.
2. **Aggregate:** Uses a **Durable Object** (`DownloadsDurable`) to maintain fast, persistent statistics.
3. **Visualize:** Exposes a mini debugging dashboard and JSON endpoints for inspection.

### Architecture in one line

> **Extension** (`analytics.ts` + `background.ts`) → **Cloudflare Worker** (`index.ts`) → **Durable Object** (`DownloadsDurable`)

## 1. Repository Layout

### Package Structure

```
cloudflare-worker/
├── README.md              # (this file)
├── wrangler.toml          # Worker + Durable Object config
├── package.json           # Scripts, dev dependencies
├── tsconfig.json          # TypeScript config
└── src/
    ├── index.ts           # Worker entrypoint (routes + DO export)
    ├── downloads_do.ts    # Durable Object implementation
    ├── dashboard.ts       # HTML dashboard renderer
    └── types.ts           # Shared types/interfaces (stats, counters, etc.)
```

### Monorepo Context

```
/Classroom-Quick-Downloader/
├── cloudflare-worker/         # ⇐ (This package)
├── extension/                 # WXT MV3 extension
├── oracle-backend/            # (Future) Long-term storage API
├── landing-site/              # Marketing / Docs site
└── tools/                     # Scripts & helpers
```

## 2. High-Level Architecture

```
graph LR
    Ext[Extension Background] -->|Batch POST| Worker[Cloudflare Worker]
    Worker -->|Forward Request| DO[Durable Object]
    DO -->|Update| Mem[In-Memory Counters]
    DO -->|Persist| Storage[DO Storage]
    User[Developer] -->|GET /| Dash[HTML Dashboard]
    Dash -->|Fetch| DO
```

### 2.1 Client-Side (Extension)

**`extension/entrypoints/background.ts`** Tracks real download completions via `chrome.downloads.onChanged`.

* **Success:**`state.complete` → `status: "success"`
* **Fail:**`state.interrupted` → `status: "fail"`

**`extension/entrypoints/utils/analytics.ts`** Buffers events in `chrome.storage.local` instead of sending one HTTP call per download.

* **Flush Condition:** Queue size ≥ 50 events OR Queue is "old enough".
* **Result:** Cloudflare receives \~1 POST per 50 downloads per user.

**Payload Example:**

```
{
  "clientId": "cid_xxx",
  "browser": "chrome",
  "os": "mac",
  "language": "en-US",
  "extVersion": "1.2.3",
  "events": [
    { "type": "pdf", "status": "success", "source": "download_all", "ts": 1765092900685 },
    { "type": "pptx", "status": "fail", "source": "single", "ts": 1765092910000 }
  ]
}
```

### 2.2 Cloudflare Worker

**`src/index.ts`** The main entrypoint. It routes incoming requests (`fetch`) and gets the stub for the `DownloadsDurable` object. It proxies endpoints (`/track`, `/stats`) to the DO and serves the HTML dashboard.

### 2.3 Durable Object

**`src/downloads_do.ts`** Holds the persistent analytics state.

* **State Variables:**`totalEvents`, `totalDownloads` (success only), `pendingEvents`.
* **Counters:**
  * `byStatus`: `{ success, fail }`
  * `byType`: `{ pdf: N, pptx: M, ... }`
  * `byBrowser`: `{ chrome: N, firefox: M, ... }`
  * `byOs`: `{ mac: N, windows: M, ... }`
  * `byExtVersion`: `{ "0.0.0": N, ... }`
  * `byLanguage`: `{ "en-US": N, ... }`

**Binding & Migration:** The Worker always talks to a single instance ID (`DownloadsStats`). If scale requires it later, we can shard by hashing `fileType + browser`.

## 3. Worker API Endpoints

### 3.1 `POST /track` (Ingest)

Called by the extension's analytics utility.

* **Status:**`202 Accepted`
* **Behavior:** Queues events into the DO for processing. It does not wait for aggregation to finish before responding.

### 3.2 `GET /stats` (JSON Data)

Called by the dashboard or external tools. This is the **source of truth** for live analytics.

**Response Example:**

```
{
  "ok": true,
  "totalEvents": 69,
  "totalDownloads": 67,
  "pendingEvents": 68,
  "lastEventAt": 1765092900685,
  "counters": {
    "byStatus": { "success": 66, "fail": 2 },
    "byType": { "pdf": 16, "pptx": 52 },
    "byBrowser": { "chrome": 68 }
  }
}
```

### 3.3 `GET /health` (Probe)

Simple health check returning `200 OK` and `{ "ok": true }`.

### 3.4 `GET /` (Dashboard)

Renders the HTML dashboard (`src/dashboard.ts`).

* **Visuals:** Clean layout, dashed separators, "Last Refreshed" indicator.
* **Data:** Totals, Buffer size, Breakdowns (Type, Status, Browser, OS).
* **Actions:** Manual "Reload Stats" button (no auto-polling).

### 3.5 `POST /debug/flush` (Optional)

Manually triggers the DO to flush its buffer to the Oracle backend (if configured).

## 4. Configuration

### 4.1 Wrangler Config (`wrangler.toml`)

```
name = "cqd-analytics"
main = "src/index.ts"
compatibility_date = "2024-10-01"

# ⚠️ Fill this with your real ID (Safe to commit)
account_id = "<YOUR_ACCOUNT_ID>"

[vars]
ORACLE_ENDPOINT = ""        # URL for future backend
DO_SHARED_SECRET = ""       # Shared secret for backend auth
MAX_BATCH_EVENTS = "10000"  # Flush threshold

[[durable_objects.bindings]]
name = "DOWNLOADS_DO"
class_name = "DownloadsDurable"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["DownloadsDurable"]
```

### 4.2 Cloudflare Requirements

1. **Subdomain:** Ensure you have a `*.workers.dev` subdomain active.
2. **Login:** Run `pnpm wrangler login`.
3. **Deploy:** The first deploy will create the SQLite-backed namespace via the `v1` migration.

## 5. Development Workflow

### 5.1 Install Dependencies

```
# Inside cloudflare-worker/
pnpm install
```

### 5.2 Local Development

```
pnpm dev
# Runs: wrangler dev
```

This starts Miniflare at `http://localhost:8787`.

* Visit `/` to see the dashboard.
* POST to `/track` to test ingestion.

### 5.3 Connecting Extension to Local Worker

To test the full flow locally:

1. Edit `extension/entrypoints/utils/analytics.ts`:
   ```
   const WORKER_URL = "http://localhost:8787/track";
   ```
2. Run the extension in dev mode.
3. Downloads will now POST to your local Miniflare instance.
4. **Revert** to the production URL before committing.

### 5.4 Deploy to Production

```
pnpm wrangler deploy
```


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
