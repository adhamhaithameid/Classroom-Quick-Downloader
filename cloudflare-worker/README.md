# CQD Analytics Backend (Cloudflare Worker)

The high-performance ingestion and aggregation layer for **Classroom Quick Downloader**

## 📖 Overview

This service acts as the central nervous system for the CQD extension's analytics.

Unlike traditional stateless APIs, this Worker uses a **Cloudflare Durable Object (DO)** to:

- Maintain **stateful counters**
- Manage **ingestion buffers**
- Enforce **adaptive quota limits** to protect against overages on the Cloudflare free tier

### Core Responsibilities

- **Ingestion**
  Receives **batched analytics events** (`POST /track`) from client extensions.
- **Aggregation**
  Maintains **real-time counters** (downloads, success/fail, browser stats, etc.) in reliable storage.
- **Buffering**
  Queues raw events and **flushes them to the Oracle backend** in optimized batches.
- **Traffic Control**
  Monitors **daily request counts** and can instruct extensions to **back off** (“cut power”) when limits are approached.

## 🏗 Architecture

The system follows a **write-heavy, read-periodic** pattern designed for high concurrency.

```
graph LR
    Ext[Extension Client] -->|POST /track (Batch)| Worker[Cloudflare Worker]
    Worker -->|Proxy| DO[Durable Object]

    subgraph "Durable Object State"
        DO -->|Increment| Counters[Real-time Counters]
        DO -->|Push| Buffer[Event Buffer]
        DO -->|Check| Quota[Daily Limit Guard]
    end

    Buffer -->|Flush Trigger| Alarm[Scheduled Alarm]
    Alarm -->|POST Batch| Oracle[Oracle Backend DB]

    Admin[Developer] -->|GET /| Dashboard[HTML Dashboard]
    Dashboard -->|Fetch JSON| DO
````

## 🔌 API Reference

### Public Endpoints

These endpoints are accessible by the extension or external monitoring tools.


| Method | Endpoint  | Description                                                                                |
| ------ | --------- | ------------------------------------------------------------------------------------------ |
| POST   | `/track`  | Ingestion endpoint. Accepts a JSON payload of events. Updates counters and buffers events. |
| GET    | `/config` | Returns dynamic configuration (batch size,`remoteEnabled`, quota descriptor).              |
| GET    | `/stats`  | Returns the full JSON state: counters, buffer size, last event time, quota status, env.    |
| GET    | `/health` | Lightweight probe with basic health info (pending events, last event, last flush, etc.).   |

### Admin Interface


| Method | Endpoint | Description                                      |
| ------ | -------- | ------------------------------------------------ |
| GET    | `/`      | Renders the HTML Admin Dashboard (login screen). |
| POST   | `/`      | Dashboard authentication handler (password).     |

The dashboard is **password-protected**, typically using the same secret as `DO_SHARED_SECRET`.

### Danger Zone (Admin Only)

These endpoints require an `X-Admin-Secret` header matching `DO_SHARED_SECRET`.


| Endpoint               | Action          | Use Case                                                                |
| ---------------------- | --------------- | ----------------------------------------------------------------------- |
| `/admin/force-flush`   | Force Flush     | Push all buffered events to Oracle immediately, ignoring batch size.    |
| `/admin/cut-power`     | Disable Remote  | Set`remoteEnabled: false`. Extensions stop sending data. **Emergency.** |
| `/admin/restore-power` | Enable Remote   | Re-enable remote ingestion after an emergency or quota event.           |
| `/admin/full-sync`     | Full Sync       | Repeatedly flush until the DO buffer is completely empty.               |
| `/debug/reset`         | Hard Reset ⚠️ | **Destructive.** Wipes all counters, buffers and retry state.           |

## 🧠 Smart Features

### 1. Adaptive Quota System

The Durable Object tracks **`requestsToday`** and exposes a `QuotaDescriptor` via `/config`. As traffic increases, the system automatically shifts modes:

* **Chill Mode** (e.g. `< 10k` requests/day)

  * Small batch size (≈ 50 events per POST)
  * Normal operation
* **Busy Modes** (e.g. `30k+`, `40k+`, `50k+`, …)

  * Gradually **increase batch size** (100 → 150 → 200 → 250 → 300 → 500)
  * Reduce HTTP overhead under high load
* **Emergency Mode** (e.g. `90k+` requests/day)

  * `remoteEnabled: false`
  * Worker instructs extensions to **stop sending remote analytics**
  * Protects against Cloudflare free-tier or billing overages

The same mechanism is used when an admin explicitly **cuts power** via `/admin/cut-power`.

### 2. Intelligent Buffering

To minimize calls to the Oracle backend and reduce latency/cost:

* Events are **stored in the DO buffer** as they arrive.
* Data is flushed to Oracle only when:

  * **Buffer size ≥ `MAX_BATCH_EVENTS`** (environment variable).
  * An admin triggers a **force flush** (`/admin/force-flush`).
  * A **retry alarm** fires after a previous failure (backoff logic).

Failed Oracle flushes update a retry state and schedule a **delayed alarm**, avoiding tight loops and protecting the backend from being hammered.

## 🛠 Development & Setup

### Prerequisites

* **Node.js** & **pnpm**
* **Cloudflare Wrangler CLI**

  ```bash
  npm i -g wrangler
  ```

You will also need a Cloudflare account and a configured `wrangler.toml` with:

* `DOWNLOADS_DO` Durable Object binding
* `ORACLE_ENDPOINT` (can be empty in dev)
* `DO_SHARED_SECRET`
* `MAX_BATCH_EVENTS`

### Installation

```bash
cd cloudflare-worker
pnpm install
```

### Local Development

Runs a local Miniflare instance via Wrangler.
By default it’s accessible at: `http://localhost:8787`.

```bash
pnpm dev
```

You can then test endpoints like:

* `GET http://localhost:8787/health`
* `POST http://localhost:8787/track`
* `GET http://localhost:8787/stats`

### Deployment

Deploys the Worker and applies the Durable Object binding configuration:

```bash
pnpm deploy
```

After deployment:

* Point the **CQD extension**’s analytics config to the deployed `/track` & `/config` endpoints.
* Use the **Admin Dashboard** (`GET /`) with your configured password (`DO_SHARED_SECRET`) to monitor health, quotas and perform Danger Zone actions.

