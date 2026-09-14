# Plan: Cut Cloudflare Worker request usage ~6×

Date: 2026-09-14
Status: approved (user), no-commit execution mode

## Goal

`cqd-analytics` (Workers free tier, 100k requests/day shared across Worker + Durable Object)
hits its daily limit. Dominant cost: extension `/config` polling every 3h = 8 fetches ×
(worker request + DO request) = ~16 counted requests per daily-active user per day.

Target: ~4–6 counted requests/DAU/day, plus outage resilience for queued download events,
without breaking old-extension or website compatibility.

## User decisions (locked)

- **Daily poll + KV-backed /config** (both)
- **maxRetry resilience** (5 → 20)
- **Quota guard hardening** (count all DO requests, emergency cutoff 90k → 70k)
- **Website snapshot TTL 3h → 6h**
- **NO git commits** — all changes stay uncommitted for user review

## Design decisions

### KV-backed /config

- Worker serves `GET /config` from `SITE_SNAPSHOT_KV` key `analytics:config:v1` before the
  DO proxy. KV reads are free (do not count toward the request limit).
- KV miss → existing `proxyToDO` path (unchanged, source of truth stays the DO).
- DO `/admin/update-config` writes the same KV snapshot after persisting DO state.
- Worker `scheduled()` refreshes the KV snapshot from DO `/config` on every cron tick
  (8/day) so emergency `remoteEnabled:false` propagates within ≤3h.
- KV payload = config fields + `changelogConfig` + `remoteEnabled`. It **excludes**
  `serverTimeUtc` (edge handler injects fresh `Date.now()`; a stale value would corrupt the
  extension's clock-drift correction) and `committedSeq` (stale value could wrongly prune
  the extension queue; ack-based removal is the primary mechanism, and the extension skips
  absent fields).
- Response served with `cache-control: no-store`.

### Quota guard hardening

- DO counts every request: new persisted field `doRequestsToday`, incremented in `fetch()`.
- `/config` quota descriptor uses `max(reqCountToday, doRequestsToday)`.
- `QUOTA_VERY_HARD_LIMIT` 90_000 → 70_000 so `remoteEnabled:false` lands before
  Cloudflare's 100k wall (≤3h KV staleness accepted; bounded by client-side
  `maxDailyRequests` cap).

### maxRetry resilience

- Extension `DEFAULT_CONFIG.maxRetry` 5 → 20 and DO default `configMaxRetry` 5 → 20
  (clamp ranges already allow 0–20 on both sides). With capped 24h backoff steps, queued
  events survive multi-day outages instead of being dropped after ~4–5h.

### TTL 3h → 6h

- Worker `SITE_CACHE_TTL_SECONDS` and `SITE_CACHE_REVALIDATE_AFTER_MS` (index.ts:470–471).
- Website `ORACLE_SNAPSHOT_REFRESH_MS` (publicSite.ts:22).

## Tasks

1. Extension daily config poll: `CQD_ANALYTICS_CONFIG` alarm 180 → 1440 minutes
   (extension/entrypoints/background/analytics-alarm.ts). Startup refresh stays.
2. Worker KV-backed /config: intercept in index.ts, KV write in DO update-config, cron seed,
   `tests/edge-config.test.ts`.
3. maxRetry 5 → 20 (extension constants + DO default), drop-semantics test.
4. Quota guard: `doRequestsToday`, combined quota count, 70k cutoff, `/stats` exposure.
5. Snapshot TTL 3h → 6h (worker constants + website constant + pinned tests).
6. Closure: full test suites, close bd tickets, final report with manual-deploy checklist.

## Global constraints

- No git commits, no pushes, no `bd dolt push`.
- `/config` response shape backward-compatible (old 3h-poll extensions and new daily-poll
  extensions both work; `normalizeConfig` clamps, absent fields are safe).
- TDD: failing test first for every behavior change.
- No unrelated refactoring, no Cache API layer, no website telemetry changes (YAGNI).
- Deploy (wrangler deploy, extension store update, website rebuild) is a manual user step
  after review.
