# 🏛️ Oracle Backend & Analytics Engine

> Update (2026-02-28): Cloudflare website traffic sync is now integrated into Oracle analytics (`traffic` + `trafficDaily`, scheduler + manual refresh endpoint). Full scan status and remaining rollout steps are in `/docs/MAJOR_SCAN_2026-02-28.md` and `/docs/DEPLOYMENT_RUNBOOK.md`.

![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Pure_Go-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets-API-34A853?logo=googlesheets&logoColor=white)

The **Oracle Backend** is a high-performance, low-footprint analytics server designed for vertical scaling on ARM architecture (Oracle Cloud Ampere). It serves as the **persistent sink** for the CQD analytics pipeline, receiving batched data from the Cloudflare Worker, storing it in SQLite, and serving a real-time visualization dashboard.

---

## ⚡ Key Features

| Feature | Description |
|---------|-------------|
| **Lightweight** | Single ~15MB binary. No external database server required. |
| **ARM64 Optimized** | Built specifically for Oracle Cloud Free Tier (Ampere A1). |
| **SQLite WAL Mode** | High-performance concurrent reads with Write-Ahead Logging. |
| **Pre-Aggregated Storage** | Receives already-aggregated batches from Cloudflare DO, minimizing write operations. |
| **Google Sheets Archiver** | A separate CLI tool pushes daily snapshots to Google Sheets for long-term reporting. |
| **SPA Dashboard** | Serves a beautiful, embedded analytics dashboard with no external dependencies. |

---

## 🧭 Oracle Hub v4.1 Scope

Oracle Hub v4.1 extends the backend from analytics-only to a full admin/control plane:

- **Management Hub**: dashboards/deployments/versions records with API-backed CRUD.
- **Creative Hub**: designs, HTML emails, newsletter subscribers, and campaigns.
- **Danger Zone + SQL Console**: step-up protected destructive operations with feature flags and dry-run support.
- **Dual-DB reliability**: outbox-driven SQLite ingestion relay and Postgres control-plane outbox events.
- **Observability**: request-level structured logs, Prometheus metrics, alert sink, and Oracle operation logs APIs.
- **UI productivity**: keyboard shortcuts panel + hold `Command`/`Ctrl` for 1 second to reveal shortcut badges.

Full v4.1 reference:
- [`docs/ORACLE_HUB_V4.md`](../docs/ORACLE_HUB_V4.md)

---

## 📱 Testing Oracle UI On This Device

Use this to test from desktop and mobile devices on your local network:

1. Start backend locally:
```bash
cd oracle-backend
export DASHBOARD_PASSWORD='your-dashboard-password'
export SUPER_ADMIN_PASSWORD='your-super-admin-password'
go run ./cmd/app
```

From repo root, equivalent shortcut:
```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm run dev:oracle
```
2. Desktop test URL:
```text
http://localhost:8080
```
3. Find your LAN IP and test from phone/tablet on same Wi-Fi:
```bash
ipconfig getifaddr en0   # macOS Wi-Fi interface
```
4. Open on phone:
```text
http://<LAN_IP>:8080
```
5. Optional backend quality scan before manual UI test:
```bash
cd oracle-backend && make scan
```

6. One-command full API smoke matrix:
```bash
cd oracle-backend
BASE_URL="http://127.0.0.1:8080" \
DASHBOARD_PASSWORD="your-dashboard-password" \
./scripts/api-matrix-smoke.sh
```

7. Include step-up protected dry-run checks (critical endpoints):
```bash
cd oracle-backend
BASE_URL="http://127.0.0.1:8080" \
DASHBOARD_PASSWORD="your-dashboard-password" \
SUPER_ADMIN_PASSWORD="your-super-admin-password" \
./scripts/api-matrix-smoke.sh
```

8. Strict mode (fail if policy-gated critical endpoints are blocked):
```bash
cd oracle-backend
BASE_URL="http://127.0.0.1:8080" \
DASHBOARD_PASSWORD="your-dashboard-password" \
SUPER_ADMIN_PASSWORD="your-super-admin-password" \
STRICT_CRITICAL=1 \
./scripts/api-matrix-smoke.sh
```

Notes:
- HTTP local testing works out of the box.
- For internet exposure, always place Oracle behind HTTPS + reverse proxy.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE DURABLE OBJECT                            │
│                   (Buffers events, aggregates batches)                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 │  POST /ingest-batch
                                 │  Header: X-DO-SECRET
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ORACLE BACKEND (This Server)                        │
│                         ────────────────────────────                        │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        HTTP SERVER (:8080)                          │   │
│   │   ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐    │   │
│   │   │  /ingest-batch│   │  /api/stats/* │   │   Static Files    │    │   │
│   │   │  (Write)      │   │  (Read)       │   │   (Dashboard SPA) │    │   │
│   │   └───────┬───────┘   └───────┬───────┘   └───────────────────┘    │   │
│   │           │                   │                                     │   │
│   └───────────┼───────────────────┼─────────────────────────────────────┘   │
│               │                   │                                         │
│               ▼                   ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                   SQLite Database (WAL Mode)                        │   │
│   │   ┌─────────────┐  ┌──────────────────┐  ┌────────────────────┐    │   │
│   │   │   batches   │  │ downloads_hourly │  │  downloads_totals  │    │   │
│   │   │ (raw logs)  │  │ (time-series)    │  │  (fast counters)   │    │   │
│   │   └─────────────┘  └──────────────────┘  └────────────────────┘    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │  Cron Job (Daily)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ARCHIVER CLI TOOL                                   │
│   1. Fetches /api/stats/summary from local server                           │
│   2. Transforms data to spreadsheet rows                                    │
│   3. Appends to Google Sheet via Service Account                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Server

The HTTP server (`cmd/app/main.go`) listens on port `8080` and provides:
- **Ingestion Endpoint**: `POST /ingest-batch` receives aggregated batches from Cloudflare.
- **Analytics API**: `GET /api/stats/*` endpoints power the frontend dashboard.
- **Static File Server**: Serves the SPA dashboard from `/static`.

### The Database

SQLite is configured with **WAL (Write-Ahead Logging)** mode for optimal concurrent read performance:
- No external database server required.
- Single-file database simplifies backups and deployment.
- `busy_timeout=5000` prevents lock contention errors.
- Connection pooling: 1 writer, multiple readers.

### The Archiver

A separate binary (`cmd/archiver/main.go`) connects to the local API and pushes a daily snapshot to Google Sheets. This is scheduled via cron and uses a Google Cloud Service Account for authentication.

---

## 📁 Project Structure

```
oracle-backend/
├── cmd/
│   ├── app/
│   │   └── main.go           # HTTP server entry point
│   └── archiver/
│       └── main.go           # Google Sheets archiver CLI
├── internal/
│   ├── db/
│   │   └── db.go             # SQLite initialization, migrations, schema
│   ├── handlers/
│   │   ├── health.go         # Health check endpoints
│   │   ├── store_batch.go    # POST /ingest-batch handler
│   │   └── stats.go          # Analytics API handlers
│   └── model/
│       └── types.go          # Shared type definitions
├── static/
│   ├── index.html            # SPA dashboard (embedded)
│   ├── logo.svg              # CQD branding
│   └── favicon.png           # Browser favicon
├── Dockerfile                # Multi-stage production build
├── docker-compose.yml        # Deployment configuration
├── deploy.sh                 # Deprecated compatibility wrapper
├── go.mod                    # Go module dependencies
└── README.md                 # You are here! 📍
```

| Directory/File | Purpose |
|----------------|---------|
| `cmd/app/` | Main HTTP server binary. Starts server, registers routes, serves static files. |
| `cmd/archiver/` | CLI tool for daily Google Sheets export. |
| `internal/db/` | Database initialization, schema migrations, SQLite config. |
| `internal/handlers/` | HTTP handler logic for ingestion and analytics APIs. |
| `static/` | Pre-built dashboard SPA (served by the Go server). |
| `Dockerfile` | Multi-stage build for minimal production image. |
| `docker-compose.yml` | Docker Compose service definition for deployment. |
| `deploy.sh` | Deprecated compatibility wrapper that forwards to `scripts/deploy_main_inplace.sh`. |

---

## ⚙️ Configuration & Environment

All configuration is done via environment variables, defined in `docker-compose.yml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `ADDR` | `:8080` | Address and port to listen on. |
| `DB_PATH` | `/data/analytics.db` | Path to the SQLite database file. |
| `STATIC_DIR` | `/app/static` | Directory containing dashboard static files. |
| `DO_SHARED_SECRET` | *(required)* | Shared secret for authenticating Cloudflare Durable Object requests. |
| `DASHBOARD_PASSWORD` | *(required)* | Password for dashboard login (enables auth). |
| `SUPER_ADMIN_PASSWORD` | *(required)* | Password for step-up verification on critical admin operations. |
| `ORACLE_AUDIT_CHECKPOINT_SECRET` | *(required)* | HMAC secret used to sign audit-chain checkpoint anchors. |
| `ARCHIVER_SHARED_SECRET` | *(required when auth enabled)* | Secret header for the archiver to read stats. |
| `ALLOW_LOOPBACK_BYPASS` | `false` | Set `true` to allow loopback auth bypass (dev only). |
| `ALLOW_EMPTY_DASHBOARD_PASSWORD` | `false` | Set `true` to allow an empty dashboard password (dev only). |
| `SESSION_COOKIE_SECURE` | `auto` | Cookie Secure mode: `auto` (TLS-aware), `true` (always secure), `false` (always non-secure; needed for plain HTTP). Must be `true` when `APP_ENV=production`. |
| `PUBLIC_BASE_URL` | *(optional)* | Canonical public origin (for CSRF origin allow checks), e.g. `https://oracle.example.com`. Required and HTTPS when `APP_ENV=production`. |
| `CSRF_ALLOWED_ORIGINS` | *(optional)* | Comma-separated explicit CSRF origin allowlist (scheme + host), e.g. `https://oracle.example.com,https://admin.example.com`. Required and HTTPS-only when `APP_ENV=production`, and must include `PUBLIC_BASE_URL`. |
| `POSTGRES_DSN` | *(optional)* | Enables Postgres bootstrap and v4.1 cutover paths. |
| `STORAGE_WATERMARK_WARN` | `70` | Disk usage warning watermark percentage. |
| `STORAGE_WATERMARK_CRITICAL` | `85` | Disk usage critical watermark percentage. |
| `STORAGE_WATERMARK_EMERGENCY` | `92` | Disk usage emergency watermark percentage. |
| `ORACLE_PRIMARY_REGION` | `primary` | Label for primary region in DR status APIs. |
| `ORACLE_DR_REGION` | `warm-dr` | Label for warm DR region in DR status APIs. |
| `ORACLE_DR_REPLICA_LAG_SECONDS` | `-1` | Optional external replica lag feed for DR visibility. |
| `ORACLE_DR_PROMOTION_MAX_LAG_SECONDS` | `300` | Promotion guardrail for DR eligibility checks. |
| `ORACLE_RETENTION_RAW_SNAPSHOTS_DAYS` | `30` | Retention window for `cf_snapshots_raw` rows based on `received_at`. |
| `CLOUDFLARE_ANALYTICS_API_TOKEN` | *(optional)* | API token used to read Cloudflare traffic analytics via GraphQL (required when traffic sync is enabled). |
| `CLOUDFLARE_ANALYTICS_ACCOUNT_TAG` | *(optional)* | Cloudflare account tag used by the analytics GraphQL query. |
| `CLOUDFLARE_ANALYTICS_HOSTNAME` | *(optional)* | Hostname filter for analytics pulls (use your production root domain). |
| `ORACLE_WEBSITE_TRAFFIC_SYNC_ENABLED` | `false` | Enables hourly Cloudflare traffic sync into Oracle (`website_traffic_hourly`). |
| `ORACLE_WEBSITE_TRAFFIC_SYNC_INTERVAL_SECONDS` | `3600` | Scheduler interval for Cloudflare traffic sync loop (min `60`, max `86400`). |
| `ORACLE_WEBSITE_TRAFFIC_SYNC_LOOKBACK_HOURS` | `48` | Rolling lookback window fetched each sync run (min `1`, max `720`). |

Startup is **fail-closed** for auth secrets: the server exits if `SUPER_ADMIN_PASSWORD` is missing, and also exits if `DASHBOARD_PASSWORD` is missing while `ALLOW_EMPTY_DASHBOARD_PASSWORD=false`.
Startup also exits if `ORACLE_AUDIT_CHECKPOINT_SECRET` is missing, and exits when `DO_SHARED_SECRET`, `DASHBOARD_PASSWORD`, `SUPER_ADMIN_PASSWORD`, `ARCHIVER_SHARED_SECRET`, or `ORACLE_AUDIT_CHECKPOINT_SECRET` are set to known weak placeholder values (for example `secret`, `password`, or `change-me-in-production`).

When `DASHBOARD_PASSWORD` is set, the Oracle dashboard prompts for authentication using an **in-page login modal form** (not a browser-native prompt), matching the Cloudflare dashboard workflow.

### 🔐 Setting `DO_SHARED_SECRET`

> **⚠️ WARNING: Never commit secrets to version control.**

The `DO_SHARED_SECRET` is used to authenticate requests from the Cloudflare Worker. It **must match** the secret configured in the Worker's `wrangler.toml`.

**Option 1: Environment Variable (Recommended)**
```bash
export DO_SHARED_SECRET="$(openssl rand -hex 32)"
docker compose up -d
```

**Option 2: `.env` File**
```bash
# Create .env file (add to .gitignore!)
echo "DO_SHARED_SECRET=$(openssl rand -hex 32)" > .env
docker compose up -d
```

### 🔑 Google Credentials

The archiver requires a Google Cloud Service Account JSON file for Google Sheets API access.

> **⚠️ WARNING: Never commit `google-credentials.json` to version control.**

1. Create a Service Account in Google Cloud Console.
2. Enable the Google Sheets API.
3. Download the JSON key file.
4. Store it outside the repository, e.g. `$HOME/.config/cqd/google-credentials.json`.
5. Share your Google Sheet with the Service Account email.

Mount credentials from an external path into the container:
```yaml
environment:
  - GOOGLE_CREDS_PATH=/run/secrets/google-credentials.json
volumes:
  - ${GOOGLE_CREDS_PATH_HOST:-/dev/null}:/run/secrets/google-credentials.json:ro
```

---

## 📡 API Documentation

### `POST /ingest-batch` — Ingest Aggregated Batch

The primary endpoint called by the Cloudflare Durable Object. Receives pre-aggregated analytics data.

**Authentication:** Requires `X-DO-SECRET` header matching `DO_SHARED_SECRET`.

**Request:**
```bash
curl -X POST http://localhost:8080/ingest-batch \
  -H "Content-Type: application/json" \
  -H "X-DO-SECRET: your-shared-secret" \
  -d '{
    "batchId": "do-seq15-500ev",
    "generatedAt": 1702732800000,
    "timeZone": "UTC",
    "summary": { ... },
    "timeBuckets": [ ... ],
    "doState": { ... }
  }'
```

**Response:**
```json
{
  "ok": true,
  "message": "ingested",
  "batchId": "do-seq15-500ev",
  "ingestedAt": 1702732800123
}
```

**Idempotency:** If a `batchId` already exists, the request is silently ignored (returns success without duplicating data).

---

### `GET /api/stats/summary` — Full Summary

Returns complete analytics summary including totals, breakdowns, and top stats. Used by both the dashboard and the archiver.

**Request:**
```bash
curl http://localhost:8080/api/stats/summary
```

**Response:**
```json
{
  "ok": true,
  "generatedAt": 1702732800000,
  "status": "online",
  "flags": ["remote_enabled"],
  "totalDownloads": 12500,
  "totalSuccess": 11800,
  "totalFail": 700,
  "successRate": 0.944,
  "browsers": { "chrome": 9000, "firefox": 2500, "edge": 1000 },
  "os": { "windows": 7000, "macos": 4000, "linux": 1500 },
  "countries": { "eg": 5000, "us": 3000, "sa": 2000 },
  "topBrowser": "chrome",
  "topOs": "windows",
  "topCountry": "eg",
  "topType": "pdf"
}
```

---

### `GET /api/stats/timeseries` — Time-Series Data

Returns download counts over time for charting.

**Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `granularity` | `day` | `hour` or `day` |
| `from` | 7 days ago | Start date (YYYY-MM-DD) |
| `to` | today | End date (YYYY-MM-DD) |

**Request:**
```bash
curl "http://localhost:8080/api/stats/timeseries?granularity=day&from=2024-12-01&to=2024-12-15"
```

---

### `GET /api/stats/breakdown` — Dimension Breakdown

Returns counts grouped by a specific dimension.

**Parameters:**
| Param | Default | Options |
|-------|---------|---------|
| `dimension` | `type` | `type`, `browser`, `os`, `country`, `language`, `version`, `error` |
| `from` / `to` | Last 7 days | Date range |

**Request:**
```bash
curl "http://localhost:8080/api/stats/breakdown?dimension=country&from=2024-12-01"
```

---

### `GET /api/stats/comparison` — Period Comparison

Compares two time periods for trend analysis.

**Request:**
```bash
curl "http://localhost:8080/api/stats/comparison?from1=2024-12-01&to1=2024-12-07&from2=2024-12-08&to2=2024-12-14"
```

---

### `GET /api/stats/export` — Export Data

Exports time-series data as JSON or CSV.

**Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `format` | `json` | `json` or `csv` |
| `granularity` | `day` | `hour` or `day` |

**Request:**
```bash
# CSV download
curl "http://localhost:8080/api/stats/export?format=csv&from=2024-12-01" -o analytics.csv
```

---

### `GET /api/pipeline/metrics` — Delivery Chain Metrics

Returns end-to-end delivery counters (`accepted`, `stored`, `forwarded`, `committed`), stage gaps, daily rollups, and recent delivery records.

**Request:**
```bash
curl "http://localhost:8080/api/pipeline/metrics?days=14&limit=100"
```

**Auth:** Protected by dashboard session middleware.

---

### `GET /api/pipeline/failures` — Structured Failure Sink

Returns recent structured failure logs and daily grouped summaries (`source`, `stage`, `error_code`, `sample_count`).

**Request:**
```bash
curl "http://localhost:8080/api/pipeline/failures?days=14&limit=200"
```

**Auth:** Protected by dashboard session middleware.

---

### `GET /api/admin/oracle-logs` — Oracle Operation Logs

Returns request-level backend operation logs captured by the Oracle server.

**Query params:**
- `limit` (default `200`, max `2000`)
- `offset` (default `0`)

---

### `POST /api/admin/oracle-logs/delete-older` — Retention Delete

Deletes Oracle operation logs older than a configured number of days.

**Body:**
```json
{ "days": 30, "dryRun": false }
```

**Auth:** Requires dashboard auth + step-up.

---

### `POST /api/admin/oracle-logs/clear-all` — Clear All Logs

Deletes all Oracle operation logs.

**Body:**
```json
{ "confirm": "CLEAR_ALL_LOGS", "dryRun": false }
```

**Auth:** Requires dashboard auth + step-up.

---

### `GET /health` — Health Check

Simple health probe for Docker health checks and load balancers.

**Request:**
```bash
curl http://localhost:8080/health
```

**Response:**
```json
{ "ok": true }
```

---

### `GET /health/ready` — Readiness Gate

Readiness probe for load balancers and failover automation.

Checks:
- SQLite connectivity + outbox health.
- Postgres migration/init/outbox health when Postgres is configured.
- Storage emergency state (ingest backpressure mode).

Returns `503` with reasons when not ready.

---

### `GET /api/admin/ha/status` — HA Runtime Status

Returns HA runtime state for operators:
- active write mode (`sqlite_primary` or `postgres_primary`)
- cutover feature flags
- sqlite/postgres outbox backlog health
- storage pressure snapshot
- latest backup run metadata

---

### `GET /api/admin/storage/status` — Storage/Disk Status

Returns host disk telemetry and growth indicators:
- disk used/available bytes + percentage
- configured warn/critical/emergency thresholds
- current severity + ingest backpressure state
- top high-row-count tables

---

### `GET /api/admin/dr/status` — DR Readiness Status

Returns warm-DR visibility:
- primary + DR region labels
- replica lag feed value (if configured)
- promotion eligibility decision
- latest drill result metadata

---

### `POST /api/admin/dr/drill` — Record DR Drill

Step-up protected endpoint for game-day drill records.

Body:
```json
{
  "dryRun": true,
  "targetRegion": "warm-dr",
  "simulatedOutcome": "passed",
  "notes": "weekly validation"
}
```

---

### `POST /api/admin/retention/run` — Retention Executor

Step-up protected retention action for bounded operational tables.

Body:
```json
{
  "dryRun": true,
  "policies": ["pipeline_failure_logs", "oracle_operation_logs", "ingest_outbox_sent"]
}
```

Applies retention to transient tables (failure logs, operation logs, sent outbox rows, storage samples, auth stale rows, and optional Postgres outbox rows).

---

## 📊 Google Sheets Archiver

The `archiver` CLI tool pushes daily analytics snapshots to a Google Sheet for long-term historical tracking.

### How It Works

1. Fetches `/api/stats/summary` from the local server.
   - It automatically scopes to a full UTC day window (`from=YYYY-MM-DD&to=YYYY-MM-DD`).
   - Default archived day is `yesterday` (good for the 00:15 UTC scheduler run).
2. Extracts totals, breakdowns, and top stats.
3. Formats data as a spreadsheet row.
4. Appends the row to the specified Google Sheet.

### Usage

```bash
./archiver \
  --sheet "YOUR_GOOGLE_SHEET_ID" \
  --creds "/run/secrets/google-credentials.json" \
  --api "http://localhost:8080/api/stats/summary" \
  --day "yesterday"
```

### Cron Job Setup

To run the archiver daily at midnight UTC:

```bash
# Edit crontab
crontab -e

# Add this line
0 0 * * * docker exec cqd-oracle-backend /app/archiver --sheet "YOUR_SHEET_ID" >> /var/log/archiver.log 2>&1
```

### Google Sheet Columns

The archiver appends a row with the following columns:

| Column | Data |
|--------|------|
| A | Date |
| B | Total Downloads |
| C | Total Success |
| D | Total Fail |
| E | Success Rate (%) |
| F | Top Browser |
| G | Top OS |
| H | Top Country |
| I | Top File Type |
| J | All Browsers (breakdown) |
| K | All OS (breakdown) |
| L | All Countries (breakdown) |
| M | All Languages (breakdown) |
| N | All File Types (breakdown) |
| O | All Errors (breakdown) |
| P | Extension Versions (breakdown) |
| Q | Total Cancelled |

---

## 🗄️ Database Schema

The SQLite database contains four main tables:

### `batches` — Batch Metadata

Stores metadata for each ingested batch. Used for idempotency (deduplication by `batch_id`).

```sql
CREATE TABLE batches (
  batch_id        TEXT PRIMARY KEY,
  generated_at    INTEGER,
  ingested_at     INTEGER,
  time_zone       TEXT,
  events_count    INTEGER,
  downloads_count INTEGER,
  success_count   INTEGER,
  fail_count      INTEGER
);
```

### `downloads_hourly` — Time-Series Data

Stores per-hour aggregated metrics. Each row represents one hour of data from one batch.

```sql
CREATE TABLE downloads_hourly (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket_start         TEXT NOT NULL,
  bucket_end           TEXT NOT NULL,
  total_events         INTEGER NOT NULL DEFAULT 0,
  total_downloads      INTEGER NOT NULL DEFAULT 0,
  total_success        INTEGER NOT NULL DEFAULT 0,
  total_fail           INTEGER NOT NULL DEFAULT 0,
  by_status_json       TEXT,
  by_type_json         TEXT,
  by_browser_json      TEXT,
  by_os_json           TEXT,
  by_ext_ver_json      TEXT,
  by_lang_json         TEXT,
  by_country_json      TEXT,
  by_error_type_json   TEXT,
  batch_id             TEXT NOT NULL
);
```

### `downloads_totals` — Fast Counters

Key-value store for lifetime totals. Enables O(1) lookup for summary queries.

```sql
CREATE TABLE downloads_totals (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
```

Key patterns:
- `totalEvents`, `totalDownloads`, `totalSuccess`, `totalFail`
- `browser:chrome`, `browser:firefox`, ...
- `os:windows`, `os:macos`, ...
- `country:eg`, `country:us`, ...

### `do_state_snapshots` — Durable Object Health History

Stores DO state snapshots included in each batch for observability.

```sql
CREATE TABLE do_state_snapshots (
  snapshot_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at           INTEGER NOT NULL,
  source                TEXT NOT NULL,
  raw_json              TEXT,
  total_events          INTEGER,
  pending_events        INTEGER,
  requests_today        INTEGER,
  quota_level           TEXT,
  -- ... more fields
);
```

---

## 🚀 Deployment (Oracle Cloud / Docker)

### Prerequisites

- Docker 20.10+
- Docker Compose v2+
- ARM64 server (Oracle Cloud Ampere A1 recommended)

### Building the Image

The Dockerfile uses a multi-stage build for a minimal production image:

```bash
# Build for ARM64 (default)
docker build -t cqd-oracle-backend .

# Build for AMD64 (if needed)
docker build --build-arg TARGETARCH=amd64 -t cqd-oracle-backend .
```

### Running with Docker Compose

```bash
# Set the shared secret + public HTTPS hostname
export DO_SHARED_SECRET="your-strong-secret"
export ORACLE_PUBLIC_HOSTNAME="oracle.your-domain.com"
export APP_ENV="production"
export SESSION_COOKIE_SECURE="true"
export PUBLIC_BASE_URL="https://oracle.your-domain.com"
export CSRF_ALLOWED_ORIGINS="https://oracle.your-domain.com"

# Start the backend behind the bundled Caddy TLS proxy
docker compose up -d

# View logs
docker compose logs -f oracle-backend caddy
```

Compose now fronts the Go service with Caddy on ports `80/443`. Keep direct
`http://localhost:8080` usage only for local `go run ./cmd/app` development, not
for production-style compose deployments.

When `APP_ENV=production`, startup is fail-closed for transport settings:
- `SESSION_COOKIE_SECURE` must be `true`
- `PUBLIC_BASE_URL` must be a valid `https://` origin
- `CSRF_ALLOWED_ORIGINS` must be set to `https://` origins and include `PUBLIC_BASE_URL`

### Preferred deployment entrypoint

For quick redeploys after code changes, use the real deploy script directly:

```bash
./scripts/deploy_main_inplace.sh
```

### Using `deploy.sh` (compatibility only)

`deploy.sh` still works, but it is only a wrapper for older local habits and
should not be used in new automation or documentation.

```bash
./deploy.sh
```

The underlying deploy flow:
1. Rebuilds the Docker image.
2. Restarts the container.
3. Prunes unused images.
4. Shows recent logs.

### Data Persistence

SQLite data is persisted in a Docker volume:
```yaml
volumes:
  - oracle_data:/data
```

To backup the database:
```bash
docker cp cqd-oracle-backend:/data/analytics.db ./backup-$(date +%Y%m%d).db
```

---

## 📡 System Monitoring & Alerting

We use **Uptime Kuma** for self-hosted infrastructure monitoring. It runs on the same Oracle VM as the backend, providing 24/7 uptime tracking and instant alerts when something goes wrong.

## Oracle Hub v4.1 Admin APIs

The dashboard now exposes dedicated control-plane APIs for creative/content operations,
Postgres-backed record management, and deployment synchronization.

### Outbox Reliability

- `GET /api/admin/outbox/status?source=all|sqlite|postgres`
- `POST /api/admin/outbox/retry` with optional JSON body:
  - `{"source":"sqlite","ids":[1,2]}`
  - `{"source":"postgres"}`
- `POST /api/admin/outbox/replay-dead-letter` (SQLite dead-letter replay)

### Management + Deployment Sync

- `GET /api/admin/deployments/targets`
- `POST /api/admin/deployments/sync`
- `GET /api/admin/sheets/last-flush`
- `GET /api/admin/records/list?type=deployment_target`
- `POST /api/admin/records/upsert`

Deployment sync stores these fields per browser target:
- `users`
- `usersCount`
- `version`
- `rating`
- `ratingCount`

Automatic deployment sync runs server-side in the background (all targets) and can be tuned with:
- `ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED` (`true` by default)
- `ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS` (`900` by default, min `60`, max `86400`)

Backward-compatible aliases are also accepted:
- `DEPLOYMENTS_AUTO_SYNC_ENABLED`
- `DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS`

Reliability behavior:
- Auto-sync runs immediately at startup (no need to wait for the first interval tick).
- Each cycle retries transient full-failure runs automatically before waiting for the next schedule.
- Archiver runs persist latest Sheets flush metadata (`status`, archived day, row payload JSON) for dashboard visibility.

### Website Traffic Sync

- `GET /api/admin/website/analytics` now includes additive traffic fields:
  - `traffic` (`visits`, `requests`, `lastSyncedAtUtc`, `source`, `status`)
  - `trafficDaily[]` (daily Cloudflare aggregates)
- `POST /api/admin/website/traffic/refresh` triggers an immediate Cloudflare traffic sync (step-up required).

Traffic sync behavior:
- Pull source: Cloudflare GraphQL (`requestSource=eyeball`) filtered by `CLOUDFLARE_ANALYTICS_HOSTNAME`.
- Automatic fallback: if `httpRequestsAdaptiveGroups` is unavailable for the account/token, Oracle falls back to `rumPageloadEventsAdaptiveGroups`.
- Storage grain: hourly rows in `website_traffic_hourly`.
- Scheduler: runs once at startup, then by `ORACLE_WEBSITE_TRAFFIC_SYNC_INTERVAL_SECONDS`.
- Each run refreshes the last `ORACLE_WEBSITE_TRAFFIC_SYNC_LOOKBACK_HOURS` for idempotent backfill.

### Creative Hub

- `GET /api/admin/creative/designs`
- `POST /api/admin/creative/designs/upsert`
- `POST /api/admin/creative/designs/delete`
- `GET /api/admin/creative/emails`
- `POST /api/admin/creative/emails/upsert`
- `POST /api/admin/creative/emails/delete`

### Newsletter APIs

- `GET /api/admin/newsletter/subscribers`
- `POST /api/admin/newsletter/subscribers/upsert`
- `POST /api/admin/newsletter/subscribers/delete`
- `GET /api/admin/newsletter/campaigns`
- `POST /api/admin/newsletter/campaigns/upsert`
- `POST /api/admin/newsletter/campaigns/delete`

### Security Scan Script

Run all backend checks locally:

```bash
make scan
```

Fast local targets:

```bash
make test-app
make test-handlers
make test
```

### Tooling

| Component | Details |
|-----------|---------|
| **Software** | [Uptime Kuma](https://github.com/louislam/uptime-kuma) |
| **Deployment** | Docker container on Oracle VM |
| **Port** | `3001` |

### Monitors

We monitor three critical components of the CQD analytics pipeline:

| Monitor | Type | Endpoint | Purpose |
|---------|------|----------|---------|
| **Cloudflare Edge** | HTTP(S) | `https://cqd-analytics.*.workers.dev/health` | Verifies the Worker is responding and can route requests to the Durable Object |
| **Backend API** | HTTP | `GET /health` | Checks the Go server is running and accepting connections |
| **SQLite Database** | HTTP | `GET /health/db` | Verifies database read access and checks for lock contention issues |

### Cron Monitoring (Push Monitor)

The `archive-stats` tool uses a **Push Monitor** to "call home" after each successful run:

```
┌────────────────────────────────────────────────────────────────┐
│                         CRON JOB                               │
│   0 0 * * * /app/archiver --sheet "..." && curl <push-url>    │
└──────────────────────────────┬─────────────────────────────────┘
                               │
                               ▼ (on success)
┌────────────────────────────────────────────────────────────────┐
│                      UPTIME KUMA                               │
│   Push Monitor expects a "heartbeat" within 24h + grace period │
│   If no heartbeat → Alert triggered!                           │
└────────────────────────────────────────────────────────────────┘
```

**How it works:**
1. The cron job runs the archiver tool daily.
2. If the archiver succeeds, it curls the Uptime Kuma push URL.
3. If no heartbeat is received within the expected window (24 hours + configurable grace period), Kuma sends an alert.
4. This catches silent failures like: cron not running, archiver crashes, network issues, or Google Sheets API errors.

**Cron Monitoring Flow:**

```mermaid
sequenceDiagram
    participant Cron
    participant Archiver
    participant Kuma as Uptime Kuma
    participant Alert

    Cron->>Archiver: Runs Daily (00:00)
    alt Success
        Archiver->>Kuma: Sends "Heartbeat" (HTTP GET)
        Kuma->>Kuma: Resets 24h Timer 🟢
    else Failure / Crash
        Archiver--xKuma: No Signal
        Kuma->>Kuma: Timer Expires
        Kuma->>Alert: Sends Notification (Down) 🔴
    end
```

### Deployment

Start the monitoring container with Docker:

```bash
docker run -d \
  --restart=always \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  --name uptime-kuma \
  louislam/uptime-kuma:latest
```

**Key flags:**
- `--restart=always` — Auto-restart on VM reboot
- `-v uptime-kuma:/app/data` — Persist configuration and history
- `-p 3001:3001` — Expose web dashboard

### Public Status Page

A public status page is available for users to check system health without authentication:

```
http://<your-vm-ip>:3001/status/cqd
```

This page shows:
- Current status of all monitors (up/down)
- Uptime percentages (24h, 7d, 30d)
- Incident history

> **Tip:** Share this status page URL in your extension's support documentation so users can self-diagnose outage issues.

---

## 🚨 Troubleshooting

### 401 Unauthorized on `/ingest-batch`

**Symptom:** Cloudflare Worker receives `401 Unauthorized` when flushing to Oracle.

**Cause:** `X-DO-SECRET` header doesn't match `DO_SHARED_SECRET`.

**Solution:**
1. Verify `DO_SHARED_SECRET` in `docker-compose.yml` or environment.
2. Ensure the same secret is set in Cloudflare Worker's `wrangler secret put DO_SHARED_SECRET`.
3. Restart both services after changing secrets.

---

### Database Locked Errors

**Symptom:** Logs show `database is locked`.

**Cause:** WAL mode corruption or concurrent writes from multiple processes.

**Solution:**
1. Ensure only one `oracle-backend` process is running.
2. Verify `DB_PATH` points to the same file for all operations.
3. If persists, restart the container.

---

### Archiver Fails with "Unable to read client secret file"

**Symptom:** Archiver can't find Google credentials JSON.

**Cause:** File not mounted or incorrect path.

**Solution:**
1. Verify the credentials file exists at `GOOGLE_CREDS_PATH_HOST` on the host.
2. Check the compose bind mount points to `/run/secrets/google-credentials.json`.
3. Ensure Service Account has Sheets API enabled.

---

### Container Fails Health Check

**Symptom:** Docker marks container as unhealthy.

**Cause:** Server isn't responding to `/health` within 3 seconds.

**Solution:**
1. Check logs: `docker compose logs oracle-backend`.
2. Verify port `8080` is not in use by another process.
3. Ensure `DB_PATH` directory is writable.

---

### "Session cookie was not saved by your browser" on login

**Symptom:** Dashboard login accepts password but auth modal does not unlock.

**Cause:** Browser drops the session cookie due to Secure policy mismatch for HTTP deployments.

**Solution:**
1. For HTTPS production deployments set `SESSION_COOKIE_SECURE=true`.
2. For local/plain-HTTP development use `SESSION_COOKIE_SECURE=auto` (recommended) or `false`.
3. Refresh the page and retry login after updating env vars.

---

## 📄 License

This project is part of the Classroom Quick Downloader suite. See the main repository for licensing details.
