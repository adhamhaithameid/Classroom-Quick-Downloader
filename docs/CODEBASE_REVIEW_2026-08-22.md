# Full Codebase Review — 2026-08-22

Scope: entire repo, reviewed per section → category → sub-category.
Method: 5 parallel deep-review passes (extension, cloudflare-worker,
oracle-backend, website, infra/root) synthesized here.

**Finding tally:** 2 CRITICAL · 12 HIGH · 20 MEDIUM · ~25 LOW

---

## 1. `extension/` (~66k LOC TS/TSX)

### 1.1 Build & manifest
- **1.1.1 `wxt.config.ts`** — MV2/MV3 manifest; perms downloads/storage/alarms, 6 host perms, strict CSP, gecko id.
  - 🔴 [MEDIUM] `publicDir:'src'` verbatim-ships the whole TS source tree into store zips (bloat + source disclosure). (`wxt.config.ts:67`)
  - 🔴 [HIGH] No `identity` permission / `oauth2` block while v3 engine expects `chrome.identity.getAuthToken` → token always null, API client silently dead; comment claims otherwise. (`wxt.config.ts:34-46`, `src/engines/v3/api/token-provider.ts:5`)
- **1.1.2 Permissions scope** — no `onMessageExternal`/`externally_connectable` anywhere ✓.

### 1.2 `entrypoints/background/` (~1.4k ln)
- **1.2.1 `index.ts`** — listener orchestration; every listener enforces `sender.id === chrome.runtime.id`. ✅
  - 🟡 [MEDIUM] `CQD_REGISTER_BYPASS_URL` stores arbitrary `message.url` without the validator gate. (`background/index.ts:235-238`)
- **1.2.2 `download-handler.ts`** — authuser rotation 0–9 + bypass-tab fallback.
  - 🟡 [MEDIUM] 403 text-heuristic cycles authuser needlessly on false positives. (`drive_bypass.content.ts:145-157`)
- **1.2.3 `state.ts`/`cleanup.ts`** — pending maps + TTL sweeps ✅ memory hygiene.

### 1.3 `entrypoints/content/` (~11k ln) — V1 injection engine
- **1.3.1 `observers.ts`** — MutationObserver + rescan.
  - 🟡 [MEDIUM] Unconditional forever-interval + subtree-wide observer rescans idle tabs. (`observers.ts:248-258`)
- **1.3.2 `button-factory.ts`** — DOM-only buttons (createElement/textContent, zero innerHTML) ✅ XSS-safe.
- **1.3.3 `i18n.ts`** (3,847 ln) — ~20 locales parsed into every context.
  - 🟡 [MEDIUM] RTL dir set redundantly in 4 scripts; if none load, RTL badges misplace silently.
- **1.3.4 `smart_detector*`, `flags/state/styles/theme`** — support layer.

### 1.4 Feature entrypoints
- **1.4.1 `drive_bypass.content.ts`**
  - 🔴 [HIGH] Auto-clicks "Download anyway"/submits forms on ANY drive.google.com tab incl. user-initiated visits — consent-free virus-warning bypass. (`:14-17,163-203`)
- **1.4.2 `download_all.content.ts`** (1,407 ln) — batch download + header button + RTL.
- **1.4.3 `comment_frame`/`edited_frame`/`student_work_*`** — badges/resolver bridges.
- **1.4.4 `v2_bootstrap.content.ts`** — dynamic-import engine wiring.
- **1.4.5 `popup/App.tsx`** (1,651 ln) — stats/toggles UI monolith. [LOW] reviewability.

### 1.5 `entrypoints/utils/analytics/` (~1.6k ln)
- IndexedDB queue, rate-limiter, flush → CF worker; rollup compaction to 500-event budget ✅.
  - ⚪ [LOW] "integrity" checksum = unkeyed 32-bit rolling hash (misleading name). (`storage.ts:451-459`)

### 1.6 `src/v2/` — engine architecture
- **1.6.1 model/** dom-scanner/reconciler/entities · **decision/** file-placement, keyword-loader, exclusion-engine, download-validator (URL allowlist+shape gate before `chrome.downloads.download`) ✅
- **1.6.2 selectors/** — 74 candidates × L1–L5 reliability scoring + self-heal ✅ brittleness contained.
- **1.6.3 render/, repair/, telemetry/** — button-renderer, deep-validator+correction-queue, budget-controller.
- **1.6.4 compat/shadow-compare → readiness-gate → launch-controller**
  - 🔴 [HIGH] DEFAULT_MODE `'shadow'` ships V1+V2 double scanning + 10s comparator interval + full-DOM snapshots to ALL users — permanent CPU/battery tax. (`mode-controller.ts:70`)
- **1.6.5 orchestrator/mode-controller**

### 1.7 `src/engines/` — registry, V1 wrapper, V2 DOM engine (1,090 ln), V3 stub
  - 🔴 [HIGH] V3 dead code shipping (see 1.1.1).

### 1.8 `src/student_work/` — resolver/extractor/button/url-classifier (~1.7k ln)
  - ⚪ [LOW] resolver pass-through HTTPS URLs render buttons that error later at download time. (`resolver.ts:180-216`)

### 1.9 tests/ — ~150 vitest files, HTML fixtures (incl. RTL Arabic), fuzz/xss/stress suites
  - ⚪ [LOW] jsdom-only; no real-browser e2e runner wired.

### 1.10 Local hygiene
  - ⚪ [LOW] `.wxt/brave-data/` holds a full browser profile (gitignored, verified untracked).

---

## 2. `cloudflare-worker/` (~27k LOC TS)

### 2.1 Config
- **2.1.1 `wrangler.toml`** — SQLite DO migration, KV/D1 bindings, 3h cron, prod Oracle pinned to nip.io:8080.
  - 🔴 [HIGH] Cron hours {0,3..21} vs `ORACLE_EXPORT_HOURS_UTC={1,4..22}` mismatch — scheduled telemetry push never fires (only DO alarm covers it). (`wrangler.toml:52` vs `src/index.ts:2792`)
  - ⚪ [LOW] 100% observability sampling = avoidable cost; `coverage/` committed; tsconfig excludes tests from typecheck.

### 2.2 `src/index.ts` (edge router, 2,798 ln)
- CORS/CSRF/CF-Access gates, HMAC sessions + fingerprint binding, dashboard/login/danger step-up, site-snapshot KV cache w/ stale-fallback, circuit-breaker proxy to Oracle.
  - 🔴 [MEDIUM] Some route families lack Origin requirement — rate-limit is sole bound. (reported at `index.ts` track paths)
  - ⚪ [LOW] Session cookie payload embeds full client IP readable by holder. (`index.ts:199`)
  - ⚪ [LOW] Circuit breaker is per-isolate module state. (`index.ts:492`)

### 2.3 `src/downloads_do.ts` (+quota/constants/helpers, ~7k ln)
Single global DO (`idFromName("downloads")`): ingest, validation, idempotency, per-IP limits, hourly pre-aggregation, alarm-driven daily flush w/ backoff, website-telemetry queue/DLQ, changelog engine.
- 🔴 **[CRITICAL]** Whole DO state = ONE `storage.put("analytics_state")` blob written on EVERY request path (incl. rejected/rate-limited); at 50k buffer + 4k×64 queue + 50k dedupe IDs it approaches the SQLite-KV value limit → persist() throws → ALL writes fail. (`downloads_do.ts:2525,3341`)
- 🔴 [HIGH] Oracle-bound batches have NO attempt cap/DLQ: schema drift ⇒ HTTP 400 retried forever, head-of-line blocks later batches. (`:5635-5746`)
- 🔴 [HIGH] `loginAttempts` entries never pruned → unbounded growth inside the same blob. (`:6493-6618`)
- 🟡 [MEDIUM] Debug/reset path can delete the only alarm → daily flush + retries stall until DO restart. (`:2623,4529`)
- 🟡 [MEDIUM] `cancelled` events counted into `totalFail` sent to Oracle vs separate DO counters — cross-system semantic drift. (`:5420,5540`)
- 🟡 [MEDIUM] Cold start re-parses multi-MB state per construction; one global DO serializes all traffic. (`:1752`)
- 🟡 [MEDIUM] Idempotency window trimmed to 5,000 IDs → old replayed IDs double-count after 5k newer events. (`:3634`)
- 🟡 [MEDIUM] `forwardedCount` incremented before fetch resolves → failures permanently inflate delivery metrics. (`:5716`)
- ⚪ [LOW] `do-merge-${Date.now()}` batchId ms-collision risk. (`:5284`)

### 2.4 `src/dashboard/` (~9.1k ln server-rendered admin UI)
Escaped interpolation + CSP nonce ✅.
  - ⚪ [LOW] Third error-envelope shape alongside index.ts and proxied plain-text.

### 2.5 Shared modules — types.ts contract w/ oracle strict decoder, oracle-endpoint HTTPS resolver, timing/ip_utils/release-notes/assets ✅
### 2.6 scripts/ + tests/ — ip drift harness; 20 test files incl. fuzz/load/security/timing ✅

---

## 3. `oracle-backend/` (Go + SQLite)

### 3.1 `cmd/app/` (~6.9k) — routing, auth/step-up middleware, CSP/CSRF headers, schedulers, SPA server
- 🔴 **[HIGH]** Step-up enforcement is opt-in via DB flag DEFAULTING FALSE → missing flag row = all ~40 danger routes need only the shared password (fail-open). (`cmd/app/auth.go:115-123`, `internal/handlers/admin_ops.go:147-148`)
### 3.2 `cmd/archiver/` — daily Sheets export subprocess via loopback + secret ✅
### 3.3 `internal/handlers/` (24 src / 78 test files)
- **3.3.1 ingest/batch** (`store_batch.go` 1.4k) — shared-secret ingest, WAL tx aggregates, IP redaction, PG-primary mode.
  - 🟡 [MEDIUM] Non-JSON snapshot bodies persisted UNREDACTED when parse fails. (`store_batch.go:615-619`)
- **3.3.2 public_website** (2.4k+) — CORS-allowlisted public APIs, origin-required writes, structured errors ✅
- **3.3.3 admin ops + SQL console** — flags/outbox/alerts/retention/DR/records CRUD/raw-SQL behind flag+step-up.
  - 🔴 [HIGH→MEDIUM] `INSERT INTO x SELECT * FROM <deny-listed>` reads restricted tables via validated-target-only check. (`admin_sql.go:200-208`) *(rated HIGH in raw report; exploit requires admin auth)*
- **3.3.4 auth+step-up** — bcrypt login, persisted sessions/rate-limits, 15-min step-up cookie bound to parent session.
  - ⚪ [LOW] Single shared password model, sessions logged as "viewer".
- **3.3.5 audit** — BEGIN IMMEDIATE hash chain + HMAC checkpoints + verify endpoint ✅ done right.
  - 🟡 [MEDIUM] Paginated verify resets `prev` to zeros at offset≠0 → false mismatches; verifies against writable handle. (`admin_audit.go:207`)
- **3.3.6 backups** — VACUUM INTO w/ filename regex + canonicalization ✅
- **3.3.7 migrations/deployments/store-sync/flags/changelog/newsletter/uninstall** — control-plane CRUD under auth(+step-up writes) ✅
- **3.3.8 website ops** — publish/pull/reconcile w/ monotonic-total guards ✅
- Error handling: 🟡 [MEDIUM] three envelope styles; raw err.Error() leaks in stats handlers.
### 3.4 `internal/db` — WAL, busy_timeout, synchronous=FULL, read-only handle, idempotent migrations ✅
  - ⚪ [LOW] FULL sync + per-append checkpoint = fsync cliff under load; auth shares analytics DB file.
### 3.5 `internal/model|observability|relay` — DTOs, request-ID correlation, SQLite→PG outbox relay ✅
### 3.6 `dashboard/` + `static/`
  - ⚪ [LOW] Stale `oracle-dashboard.legacy.js` (231KB) served publicly next to current bundle.
### 3.7 `scripts/`+deploy — deploy_main_inplace.sh copies legacy .env, persists GIT_COMMIT.
  - ⚪ [LOW] Real telemetry DBs live in working-tree data/ dirs on VM.
### 3.8 tests/ — k6 templates, Go load harness, UAT checklist; 78 test files vs 24 src ✅ exceptional volume

---

## 4. `website/` (SvelteKit marketing site)

### 4.1 Config — adapter-static→build/, PUBLIC_BASE_PATH, prerender warns-only
  - 🟡 [MEDIUM] Prerender failures non-fatal ('warn') → broken links ship silently. (`svelte.config.js:16-20`)
### 4.2 Routes (~18k LOC)
- **4.2.1 Core** — layout (714 ln), overview (4,051 ln) & overview-editor (3,943 ln near-clone twins).
  - 🟡 [MEDIUM] 95%-duplicated 4k-line twins, both prerendered/published.
- **4.2.2 Content/legal** — faq/privacy/changelog/uninstall/site-map.
- **4.2.3 SEO landing pages** — 6-ln wrappers over `seoPages.ts` (465 ln).
  - 🟡 [MEDIUM] Thin/templated doorway-style content across ~9 pages ≈300 words each.
- **4.2.4 Install/watch/compare** — video pages w/ sitemap entries.
- **4.2.5 Legacy** — emails/ (213 ln + redirect) → emails2/ (911 ln live); landing2/; samples/.disabled.
  - 🔴 **[CRITICAL]** `emails/+page.svelte:20` unsanitized `{@html emailBodyHtml}` sink (currently unreachable via redirect — delete the page before a refactor revives it).
- **4.2.6 Endpoints** — sitemap.xml/robots.txt/indexnow.
  - 🟡 [MEDIUM] Sitemap lastmod = build date for every URL (false freshness).
  - ⚪ [LOW] Non-standard Host directive; /emails2 not disallowed.
### 4.3 `src/lib/`
- **4.3.1 api/publicSite.ts** (849 ln) — coercion helpers, AbortController timeouts, 4-tier snapshot fallback ✅
  - 🔴 [HIGH] Snapshot "next" pinning defeated — writeSnapshot/writeNext byte-identical; reader prefers NEXT → reloads adopt new snapshot against design. (`publicSite.ts:106-124,95,672`)
  - 🔴 [HIGH] Memory-cache hit ignores refresh window + store forces exactly one refresh → long-lived tabs go stale-forever. (`:643-645`, stores 121-135)
  - ⚪ [LOW] Composite generatedAt=fabricated Date.now(); bootstrap relabeled 'edge-backend'; snapshotInFlight dead.
- **4.3.2 analytics/websiteEvents.ts** (276 ln) — capped queue, 15s flush, beacon-on-hide.
  - 🔴 [HIGH] Split-brain: beacon → WORKER_BASE_URL events endpoint, fetch → SITE_BACKEND_BASE_URL api/site/v1/events (different backends!); dropBatch on sendBeacon()==true loses 4xx/5xx events; beacon omits X-Requested-With. (`websiteEvents.ts:179-181` vs `publicSite.ts:805`)
  - 🔴 [HIGH] flushWebsiteEvents early-return while flushing skips beacon on pagehide → hidden-flush loss. (`:189`)
  - ⚪ [LOW] sessionId persists indefinitely in localStorage (pseudo-identifier; check privacy page).
- **4.3.3 stores/websiteSnapshot.ts** — state machine, refcounted init ✅ (modulo 4.3.1 staleness)
- **4.3.4 components/** — SeoMeta (JSON-LD escaped ✅), RotatingGlobe (754 ln), CountryHeatmap, MediaLoader, BalloonsOverlay, AnimatedNumber…
  - ⚪ [LOW] Globe/Heatmap/LoadingScreen/SeoContentPage untested.
- **4.3.5 svgCatalog/** — NEW types.ts single-source ✅ cycle fixed this week; placements+JSON.
- **4.3.6 celebration/, content/, seo/, uninstall/, browser/detect** — balloons engine, generated changelog, INDEXABLE_SITE_PATHS sitemap source ✅
### 4.4 static/ — `_worker.js` CF Pages Function (301 legacy host, 308 /emails→/emails2) ✅ needed by CF
  - 🟡 [MEDIUM] Redirect logic triplicated (_worker.js ↔ dead hooks.server.ts ↔ emails/+page.server.ts); two hops for legacy+/emails.
  - ⚪ [LOW] config.ts window.location.origin fallback → host-dependent canonicals on previews.
### 4.5 tests/ — 14-file layered pyramid (smoke→fuzz/load/reliability) ✅ taxonomy rare for marketing sites
  - ⚪ [LOW] Zero browser/E2E layer; _worker.js redirect rules untested.

---

## 5. Infrastructure (root, .github/, tools/, data/)

### 5.1 Root config
- package.json: 45-script test matrix; pnpm.overrides pins (ADR-0006); playwright config; commitlint+husky (commit-msg only).
  - 🟡 [MEDIUM] Root `version: 3.2.7` managed by nothing (sync SOURCES omits root) → silent drift.
  - ⚪ [LOW] No pre-commit hook (fast lint/typecheck) — everything deferred to CI.
- renovate.json: automerge minor/patch/pin/digest.
  - 🟡 [MEDIUM] No `minimumReleaseAge` window → brand-new (possibly compromised) releases can automerge.
- codecov.yml ✓ · no CODEOWNERS.
### 5.2 .github/workflows (17, all SHA-pinned, least-privilege permissions, zero pull_request_target ✅)
- ci.yml (9 jobs + aggregate gate) · nightly-tests.yml · github-pages.yml (graph) · website-deploy.yml · deploy-cloudflare-worker.yml · oracle-dashboard-deploy.yml · extension-distribution.yml · version-bump.yml (fixed this week) · version-sync.yml · security scans (codeql/gitguardian/socket) · https-endpoint-monitor · duplicate-pr-check · dependency-backlog.
  - 🔴 [HIGH] `patches/eslint@10.0.x.patch` ×4 orphaned (no patchedDependencies declared) — dead supply-chain-looking artifacts.
  - 🟡 [MEDIUM] version-bump PRs use GITHUB_TOKEN → its events don't trigger other workflows → bump PRs run no checks.
  - 🟡 [MEDIUM] Go toolchain drift: ci.yml hardcodes "1.26.6", nightly uses go-version-file.
  - 🟡 [MEDIUM] Same action pinned at two majors across workflows (setup-go v7 vs v5).
  - 🟡 [MEDIUM] oracle-dashboard-deploy does `git reset --hard origin/main` on VM + SSH host key never verified.
  - ⚪ [LOW] socket-security runs bare pnpm install; gitguardian carve-out targets disabled dependabot; duplicate-pr-check heuristic misfires; monitoring overlap (endpoint-monitor vs post-deploy smoke vs nightly); smoke-backup.db (256KB binary) committed; extension-distribution publishes AMO on any v* tag w/o environment gate.
### 5.3 tools/ (~5.5k ln) — version/changelog sync, search indexing, graph pipeline (rebuilt this week), phase12/13 rollout, schema-compat preflights.
  - ⚪ [LOW] validate.sh/verify_oracle.sh/test_*.sh use `set -e` without `-euo pipefail` (validate.sh is CI-invoked).
### 5.4 data/, emails/, verification/, patches/, .beads/
  - See 5.2 patches HIGH; data/backups/smoke-backup.db committed binary; .beads Dolt DB committed ✓ (no issues.jsonl export yet).

---

## 6. Cross-cutting themes

1. **Fail-open defaults** — step-up flag (3.1), shadow mode for everyone (1.6.4), prerender warnings (4.1). Prefer default-deny/opt-in.
2. **Unbounded state** — DO blob (2.3), loginAttempts (2.3), localStorage sessionId (4.3.2).
3. **Silent divergence pairs** — event flush dual backends (4.3.2), cancelled-count semantics (2.3), cron/export hours (2.1.1), Go toolchains (5.2).
4. **Error-envelope fragmentation** — 3+ shapes across worker/oracle/website.
5. **Dead code carrying risk** — emails/ {@html} (4.2.5), V3 engine (1.7), hooks.server.ts (4.4), legacy dashboard bundle (3.6), eslint patches (5.2).
6. **Strengths worth keeping**: extension URL validation gate, sender verification, audit hash chain, IP redaction discipline, SHA-pinned workflows, the test pyramids everywhere.
