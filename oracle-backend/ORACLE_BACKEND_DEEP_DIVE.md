# Oracle Backend System: The Comprehensive Technical Deep Dive

> Update (2026-02-15): Latest changes include CI coverage-gate hardening for extension analytics storage migration fallback, popup stats race-condition guards, structured step-up auth error handling in Oracle dashboard, and backend/worker auth-security hardening. See /CHANGELOG.md for details.

> **Target Audience**: Senior Engineers, System Architects, and Security Auditors.
> **Purpose**: A complete technical dissection of the `oracle-backend` ecosystem to execute a successful interview, technical audit, or handover.

---

## 1. System Architecture & Data Flow

The `oracle-backend` is the core control plane and long-term storage unit for the Classroom-Quick-Downloader analytics ecosystem. It operates on a **Hybrid Edge-Core** model, designed to decouple high-volume ingestion from long-term storage.

### 1.1 The High-Level Topology

```mermaid
graph TD
    Client[Chrome Extension] -->|Firehose| Cloudflare[Cloudflare Edge]
    Cloudflare -->|Buffer & Aggregation| DO[Durable Object]
    DO -->|Batch POST /ingest-batch| Oracle[Oracle Backend (Go)]
    
    subgraph "Oracle VM (Dockerized Host)"
        API[API Server (Go)]
        Archiver[Archiver (Go CLI)]
        SQLite[(SQLite DB)]
        Relay[Relay Worker (Goroutine)]
    end
    
    Cloudflare -.->|Key Exchange| API
    Oracle --> API
    API --> Auth[Auth Middleware]
    Auth --> SQLite
    
    SQLite -->|Polling| Relay
    Relay -->|Replication| Postgres[(Postgres Replica)]
    
    API -->|Trigger| Archiver
    Archiver -->|Oauth2| GSheets[Google Sheets]
    Archiver -->|Push| Kuma[Uptime Kuma]
    
    User[Admin User] -->|HTTPS| Dashboard[SPA Dashboard]
    Dashboard -->|JSON API| API
```

### 1.2 The "Ingest" Data Pipeline
1.  **Edge Aggregation**: Thousands of extensions send events to Cloudflare.
2.  **Durable Object Buffering**: The DO aggregates these into a compressed `OracleBatch` (JSON) to reduce write pressure on the backend.
3.  **Atomic Ingestion**: The backend receives a batch via `POST /ingest-batch`.
4.  **Transaction Boundary**:
    -   The handler opens a **SQLite Transaction (`BEGIN IMMEDIATE`)**.
    -   It saves the raw batch, updates hourly stats (`downloads_hourly`), updates lifetime totals (`downloads_totals`), and writes to `ingest_outbox`.
    -   **Commit**: All data is saved, OR nothing is saved. This guarantees consistency.
5.  **Async Relay**: The `internal/relay` worker (running as a goroutine) wakes up, reads the `ingest_outbox`, and pushes data to Postgres without blocking the HTTP response.

---

## 2. Technology Stack Deep Dive

### 2.1 Core Runtime: Go 1.24 (Alpine)
*   **Why Go?**: High concurrency (goroutines) for handling the relay and archiver alongside the API. Static binary compilation prevents "it works on my machine" issues.
*   **Key Libraries**:
    *   `net/http`: Robust standard library server.
    *   `modernc.org/sqlite`: **Critical Choice**. This is a CGo-free port of SQLite. It allows the binary to be cross-compiled (e.g., Mac -> Linux ARM64) without needing a C toolchain or `glibc` on the target machine.
    *   `golang.org/x/crypto`: For `bcrypt` password hashing and `chacha20poly1305` (if needed for future encryption).

### 2.2 Storage: SQLite (WAL Mode)
*   **Configuration**: `PRAGMA journal_mode = WAL` (Write-Ahead Logging).
*   **Why**: WAL allows **concurrent readers** while a single writer is active. This is essential for serving the dashboard (reads) while ingesting analytics (writes) simultaneously.
*   **Busy Timeout**: `_pragma=busy_timeout(5000)` handles lock contention by waiting 5s before failing, smoothing out traffic spikes.

### 2.3 Deployment: Docker & Alpine
*   **Multi-Stage Build**: The `Dockerfile` uses a `builder` stage (Go image) and a `runner` stage (Alpine).
*   **Result**: A tiny image containing only the static binary and root certificates.
*   **Security**: The container runs as a non-root user (`uid=1001`), preventing container-breakout attacks from gaining root on the host.

### 2.4 External Integration: Google Sheets
*   **Component**: `cmd/archiver`.
*   **Tech**: `google.golang.org/api/sheets/v4`.
*   **Auth**: Service Account JSON (`google-credentials.json`).
*   **Function**: Runs as a subprocess or cron job. Fetches stats from the local API (`localhost:8080/api/stats/summary`) and appends a row to a designated spreadsheet.

---

## 3. "Genius" Engineering Decisions
*Standout features that demonstrate high-level architectural thinking.*

### 3.1 The Cryptographic Audit Log (Blockchain-lite)
**The Feature:** The `AppendAuditLog` function in `admin_ops.go`.
**Why it's Genius:** Every audit log entry (e.g., "User A deleted a record") contains a hash of its own content **plus the hash of the previous row**.
-   **Formula**: `RowHash[N] = SHA256(Payload[N] + RowHash[N-1])`
-   **Value**: This creates a tamper-evident chain. If a rogue admin tries to `DELETE FROM logs` to hide their tracks, the chain verification tool (`/api/admin/audit/verify-chain`) will fail. **This proves system integrity.**

### 3.2 The "Smart Outbox" Pattern
**The Feature:** `ingest_outbox` table and `internal/relay` worker.
**Why it's Genius:**
-   **Reliability**: The API *never* talks to Postgres directly. It writes to local SQLite. If Postgres is down, the API stays up, and data queues in the outbox.
-   **Performance**: The HTTP request finishes instantly (SQLite write speed). The Relay handles the network latency to Postgres asynchronously.
-   **Dead Letter Queue**: If a message fails 10 times, it moves to `outbox_dead_letter` for manual inspection, preventing "poison pills".

### 3.3 Content Security Policy (CSP) with Nonces
**The Feature:** A unique cryptographic "nonce" (e.g., `nonce-abc123XYZ`) generated for *every single HTTP request*.
**Why it's Genius:**
-   The server injects this nonce into `index.html`: `<script nonce="abc123XYZ">...</script>`.
-   It sends a header: `Content-Security-Policy: script-src 'nonce-abc123XYZ'`.
-   **Result**: Eliminates Cross-Site Scripting (XSS). Even if an attacker injects a script tag, the browser blocks it because the attacker cannot guess the random nonce.

---

## 4. Security Architecture Deep Dive

### 4.1 Authentication Layers
1.  **Session Token (Dashboard)**: HttpOnly, Secure cookies. Valid for 24 hours.
2.  **Shared Secret (Ingest)**: `X-DO-SECRET` header verified with `crypto/subtle.ConstantTimeCompare` (prevents timing side-channel attacks).
3.  **Step-Up Authentication (Sudo Mode)**: 
    -   Destructive actions (e.g., `DangerClearData`) require re-entering the password.
    -   Issues a short-lived `stepup` token (15 mins).
    -   **Benefit**: Mitigates session hijacking risks.

### 4.2 Input Sanitization & Privacy
-   **Path Traversal**: The `spaHandler` uses `filepath.Clean` and verifies the path prefix to ensure no files outside `./static` are served.
-   **JSON Privacy Redaction**: The `sanitizeRawSnapshotPayload` function recursively walks arbitrary JSON during ingestion to **redact sensitive keys** (`ip`, `email`, `ipv4`) before they hit the database logic.

### 4.3 Configuration Security
-   **Secrets**: Injected via separate Environment Variables or Docker Secrets (managed by `deploy.sh`).
-   **Feature Flags**: Stored in DB (`feature_flags` table). Allows toggling blocking features (like "Disable Sync") at runtime without code deploys.

---

## 5. Operational Excellence

### 5.1 Deployment Strategy (In-Place Recreate)
The `scripts/deploy_main_inplace.sh` script handles zero-hassle updates:
1.  **Clones/Pulls** the repo.
2.  **Preserves State**: Copies the existing `.env` and `google-credentials.json` to the new build context.
3.  **Rollback Tagging**: Tags the *current* running image as `rollback-TIMESTAMP` before building the new one.
4.  **Atomic Switch**: Uses `docker compose up -d --force-recreate` to switch containers efficiently.
5.  **Health Check**: Loops `curl localhost:8080/health` to verify the new container is up.

### 5.2 Observability "Glass Box"
-   **Structured Logging**: All logs are JSON-formatted with `trace_id` and `correlation_id` to trace requests across the distributed system.
-   **Self-Monitoring**: The system writes to `system_alerts` if:
    -   The outbox backlog grows > 500 items.
    -   The Postgres sync fails for > 15 minutes.
    -   New, unknown JSON paths appear in the ingestion payload (Schema Drift).

---

## 6. Critical Analysis & Roadmap

### 6.1 The Risks (Be Honest)
1.  **Single Point of Failure (SPOF)**: The SQLite DB is a single file on a single disk. If the VM dies, the service dies.
2.  **Vertical Scaling Limit**: SQLite allows only **one writer**. Massive ingestion spikes (>500 req/s) will cause locking (busy timeout).

### 6.2 The Fix (Roadmap)
1.  **Migrate to Postgres Logic**: Make Postgres the *primary* source of truth. This allows multiple API instances (horizontal scaling) to connect to one DB.
2.  **Decoupling**: Move ingestion to a Message Queue (Redis/Kafka) so the API just accepts data (~1ms) and workers process it later.
3.  **High Availability**: Run 2 instances behind a Load Balancer (requires Postgres migration first).

---
**Summary for Interview**:
The Oracle Backend is a highly optimized **monolith** that punches above its weight. It uses advanced reliability patterns (Outbox, Hash Chains) to deliver enterprise-grade data integrity on a simple, maintainable stack. It is built to be "secure by default" and "easy to operate".
