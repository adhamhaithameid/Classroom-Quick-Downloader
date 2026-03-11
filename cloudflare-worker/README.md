# ⚡ CQD Analytics Worker

> Update (2026-02-28): Worker remains the public ingress/proxy for website telemetry and Oracle public website APIs; latest scan confirms clean dependency audit and passing strict suite in isolated runs.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)
![Durable Objects](https://img.shields.io/badge/Durable_Objects-Enabled-blueviolet)
![Version](https://img.shields.io/badge/v1.0-stable-success)

The **CQD Analytics Worker** is a high-performance, edge-deployed analytics ingestion service for the Classroom Quick Downloader browser extension. Built on **Cloudflare Workers** and **Durable Objects**, it captures download events from thousands of users worldwide and intelligently batches them before forwarding to an Oracle backend.

---

## 🌟 Why This Architecture?


| Feature                   | Benefit                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Edge Computing**        | Requests are handled at the closest datacenter to each user (~50ms global latency).                                           |
| **Low Latency Ingestion** | Fire-and-forget`POST /track` accepts events instantly; processing happens asynchronously.                                     |
| **Intelligent Batching**  | Events are buffered in a Durable Object and flushed in optimized batches, preventing database saturation.                     |
| **Pre-Aggregation**       | Calculates "Top Browser", "Top Country", and detailed breakdowns*before* sending to Oracle, saving bandwidth and backend CPU. |
| **Built-in Retry**        | Failed flushes trigger exponential backoff (1m → 5m → 15m → ... → 24h), ensuring no data is lost.                         |

---

## 📐 Architecture & Data Flow

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                   │
│                                                                               │
│   ┌────────────────────────────────────────────────────────────────────────┐  │
│   │         CQD Browser Extension (Chrome / Firefox / Edge)                │  │
│   │     Collects: file_type, browser, os, country, status, duration...     │  │
│   └───────────────────────────────────┬────────────────────────────────────┘  │
│                                       │                                       │
│                                       │ POST /track { events: [...] }         │
│                                       │ (Batched every N events or M minutes) │
└───────────────────────────────────────┼───────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKER (Edge)                              │
│                         ───────────────────────                               │
│   • Receives request at nearest datacenter (low latency)                      │
│   • Handles CORS for browser requests                                         │
│   • Extracts geo (country) from `request.cf` and injects `X-Geo-Country`      │
│   • Routes request to the Durable Object                                      │
│                                                                               │
│   Endpoints:                                                                  │
│     POST /track          - Ingest events                                      │
│     GET  /stats          - Dashboard stats                                    │
│     GET  /config         - Extension config                                   │
│     GET  /health         - Health check                                       │
│     GET  /public/site-metrics - Public website metrics snapshot                │
│     POST /admin/*        - Admin actions (force-flush, cut-power, etc.)       │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        │ stub.fetch(request)
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                   DURABLE OBJECT: DownloadsDurable                            │
│                   ────────────────────────────────                            │
│                                                                               │
│   STATE (Persistent):                                                         │
│     • buffer[]         - Raw events awaiting flush                            │
│     • counters         - Live aggregated stats (by browser, OS, country...)   │
│     • batchSeq         - Monotonic batch ID for idempotency                   │
│     • eventSeq         - Monotonic event sequence for end-to-end ACK          │
│     • committedSeq     - Highest sequence confirmed flushed to Oracle         │
│     • retryState       - Backoff tracking for failed flushes                  │
│     • reqCountToday    - Daily request quota tracking                         │
│     • pendingBatches   - Compacted batches waiting on Oracle                  │
│                                                                               │
│   BUFFERING:                                                                  │
│     • Events accumulate in `buffer[]`                                         │
│     • When buffer.length >= MAX_BATCH_EVENTS, flush triggers                  │
│                                                                               │
│   AGGREGATION (before sending to Oracle):                                     │
│     • Groups events by hour (TimeBuckets)                                     │
│     • Calculates: topBrowser, topOs, topCountry, topType                      │
│     • Builds full breakdown maps (browsers, countries, languages, etc.)       │
│                                                                               │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │
                                        │ POST /ingest-batch (aggregated JSON)
                                        │ Header: X-DO-SECRET
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                         ORACLE BACKEND (VM)                                   │
│                         ───────────────────                                   │
│   • Receives pre-aggregated batch                                             │
│   • Stores in SQLite (downloads_hourly, downloads_totals, batches...)         │
│   • Serves dashboard UI with historical charts                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Why Durable Objects?

1. **Strong Consistency**: All analytics requests for a given name ("downloads") are routed to the *same* DO instance globally. No split-brain, no race conditions.
2. **Persistent State**: The buffer survives Worker restarts. Events are never lost.
3. **Rate Limiting**: Batching prevents overwhelming the Oracle backend with high-frequency individual writes.
4. **Alarms**: Durable Objects have built-in scheduled alarms for retry logic with exponential backoff.

---

## 📁 Project Structure

```
cloudflare-worker/
├── src/
│   ├── index.ts          # Main Worker entrypoint: routing, CORS, DO proxy
│   ├── downloads_do.ts   # Durable Object: buffering, aggregation, Oracle flush
│   ├── types.ts          # TypeScript interfaces for all payloads
│   ├── dashboard.ts      # HTML rendering for the admin dashboard
│   └── assets.ts         # Base64-encoded logo/favicon for dashboard
├── wrangler.toml         # Cloudflare deployment configuration
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # You are here! 📍
```


| File              | Responsibility                                                                   |
| ----------------- | -------------------------------------------------------------------------------- |
| `index.ts`        | Routes requests, handles CORS preflight, extracts geo headers, proxies to DO.    |
| `downloads_do.ts` | The brain. Buffers events, aggregates stats, flushes to Oracle with retry logic. |
| `types.ts`        | Defines exact shapes for`StoredEvent`, `OracleBatch`, `StatsResponse`, etc.      |
| `dashboard.ts`    | Renders the live admin dashboard UI (inline CSS/JS, no external dependencies).   |
| `assets.ts`       | Contains base64 SVG/PNG for favicon and logo.                                    |

---

## ⚙️ Configuration & Environment

Static deployment config lives in `wrangler.toml`, but environment-specific
values should be injected outside the committed file:


| Variable              | Type                           | Description                                                                                         | Example                       |
| --------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------- |
| `ORACLE_ENDPOINT`     | local `.dev.vars` / CI variable | Base URL of the Oracle backend. Do not include `/ingest-batch`. The committed `wrangler.toml` keeps a placeholder value; inject the real value in local dev or CI. Use HTTPS in production. | `https://your-server.com` |
| `MAX_BATCH_EVENTS`    | `[vars]`                       | Maximum events per flush. When buffer reaches this size, a flush is triggered.                      | `10000`                       |
| `DO_SHARED_SECRET`    | **Secret**                     | Shared secret for admin endpoints + Oracle communication. **Do NOT put in `[vars]`**.              | —                            |
| `DASHBOARD_PASSWORD`  | **Secret**                     | Password for the Worker dashboard login/session tokens (separate from `DO_SHARED_SECRET`).         | —                            |
| `DANGER_PASSWORD`     | **Secret**                     | Password for Danger Zone actions.                                                                   | —                            |
| `SESSION_BINDING_MODE`| `[vars]` (optional)            | Session replay hardening mode: `off`, `optional`, or `strict` (coarse IP-prefix + UA fingerprint). | `strict`                     |
| `CORS_ALLOWED_ORIGINS`| `[vars]` (optional)            | Comma-separated allowed origins for non-admin protected routes (`/stats`, `/auth/verify-danger`) and website ingest writes (`/api/public/website/events`). Include your active website domains. | `https://classroom-quick-downloader-website.pages.dev,https://your-root-domain` |
| `ADMIN_CORS_ALLOWED_ORIGINS`| `[vars]` (optional)     | Comma-separated allowed origins for admin/debug routes only (`/admin/*`, `/debug/*`). No fallback to `CORS_ALLOWED_ORIGINS`. | `https://admin.example.com` |
| `DOWNLOADS_DO`        | `[[durable_objects.bindings]]` | The binding name for the Durable Object.                                                            | `DOWNLOADS_DO`                |

### 🔐 Setting `DO_SHARED_SECRET` Securely

The shared secret **must not** be committed to `wrangler.toml`. Use Wrangler's secret management:

```bash
# Set the secret interactively
pnpm exec wrangler secret put DO_SHARED_SECRET

# You'll be prompted to enter the value
# Enter your strong, random secret (e.g., from `openssl rand -hex 32`)
```

This secret must match the `DO_SHARED_SECRET` environment variable on your Oracle backend.

**Dashboard Login:** Use `DASHBOARD_PASSWORD` (separate secret) for Worker dashboard access.

---

## � Notification Rules Engine (v1.1)

The Worker also hosts a **Notification Rules Engine** to control the "Update Available" styling in the extension.

- **Admin Dashboard**: Manage styling rules via the `/stats` dashboard.
  - **Granular Control**: Target "All" versions or specific versions (e.g., `1.3.6`).
  - **Visual Effects**: Toggle "Glow" (Blue Pulse) or "Dot" (Red Indicator).
  - **Priority System**: Specific rules (e.g., `1.3.6`) override global wildcard rules (`all`).
- **Extension Integration**: The extension fetches these rules via `GET /config` and dynamically styles the version pill.

---

## �📡 API Reference

### `POST /track` — Ingest Events

The primary endpoint called by the browser extension. Accepts a batch of download events.

**Rate limiting:** The Durable Object applies a per-IP, per-minute request cap to prevent abuse.  
If the limit is exceeded, the endpoint returns `429` with `retryAfterSec`.

**Request:**

```bash
curl -X POST https://cqd-analytics.your-subdomain.workers.dev/track \
  -H "Content-Type: application/json" \
  -d '{
    "clientBatchId": "client-123",
    "events": [
      {
        "status": "success",
        "file_type": "pdf",
        "browser": "chrome",
        "os": "windows",
        "ext_version": "1.3.6",
        "duration_ms": 1500,
        "bypass_used": false,
        "language": "en",
        "country": "EG",
        "timestamp": 1702732800000
      },
      {
        "status": "fail",
        "file_type": "docx",
        "browser": "firefox",
        "os": "macos",
        "ext_version": "1.3.6",
        "duration_ms": 3000,
        "bypass_used": true,
        "language": "ar",
        "error_type": "AUTH_ALL_FAILED",
        "timestamp": 1702732801000
      }
    ]
  }'
```

**Response:**

```json
{
  "ok": true,
  "accepted": 2,
  "acceptedIds": ["ext-abc-123", "ext-def-456"],
  "duplicateIds": [],
  "invalidIds": [],
  "acceptedSeqs": [["ext-abc-123", 1201], ["ext-def-456", 1202]],
  "committedSeq": 1180,
  "clientBatchId": "client-123",
  "ackId": "ack-1702732800-xyz",
  "receivedAt": 1702732800000
}
```

`acceptedSeqs` lets the extension mark which events were accepted by the DO.
`committedSeq` indicates the latest sequence the Worker has safely flushed to Oracle.
`clientBatchId` echoes the extension's request ID so the client can verify the ACK.

**Event Schema (`StoredEvent`):**


| Field         | Type                    | Required | Description                                                |
| ------------- | ----------------------- | -------- | ---------------------------------------------------------- |
| `status`      | `"success"` \| `"fail"` | ✅       | Outcome of the download.                                   |
| `file_type`   | `string`                | ✅       | File extension (e.g., "pdf", "docx").                      |
| `browser`     | `string`                | ✅       | Browser name (e.g., "chrome", "firefox").                  |
| `os`          | `string`                | ✅       | Operating system (e.g., "windows", "macos").               |
| `ext_version` | `string`                | ✅       | Extension version (e.g., "1.3.6").                         |
| `duration_ms` | `number`                | ✅       | Time taken for the download attempt in milliseconds.       |
| `bypass_used` | `boolean`               | ✅       | Whether a bypass mechanism was used.                       |
| `language`    | `string`                | ✅       | User's browser language.                                   |
| `country`     | `string`                | ❌       | ISO country code. If missing, derived from Cloudflare geo. |
| `timestamp`   | `number`                | ✅       | Unix timestamp in milliseconds.                            |
| `error_type`  | `string`                | ❌       | Error code if`status` is `"fail"`.                         |
| `source`      | `string`                | ❌       | Origin tag (e.g., "download_all", "single").               |

---

### `GET /stats` — Dashboard Statistics

Returns the current aggregated stats from the Durable Object. Used by the admin dashboard.

**Request:**

```bash
curl https://cqd-analytics.your-subdomain.workers.dev/stats
```

**Response:**

```json
{
  "ok": true,
  "totalEvents": 12500,
  "totalDownloads": 12500,
  "totalSuccess": 11800,
  "totalFail": 700,
  "pendingEvents": 350,
  "lastEventAt": 1702732800000,
  "lastFlushAt": 1702732500000,
  "counters": {
    "byStatus": { "success": 11800, "fail": 700 },
    "byType": { "pdf": 8000, "docx": 3000, "png": 1500 },
    "byBrowser": { "chrome": 9000, "firefox": 2500, "edge": 1000 },
    "byOs": { "windows": 7000, "macos": 4000, "linux": 1500 },
    "byCountry": { "eg": 5000, "us": 3000, "sa": 2000 },
    "...": "..."
  },
  "quota": {
    "requestsToday": 1500,
    "quotaLevel": "BELOW_LIMITS",
    "modeLabel": "chill",
    "remoteEnabled": true,
    "batchSizeSuggestion": 50
  },
  "envSnapshot": {
    "maxBatchEvents": "10000",
    "oracleEndpoint": "https://..."
  },
  "deliveryMetrics": {
    "totals": {
      "accepted": 12500,
      "stored": 12500,
      "forwarded": 12490,
      "committed": 12490
    },
    "recent": [
      {
        "deliveryId": "dlv-do-seq101-50ev",
        "batchId": "do-seq101-50ev",
        "accepted": 50,
        "stored": 50,
        "forwarded": 50,
        "committed": 50,
        "status": "committed",
        "createdAt": 1702732800000,
        "updatedAt": 1702732810000
      }
    ]
  },
  "failureSink": {
    "totalRollups": 12,
    "unsentRollups": 0
  }
}
```

`deliveryMetrics` provides stage-chain observability (`accepted → stored → forwarded → committed`) for end-to-end verification.  
`failureSink` exposes structured Cloudflare DO failure rollups that are also forwarded to Oracle on successful flush.

---

### `GET /config` — Extension Configuration

Returns configuration hints for the browser extension (batch size, daily window, retry caps, etc.).

```bash
curl https://cqd-analytics.your-subdomain.workers.dev/config
```

**Response (example):**

```json
{
  "ok": true,
  "configVersion": 2,
  "batchSize": 50,
  "maxDailyRequests": 50,
  "maxRetry": 5,
  "maxEventsPerRequest": 5000,
  "flushMode": "next_day",
  "dailyFlushWindowStartUtc": 1,
  "dailyFlushWindowMinutes": 120,
  "timeFlushMinutes": { "low": 1440, "mid": 1440, "high": 1440 },
  "remoteEnabled": true,
  "remoteEnabledReason": "ok",
  "cancelHoldDelayMs": 1000,
  "allowLegacyEvents": true,
  "serverTimeUtc": 1702732800000,
  "committedSeq": 1180,
  "quota": { "requestsToday": 1500, "quotaLevel": "BELOW_LIMITS", "modeLabel": "chill", "remoteEnabled": true }
}
```

`serverTimeUtc` is used by the extension to correct clock drift and keep all scheduling in UTC.  
`allowLegacyEvents` temporarily accepts events missing IDs by assigning new IDs server-side (disable once all clients are updated).

---

### `GET /health` — Health Check

Simple health probe.

```bash
curl https://cqd-analytics.your-subdomain.workers.dev/health
```

### `GET /public/site-metrics` — Public Website Metrics Snapshot

Returns a sanitized, country-level aggregate payload for the user website.

- No raw IP data
- No admin-only counters
- Snapshot refresh windows (UTC): `03:00`, `06:00`, `09:00`, `12:00`, `15:00`, `18:00`, `21:00`
- CORS is wildcard (`Access-Control-Allow-Origin: *`) for safe public website reads.

**Request:**

```bash
curl https://cqd-analytics.your-subdomain.workers.dev/public/site-metrics
```

**Response (example):**

```json
{
  "ok": true,
  "source": "cloudflare-worker",
  "generatedAt": 1771700000000,
  "snapshotAtUtc": 1771699200000,
  "totals": {
    "downloads": 1200,
    "countries": 2
  },
  "countries": [
    { "countryCode": "US", "count": 700 },
    { "countryCode": "GB", "count": 500 }
  ],
  "schedule": {
    "refreshHoursUtc": [3, 6, 9, 12, 15, 18, 21],
    "activeHourUtc": 12,
    "isRefreshWindow": true,
    "lastRefreshAtUtc": 1771699200000,
    "nextRefreshAtUtc": 1771702800000
  }
}
```

```json
{ "ok": true, "pendingEvents": 350, "lastEventAt": 1702732800000, "lastFlushAt": 1702732500000 }
```

---

### `GET /pipeline-health` — Pipeline Backlog Health

Returns queue/flush health used by dashboard health cards and external monitoring.

```bash
curl https://cqd-analytics.your-subdomain.workers.dev/pipeline-health
```

> Alert dispatch is admin-gated. Public reads are allowed, but webhook notifications are triggered only when `X-Admin-Secret` is present.

---

### `POST /admin/force-flush` — Force Buffer Flush 🔒

Immediately flushes the event buffer to Oracle, bypassing the batch size threshold.

**Requires `X-Admin-Secret` header.**

```bash
curl -X POST https://cqd-analytics.your-subdomain.workers.dev/admin/force-flush \
  -H "X-Admin-Secret: YOUR_DO_SHARED_SECRET"
```

---

### `POST /admin/cut-power` — Disable Remote Analytics 🔒

Stops sending data to Oracle (useful for emergencies or maintenance).

```bash
curl -X POST https://cqd-analytics.your-subdomain.workers.dev/admin/cut-power \
  -H "X-Admin-Secret: YOUR_DO_SHARED_SECRET"
```

---

### `POST /admin/restore-power` — Re-enable Remote Analytics 🔒

Resumes sending data to Oracle.

```bash
curl -X POST https://cqd-analytics.your-subdomain.workers.dev/admin/restore-power \
  -H "X-Admin-Secret: YOUR_DO_SHARED_SECRET"
```

---

### `POST /admin/full-sync` — Full Buffer Sync 🔒

Iteratively flushes the entire buffer until empty or an error occurs.

```bash
curl -X POST https://cqd-analytics.your-subdomain.workers.dev/admin/full-sync \
  -H "X-Admin-Secret: YOUR_DO_SHARED_SECRET"
```

---

## 📊 The "Big JSON" Aggregation

Before sending data to Oracle, the Durable Object performs significant pre-aggregation to minimize payload size and backend processing:

**What Gets Calculated:**

1. **`timeBuckets[]`**: Events grouped by hour. Each bucket contains aggregated totals and dimension breakdowns for that hour.
2. **`summary`**: A single object aggregating *all* events in the batch:
   * `totals`: `totalEvents`, `totalSuccess`, `totalFail`
   * `browsers`: `{ "chrome": 900, "firefox": 100 }`
   * `os`: `{ "windows": 700, "macos": 300 }`
   * `countries`: `{ "eg": 500, "us": 300, ... }`
   * `languages`, `versions`, `types`, `errorReasons`
   * **`topBrowser`, `topOs`, `topCountry`, `topType`**: Pre-computed "winners".

**Example Final Payload to Oracle (`OracleBatch`):**

```json
{
  "batchId": "do-seq15-500ev",
  "generatedAt": 1702732800000,
  "timeZone": "UTC",
  "summary": {
    "totals": { "totalEvents": 500, "totalDownloads": 500, "totalSuccess": 480, "totalFail": 20 },
    "browsers": { "chrome": 350, "firefox": 100, "edge": 50 },
    "os": { "windows": 300, "macos": 150, "linux": 50 },
    "countries": { "eg": 200, "us": 150, "de": 100, "sa": 50 },
    "topBrowser": "chrome",
    "topOs": "windows",
    "topCountry": "eg",
    "topType": "pdf"
  },
  "timeBuckets": [
    {
      "bucketStart": "2024-12-16T10:00:00Z",
      "bucketEnd": "2024-12-16T11:00:00Z",
      "totals": { "totalEvents": 250, "totalSuccess": 240, "totalFail": 10 },
      "counters": { "byBrowser": { "chrome": 180, ... }, ... }
    }
  ],
  "doState": { "...": "DO health snapshot..." }
}
```

This design means Oracle receives an already-analyzed summary, drastically reducing database writes and query complexity.

---

## 🛠️ Setup & Development

### Prerequisites

* [Node.js](https://nodejs.org/) (v18+ recommended)
* [pnpm](https://pnpm.io/)
* [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`pnpm add -g wrangler`)

### Install Dependencies

```bash
cd cloudflare-worker
pnpm install
```

### Run Local Development Server

```bash
pnpm run dev
# Wrangler starts a local server, typically at http://localhost:8787
```

> **Note:** Durable Objects work locally, but `request.cf` (geo data) will not be populated. Country will fall back to "unknown" in local dev.

### Type Checking & Linting

```bash
pnpm run typecheck  # tsc --noEmit
pnpm run lint       # eslint
```

### Deploy to Production

```bash
# Ensure you're logged in
pnpm exec wrangler login

# Set secrets (only once, or when they change)
pnpm exec wrangler secret put DO_SHARED_SECRET

# Deploy
pnpm run deploy
```

The Worker will be deployed to `https://cqd-analytics.<your-subdomain>.workers.dev`.

---

## 🚨 Troubleshooting

### Error 1003: Direct IP Access Not Allowed

**Symptom:** When hitting the worker URL, you get "Error 1003".

**Cause:** You are accessing the Worker via a direct IP address or a URL that Cloudflare doesn't recognize.

**Solution:** Always use the `*.workers.dev` domain or a custom domain proxied through Cloudflare.

---

### 401 Unauthorized on Admin Endpoints

**Symptom:** `POST /admin/force-flush` returns `{"ok":false,"error":"unauthorized"}`.

**Cause:** The `X-Admin-Secret` header is missing or doesn't match `DO_SHARED_SECRET`.

**Solution:**

1. Ensure you are passing `-H "X-Admin-Secret: YOUR_SECRET"`.
2. Verify the secret matches what was set via `wrangler secret put DO_SHARED_SECRET`.

---

### Oracle Flush Failing (`ORACLE_ENDPOINT or DO_SHARED_SECRET not configured`)

**Symptom:** Stats show `retryState.lastError: "ORACLE_ENDPOINT or DO_SHARED_SECRET not configured"`.

**Cause:** Environment variables are missing or incorrectly set.

**Solution:**

1. Check the effective `ORACLE_ENDPOINT` in local `.dev.vars` or in your CI variables.
2. Ensure `DO_SHARED_SECRET` was set via `wrangler secret put`.
3. Redeploy after making changes: `pnpm run deploy`.

---

### Country Showing as "unknown"

**Symptom:** Analytics show most users in the "unknown" country bucket.

**Cause:** The `request.cf` object (Cloudflare geo data) was not propagated to the Durable Object prior to a recent fix.

**Solution:** Ensure you are running the latest version of the Worker, which passes `X-Geo-Country` explicitly.

---

## 📄 License

This project is part of the Classroom Quick Downloader suite. See the main repository for licensing details.
