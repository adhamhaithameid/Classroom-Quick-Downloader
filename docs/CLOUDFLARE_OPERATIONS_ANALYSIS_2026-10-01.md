# Cloudflare Stack — Operations & Quota Analysis (2026-10-01)

Companion to `docs/SECURITY_AUDIT_WEBSITE_2026-09-30.md`. Scope: `cloudflare-worker/` (cqd-analytics), `extension/` request behavior, `website/` request economy. Evidence: sealed Mimosa scans (`scan-2026-10-01T00-04-16.953Z-de4289b30612`, `scan-2026-10-01T10-01-20.658Z-961566ed74fa` — 43 findings each, unchanged sets), Cloudflare GraphQL invocation analytics, live `/stats` reads, full code audit.

## 1. The quota problem — measured

| Day | Worker requests |
|---|---|
| 2026-09-24 | 138,449 |
| 2026-09-25 | 127,252 |
| 2026-09-26 | 122,082 |
| 2026-09-27 | 121,397 |
| 2026-09-28 | 121,186 |
| 2026-09-29 | 123,430 |
| 2026-09-30 | 122,837 |
| 2026-10-01 (to 10:00) | 56,516 |

Free plan = 100k/day. The quota crosses **every late afternoon/evening**: from that moment until midnight UTC, everything fails with 429/error 1027 — site data sections, extension `/track`, and (before the 00:15-UTC fix) the nightly flush.

### Where the requests come from

| Source | Est/day | Note |
|---|---|---|
| **Extension `GET /config` on every service-worker wake** | **~95–99%** | MV3 SW is woken by a 5-minute flush alarm (12×/h) + event wakes; `refreshRemoteAnalyticsConfig` runs **ungated on every wake** (`extension/entrypoints/utils/analytics/index.ts:168`, `background/analytics-alarm.ts:25,48`, `background/index.ts:142`). ~100–290/day/active-user × ~400–1,200 DAU. |
| Website force-refresh per page load | ~1–4 per visit | `stores/websiteSnapshot.ts:136-139` always follows a cached load with `force:true`. |
| Extension `POST /track` | ~0.15–1/user | Weekly flush mode; server dedupes. |

### Fixes

| # | Fix | Status |
|---|---|---|
| Q1 | Nightly flush moved **23:00 → 00:15 UTC** (post-reset), `dailyFlushWindowStartUtc` default 23→0 | **Implemented** (`perf/flush-after-quota-reset` — pending Mimosa gate decision) |
| Q2 | Extension: gate `refreshRemoteAnalyticsConfig` with a 12–24h local staleness check; drop the useless daily changelog alarm (a pure SW wake); consider lengthening the 5-min flush alarm to ~30–60 min in weekly mode | **Beaded (extension release required)** — the durable fix; load drops ~95% as users update |
| Q3 | Website: skip the `force:true` second fetch when the cached snapshot is fresh and non-bootstrap | **Beaded (small PR)** |
| Q4 | Server-side: `/config` has no IP rate limit; add one (mirrors `/track`'s) | Beaded |

Note: the Worker-level Cache API cannot reduce invocations (the worker still runs); on `workers.dev` there are no zone cache rules. Without a custom-domain cache rule or an extension release, the residual 1027 days are structural on free tier at ~1,000 DAU — Q2 is the only durable reduction.

## 2. Broken / never-running functionality

1. **Cron orphan (fixed?)**: `SITE_SNAPSHOT_REFRESH_HOURS_UTC = {0,3,6,9,…}` never matched the wrangler cron hours `{1,4,7,10,…}` — trends KV refresh, snapshot self-serve, and scrape-health alerting never ran via cron; the wrangler.toml comment ("0:00, 3:00, 6:00…") was wrong. **Fix**: align the hour set to the cron.
2. **Stale-alarm deadlock** (fixed in PR #812): past alarms blocked re-arming — 37-day pipeline freeze.
3. **`ADMIN_CORS_ALLOWED_ORIGINS` referenced but never defined** in wrangler.toml → the admin CORS allowlist is permanently empty (session-driven admin from the dashboard works because same-origin; cross-origin admin tooling would fail silently).
4. **Quota thresholds mislabeled**: `QUOTA_VERY_HARD_LIMIT = 70_000` equals `QUOTA_HARD_NORMAL_LIMIT = 70_000` — the "remote-off" emergency fires at the same count as the busy label; `QUOTA_HARD_LIMIT = 80_000` is unreachable for its stated purpose.
5. **DO flush window brittleness**: the archive flush only executes when the alarm lands exactly in UTC hour 0/23 — a delayed or missed alarm (DO eviction) skips the whole day. Consider a window (hour ≤ 1) or catching up in `alarm()`.
6. **Legacy changelog admin routes 410** while the DO still wires 8 handlers + the `auto_github` alarm sync path — unreachable at runtime (default `manual`, mode can no longer be set).
7. **`/release-notes` and `/changelog` worker pages** — no external caller left (extension + website generate local changelogs).

## 3. Security posture (this pass)

- Mimosa deep scans (2 sealed runs) — **43 findings, unchanged sets, all previously triaged**: ~30 `fetch`-sink SSRF advisories (env-only/allowlisted/fixed-origin targets; the scanner cannot model the guards), 4+2 oracle-backend env→exec false positives (fixed argv, gosec-triaged, backend severed), 2 mongo-sort false positives (no MongoDB), test-file innerHTML, CLI path-traversal accepted risk. Structural remediation = DO RPC migration (bead `e4v.2`, owner decision).
- **Live hardening now in production**: per-IP rate limits (events/uninstall), storage-export step-up, pipeline-health detail gating, `SESSION_BINDING_MODE=optional` (2 mismatches already recorded and logged — working as designed), SVG sink re-validation, CSP on the marketing site (CodeQL-clean), nightly archive prune.
- **Secrets hygiene**: `DO_SHARED_SECRET` missing from Actions secrets (backups' DO-dump silently skips). Rotation reminder issued after credentials were shared in chat — the Cloudflare API token and dashboard passwords should be rotated.

## 4. Hardcoded values worth extracting (no secrets committed)

| Location | Item |
|---|---|
| `cloudflare-worker/src/dashboard/main.ts:19-27` | Worker/site URLs, GitHub repo, **backup Sheet ID URL**, changelog URL → vars |
| `downloads_do.ts:456-463` | Quota thresholds (also see §2.4) |
| `downloads_do.ts:524-608` | Eight dated default changelog entries baked into DO source |
| `index.ts:477-495`, `38-41` | KV key names, refresh windows, session durations |
| `website/src/lib/config.ts:6-10` | Default worker/site URLs, site-verification token |
| `extension/.../constants.ts:77-84` | Production worker/site fallback URLs |

## 5. Dead / useless code (cleanup candidates)

Worker: `forwardArchivedBatchToOracle` + `oracleDeadLetters` (inert, `ORACLE_ENDPOINT` unset), legacy changelog admin 410 wiring + DO auto-sync alarm path, `/release-notes` + `/changelog` worker pages (no callers), `createSessionToken` (tests-only export), newsletter rollback marker blocks. Extension: `CHANGELOG_URL` (dead), daily changelog alarm (no-op wake), `applyRetryCap` (test-only duplicate), `Analytics.getStats` (uncalled), oracle-era popup copy strings. Website: `ORACLE_*` fallback constants, `fetchUninstallStats` (production-unused), `repoMarkdown.ts` (already deleted).

## 6. Extension behavior risks (next release)

- Urgent-flush path bypasses the `maxDailyRequests` client cap (daily flush is always "urgent" in `next_day` mode).
- Rate-limit budget increments before the send — failed flushes burn the daily budget.
- `Analytics.flush()` not awaited from the alarm handler — MV3 may kill the SW mid-POST (server dedupes, but the request is paid for).
- `refreshRemoteAnalyticsConfig` not serialized through `enqueueOp`; interleaved `saveMeta` can drop server-time-offset state; all errors swallowed silently.
- Extension default `dailyFlushWindowStartUtc: 1` vs server default (now 0) — server config wins after fetch; cosmetic.
- Schema drift: **none** — extension↔worker contracts verified compatible (no release blocker).

## 7. Recommended sequence (free tier)

1. Land Q1 (flush at 00:15 UTC) — pipeline becomes quota-immune.
2. Land Q3 (website force-refresh skip) — small PR.
3. Fix the cron/hour-set mismatch (§2.1) — restores trends/alerting.
4. Ship the extension release with Q2 (config staleness gate + alarm cadence) — the durable ~95% traffic cut; expect 1027 days to end as the fleet updates.
5. Add `ADMIN_CORS_ALLOWED_ORIGINS` to wrangler.toml or drop the code path.
6. Extract dashboard hardcoded URLs to vars; prune dead code in a cleanup PR.
7. Owner decisions pending: DO RPC migration (e4v.2), Cloudflare paid plan (declined for now), secret rotation (DO_SHARED_SECRET + the chat-exposed credentials).

## 8. Addendum — 2026-10-03 (owner decisions applied)

- **Free tier confirmed**; flush landed at 00:15 UTC (Q1 done, PR #815).
- **Free model hardened beyond Q2:** the extension no longer fetches `/config`
  at all (owner decision) — the daily config alarm and the service-worker
  start fetch are removed; the extension runs on built-in defaults. Free-fleet
  `/config` traffic drops to **zero**. `refreshRemoteAnalyticsConfig` remains
  implemented (24h staleness gate, tested) for the Pro re-enable behind a
  license gate. Trade-off accepted: the remote kill-switch no longer reaches
  free clients.
- **Q3 done:** the website now skips its force-refresh second fetch when the
  cached snapshot is fresh and non-bootstrap.
- **Cron/hour-set mismatch fixed (§2.1):** hourly cron; each hour-set gates
  its own ticks.
- **Deployment hygiene:** the nightly flush now self-heals through quota
  days (00:15 post-reset + retry ladder), `pipeline-health` shows a cosmetic
  `warn: flush_delayed` between daily flushes, and the stale-alarm deadlock
  class is fixed at the scheduler level.
- **Pro note:** re-enabling remote config for Pro requires the entitlement
  gate (Phase 2, `0h4d.2.2`/`0h4d.2.3`) — until then free clients are
  intentionally config-free.
- **Operational workflow:** the rtk CLI (rtk-ai/rtk) is adopted for the
  maintainer's AI-assisted workflow (output compression for LLM context);
  ZCode has no plugin so integration is command-prefix based.

