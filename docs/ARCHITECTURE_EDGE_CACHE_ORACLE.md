# Architecture: Cloudflare Edge Cache + Oracle Source of Truth

## 1. Purpose
This document defines the production runtime architecture for public website data and telemetry.

Principles:
- Cloudflare handles edge reads/writes and short-lived cache.
- Oracle is the persistent source of truth.
- Website sessions are data-stable while open (no mid-session metric drift).
- Manual changelog files are source-controlled and generated into website/extension artifacts.

## 2. Runtime Components
- `website/` (SvelteKit static frontend)
- `cloudflare-worker/` (edge gateway + scheduler + cache facade)
- `oracle-backend/` (Go API + DB + admin dashboard)
- `manual/changelog/*` (manual release and pill-rule source)
- `tools/sync-manual-changelog.mjs` (generator)

## 3. Read Path (Website Data)
1. Browser requests website pages.
2. Website API layer checks session pin/local cache/bootstrap snapshot.
3. If needed, it fetches `GET /api/site/v1/snapshot` from Cloudflare Worker.
4. Worker returns cached snapshot from KV or refreshes from Oracle snapshot endpoint.
5. Oracle snapshot remains authoritative for totals/maps/status.

## 4. Write Path (Website Telemetry)
1. Website sends event batches to `POST /api/site/v1/events`.
2. Worker validates CORS and request shape, then forwards to internal ingest path.
3. Durable Object/worker queueing manages retries/backoff.
4. Oracle ingests and stores aggregate/raw records according to backend policy.

## 5. Snapshot and Session Semantics
- Snapshot interval target: 3 hours.
- Website pins snapshot for current open session.
- Newer snapshots are staged for next refresh/reopen.
- No placeholder zero flashes: bootstrap/last-good/session cache is used first.

## 6. Scheduling Model (UTC)
- Oracle->edge snapshot refresh: `00,03,06,09,12,15,18,21`.
- Edge->Oracle flush slot: `01,04,07,10,13,16,19,22`.

## 7. Manual Changelog Architecture
- Source files:
  - `manual/changelog/website-changelog.manual.md`
  - `manual/changelog/extension-changelog.manual.md`
  - `manual/changelog/extension-pill-rules.manual.json`
  - `manual/changelog/release-version.manual.json`
- Generator writes runtime artifacts into `website/src/lib/content` and `extension/entrypoints/utils`.
- Runtime changelog customization from cloud dashboards is treated as legacy.

## 8. Security Controls
- Origin-gated write endpoints.
- `X-Requested-With` header on write clients.
- Strict JSON decode on backend write routes.
- Admin and danger actions protected server-side (session + step-up where applicable).
- No raw IP exposure in public website responses.

## 9. Reliability Controls
- Retry with bounded behavior.
- Dead-letter/replay controls in admin flows.
- Snapshot fallback and stale-safe behavior on frontend.
- Cross-layer health tests in worker/oracle test suites.

## 10. Ownership Boundaries
- Frontend UX/state behavior: `website/`.
- Edge transport/caching/schedule: `cloudflare-worker/`.
- Persistent analytics and admin APIs: `oracle-backend/`.
- Release/changelog content source: `manual/changelog/*`.
