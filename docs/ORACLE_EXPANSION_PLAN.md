# Oracle Backend Expansion Plan

Oracle evolves from analytics-only to a comprehensive **operational state board + platform registry**. This is the source of truth for all CQD systems and any future platforms.

Scope: B (operational state board) + C (platform registry). NOT A (feature flags — use Cloudflare Worker config endpoint for that).

Last updated: 2026-06-24

---

## Prerequisites — Fix Before Expanding

**Do not expand until these two regressions are fixed:**

| Issue | Fix | Why |
|-------|-----|-----|
| #415 | SQLite-backed session store | Dashboard sessions lost on every restart — Oracle can't be trusted as a state board if it can't hold its own auth state |
| #416 | Restore Google Sheets export | Archival pipeline down — if Oracle is source of truth, it must reliably archive its own data |

---

## Current State (v4.1)

Oracle already has solid foundations:
- Analytics ingestion + aggregation (hourly/daily breakdowns by browser, OS, country, file type)
- Admin hub (deployments, versions, control plane records)
- Creative hub (designs, email campaigns, newsletter subscribers)
- Danger zone (step-up auth, SQL console, dry-run support)
- Dual-DB (SQLite write path + Postgres outbox relay)
- Cryptographic audit log (chained SHA256, tamper-evident)
- Observability (structured logs, Prometheus metrics, alert sink, trace IDs)
- Google Sheets archiver
- Cloudflare traffic sync

What's missing for B+C: a formal **platform registry**, **operational state timeline**, and **deployment fact log** that any future platform can query.

---

## Phase B — Operational State Board

**Goal:** One place to see "what is running where, at what version, with what health."

### B1 — Deployment Fact Log

New DB table: `deployments`

```sql
CREATE TABLE deployments (
    id          INTEGER PRIMARY KEY,
    platform    TEXT NOT NULL,       -- 'extension', 'worker', 'oracle', 'website'
    version     TEXT NOT NULL,       -- semver e.g. '1.5.6'
    environment TEXT NOT NULL,       -- 'production', 'staging'
    deployed_at TEXT NOT NULL,       -- ISO 8601 UTC
    deployed_by TEXT,                -- 'github-actions', 'manual', agent name
    git_sha     TEXT,
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

**Writes:** CI workflows POST to `POST /api/admin/deployments` after each successful deploy.

**Reads:** Dashboard "Deployments" view — timeline per platform.

### B2 — Version Authority

New table: `platform_versions`

```sql
CREATE TABLE platform_versions (
    platform    TEXT PRIMARY KEY,    -- 'extension', 'worker', 'oracle', 'website'
    live_version TEXT NOT NULL,
    last_updated TEXT NOT NULL,
    changelog_url TEXT
);
```

Extension popup / website already queries Worker `/config` for version hints. Oracle becomes the upstream source: Worker syncs from Oracle on startup.

### B3 — Operational Events Log

New table: `operational_events`

```sql
CREATE TABLE operational_events (
    id          INTEGER PRIMARY KEY,
    platform    TEXT NOT NULL,
    event_type  TEXT NOT NULL,       -- 'deploy', 'incident', 'rollback', 'hotfix', 'maintenance', 'config_change'
    severity    TEXT NOT NULL,       -- 'info', 'warning', 'critical'
    title       TEXT NOT NULL,
    body        TEXT,
    started_at  TEXT,
    resolved_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

Dashboard "Incidents" view — searchable timeline of what happened and when.

### B4 — Dashboard Views

Add to Oracle dashboard:
- `/admin/deployments` — full deployment history, filterable by platform + environment.
- `/admin/incidents` — operational events timeline.
- `/admin/status` — current live versions per platform, last deploy time, health status.

### B5 — CI Integration

Add to every deploy workflow (worker, oracle, website):

```yaml
- name: Record deployment in Oracle
  run: |
    curl -s -X POST \
      -H "X-DO-Secret: ${{ secrets.ORACLE_ADMIN_SECRET }}" \
      -H "Content-Type: application/json" \
      -d '{"platform":"worker","version":"${{ github.ref_name }}","environment":"production","deployed_by":"github-actions","git_sha":"${{ github.sha }}"}' \
      https://oracle.classroom-quick-downloader.com/api/admin/deployments
  continue-on-error: true   # non-blocking — deploy must not fail if Oracle is down
```

---

## Phase C — Platform Registry

**Goal:** Any future platform (app, tool, service, side project) can register itself with Oracle and query operational state.

### C1 — Registry Table

New table: `platforms`

```sql
CREATE TABLE platforms (
    id           INTEGER PRIMARY KEY,
    slug         TEXT UNIQUE NOT NULL,  -- 'cqd-extension', 'cqd-website', 'future-tool'
    name         TEXT NOT NULL,
    description  TEXT,
    repo_url     TEXT,
    health_url   TEXT,                  -- endpoint Oracle pings for health
    status       TEXT NOT NULL DEFAULT 'active',  -- 'active', 'paused', 'retired'
    registered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_seen_at TEXT
);
```

### C2 — Registry API

Public (for future platforms to self-query):

```
GET  /api/registry/platforms          — list all active platforms
GET  /api/registry/platforms/:slug    — platform detail + recent deployments + health
POST /api/admin/registry/platforms    — register a new platform (admin auth)
PUT  /api/admin/registry/platforms/:slug — update platform metadata
```

### C3 — Health Polling

Oracle pings registered `health_url` endpoints on a schedule (cron every 5 min). Writes result to:

```sql
CREATE TABLE platform_health_checks (
    id          INTEGER PRIMARY KEY,
    platform_id INTEGER NOT NULL REFERENCES platforms(id),
    status      TEXT NOT NULL,    -- 'ok', 'degraded', 'down'
    latency_ms  INTEGER,
    checked_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

Dashboard `/admin/status` shows per-platform health graph (last 24h).

### C4 — Knowledge Store (Future)

As future platforms emerge, Oracle stores their operational knowledge:
- Config overrides per platform (key-value store)
- Shared secrets reference (not values — just pointers to where secrets live)
- Cross-platform relationships (this platform depends on that one)

This is deliberately deferred until there are at least 2 active registered platforms beyond CQD. Don't build infrastructure for phantom consumers.

---

## Implementation Sequence

```
Sprint 1:  Fix #415 (sessions) + #416 (Sheets export)
Sprint 2:  Phase B1 — deployments table + POST /api/admin/deployments
           Phase B2 — platform_versions table + dashboard view
           CI: add deployment record step to all deploy workflows
Sprint 3:  Phase B3 — operational events + dashboard incidents view
           Phase B4 — full dashboard status page
Sprint 4:  Phase C1+C2 — platform registry table + API
           Phase C3 — health polling goroutine
Future:    Phase C4 — knowledge store (when 2nd platform registers)
```

---

## Non-Goals

- Oracle is NOT a feature flag system. Extension feature flags stay in Cloudflare Worker `/config`.
- Oracle is NOT an API gateway. Each platform communicates with its own backend.
- Oracle is NOT a secret store. It stores pointers/references, never secret values.
- Oracle is NOT a CI/CD system. It records facts about deployments, it doesn't trigger them.

---

## Oracle Endpoint Hardening (Do First)

Current: worker `wrangler.toml` hardcodes `ORACLE_ENDPOINT = "https://129.151.233.229.nip.io:8080"` — IP-based, fragile.

Fix:
1. Confirm `oracle.classroom-quick-downloader.com` points to the Oracle VM.
2. Update `wrangler.toml`: `ORACLE_ENDPOINT = "https://oracle.classroom-quick-downloader.com"`.
3. Remove `.nip.io` dependency entirely.

This makes the Oracle URL stable, meaningful, and independent of IP address changes.
