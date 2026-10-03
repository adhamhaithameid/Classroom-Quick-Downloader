# Shallow-Module Audit — Deletion Candidates

**Audit date:** 2026-10-03
**Commit under test:** `4ed40c77` (branch `perf/free-model-no-config`; clean tree)
**Scope:** All five packages — `extension/src` (123 TS files), `website/src` (96 files), `cloudflare-worker/src` (22 files), `oracle-backend` (Go), root `tools/` + `scripts/`.
**Method:** Parallel per-package sweeps for shallow-module signatures (pass-through wrappers, re-export barrels, single-adapter seams, trivial single-use utilities, orphaned files). For **every** candidate, call sites were verified by grep across the package's `src/`, `entrypoints/`, and tests (excluding the candidate's own file). The **deletion test** was then applied: *imagine deleting the module — if complexity vanishes, it was a pass-through (delete); if complexity reappears across N callers, it was earning its keep (keep).*

**Definitions used (codebase-design skill):**
- A module's **interface** is everything a caller must know: signature + invariants + ordering constraints + config. Its **implementation** is what's inside.
- A module is **shallow** when the interface is nearly as complex as the implementation — callers learn almost as much as the implementation hides.
- Small ≠ shallow. A 20-line constant module used in 30 places is *deep* (real knowledge centralized, complexity would reappear everywhere if deleted). A 100-line wrapper with zero callers is *shallow and dead*.

---

## 1. Executive summary

**~5,000 lines of verified deletion candidates across the monorepo.** The live code is genuinely deep — small interfaces hiding real invariants, seams exercised by real adapters *and* test fakes, constants with dozens of call sites. The rot follows three distinct failure modes, none of which are classic pass-throughs:

1. **Aspirational architecture** (extension): tested-but-never-wired modules whose tests simulate a production caller that does not exist. Built ahead of adoption; adoption never came.
2. **Extraction islands** (worker, oracle-backend): code copied *out* of a live file into a new module "for modularization" but never wired in — so the live copy stayed, and the dead copy **drifted** into actively wrong values.
3. **Unused barrels/scaffolding**: re-export layers nobody ever adopted; every real consumer imports deep paths directly.

**Most dangerous find:** `cloudflare-worker/src/downloads_do/constants.ts` carries quota constants that **contradict live production values** (`QUOTA_SOFT_LIMIT = 50_000` dead vs `40_000` live; `QUOTA_VERY_HARD_LIMIT = 90_000` dead vs `70_000` live). Anyone "improving" the DO by importing this file would silently change quota behavior.

**Recommended execution order:** Tier 1 + Tier 3 first (dead things that lie, plus zero-risk barrels — no judgment calls, ~1,200L), one PR per package, then the bigger judged deletions.

---

## 2. Extension findings (~3,300L)

Call-site counts verified across `extension/src`, `extension/entrypoints`, `extension/tests`.

### 2.1 Never-wired clusters (delete or wire; all 0 production call sites)

| Candidate | Lines | Evidence | Verdict |
|---|---|---|---|
| `src/v2/compat/launch-controller.ts` + `readiness-gate.ts` + `shadow-diff-report.ts` | ~1,019 | Import only each other; production call sites **0**. Tests: `tests/v2-launch-controller.test.ts`, `tests/v2-readiness-gate.test.ts`, `tests/v2-shadow-diff-report.test.ts`. A graduation ceremony for a shadow-mode migration that already shipped (mode-controller + popup do the real switching). Note: sibling `shadow-compare.ts` **is** wired via `src/v2/orchestrator/orchestrator.ts:54` — the trio is not. | **DELETE** |
| `src/v2/model/viewport-observer.ts`, `src/v2/model/reconciler.ts`, `src/v2/render/download-all-renderer.ts` | ~875 | 0 production sites each; tests only (`tests/v2-viewport-observer.test.ts`, `tests/v2-reconciler.test.ts`, `tests/v2-download-all-renderer.test.ts`). Reconciler/renderer reachable only via the dead `v2/model/index.ts` barrel. Built ahead of the orchestrator, never connected. | **DELETE** |
| `src/v2/model/dom-scanner.ts` — the `DOMScanner` **class** | ~380 of 392 | `new DOMScanner` appears only in `tests/v2-dom-scanner.test.ts:107+`. Production imports are `import type { ScannedFile }` only (`src/v2/render/button-renderer.ts:34`, `src/v2/decision/file-placement.ts:47`, `src/v2/model/reconciler.ts:38`). | **DELETE the class, keep the 3 type aliases** (move into `entities.ts`) |
| `src/core/acquire/state-machine.ts` | 334 | 0 production; 3 test files. A pure `(state, event) → {state, effects}` reducer ("the pure heart of the download engine") that production never adopted — `entrypoints/background/download-handler.ts` still runs the old callback flow and keeps its **own duplicate** `AUTHUSER_CANDIDATES` at `entrypoints/background/state.ts:219` (drift already happened). Contains self-admitted dead code: `toBypassTab` (:151-165, "can never run") and the unreachable `bypass-tab` arm. | **DELETE** (or archive as spec) |
| `src/strategies/acquire/strategy-chain.ts` | 78 | 0 production, 1 test (`tests/strategy-chain.test.ts:8`). A "pluggable download seam" with nothing plugged into it; the real acquisition flow (`entrypoints/background/download-handler.ts`) never imports it. | **DELETE** |
| `src/core/acquire/download-url.ts` | 144 | 0 production, 2 tests. A "pure core mirror" of URL mapping that production never adopted; its constant is comment-enforced identical to `src/shared/drive-endpoint.ts` (:25) instead of importing it. | **DELETE** (or adopt for real) |
| `src/diagnostics/build.ts` | 95 | 0 production call sites — only `tests/diagnostics-build.test.ts`. A real, tested, PII-scrubbed diagnostics builder with no UI wired to it. | **DELETE** (revert-ready in git) **or wire into the popup** |

### 2.2 Orphaned port adapters (delete the adapters and their port declarations)

| Candidate | Lines | Evidence | Verdict |
|---|---|---|---|
| `src/adapters/browser/chrome-downloads-port.ts` | 115 | 0 importers in src, entrypoints, **and** tests (tests use `tests/fakes/fake-browser-port.ts`). Its header claims "production code can depend on BrowserPort" — none does. The one BrowserPort consumer (`withIdentityToken`) is itself tests-only; background uses raw `chrome.downloads`. | **DELETE** |
| `src/adapters/identity/chrome-identity-token-port.ts` | 61 | 0 production; tests only (`tests/contracts/ports-conformance.test.ts:233-289`). Duplicates `src/engines/v3/api/token-provider.ts` line-for-line (the file header admits it). Production token path is `ChromeIdentityTokenProvider` (`engine-v3.ts:117`, `discovery-service.ts:62`, `classroom-download-controller.ts:88`). | **DELETE** (+ `IdentityTokenRequest` + optional `getIdentityToken` from `contracts/ports.ts:128-159`) |
| `src/adapters/clock/system-clock.ts` + `src/adapters/scheduler/idle-scheduler.ts` | 58 | 0 production consumers. Fakes exist (`fake-clock.ts`, `fake-scheduler-port.ts`) so the seams are dual-adapter — but there is **no consumer side at all**: no production role takes `clock:` or `scheduleIdle`. | **DELETE** (+ `ClockPort`/`SchedulerPort` from `contracts/ports.ts:33-52`) until a role actually consumes them |

### 2.3 Dead barrels (all 0 importers, verified)

`src/download/index.ts` (15L — re-exports 10 `entrypoints/content/*` files; the whole `src/download/` dir exists only to be unused) · `src/engines/index.ts` (26L — "the ONE import you need"; every consumer imports deep paths) · `src/v2/selectors/index.ts` (32L) · `src/v2/model/index.ts` (35L) · `src/contracts/index.ts` (19L) · `src/ui/index.ts` (8L) · `src/i18n/index.ts` (6L) · `src/detection/index.ts` (8L) · `src/shared/analytics.ts` (21L) · `src/detect/shared/numerals.ts` (13L — migration shim whose consumers no longer exist; repoint its one test import at `src/core/detect/numerals`).

**Verdict: DELETE all.** ~170L of pure forwarding plus a whole dead `src/download/` directory.

### 2.4 Dead contract surface (delete the declarations)

- `contracts/ports.ts` — `LogPort` (:60), `NetworkPort` (:68): no adapter, no fake, no consumer.
- `contracts/topics.ts` — `WorkerTopicMap` (:133-142), `AcquirePhase` (:70-76), `'download:progress'` (:125): zero publishers or subscribers (`acquire:requested|acquire:settled|name:resolved` = 0 hits). `AcquireStrategyName`'s only consumer is the itself-tests-only `core/acquire/state-machine.ts`.
- `download-all/state.ts` — 4 of 5 setters and 4 of 5 mutable vars dead (`setRunning`, `setGlobalObserver`, `setGlobalInterval`, `setCancelHoldDelayMs`); only `setRefreshScheduled` is used (`refresh.ts:30,32`). `entrypoints/download_all.content.ts` keeps private duplicates (:50, :64). **Keep** the WeakMaps/constants half (genuinely shared); inline the one used setter, delete the rest.
- `core/name/sanitize.ts` re-export lines :15-17 — `stripTrailingTypeLabel` / `hasFileExtension` re-exports no production code imports (strip is used internally only; `hasFileExtension` is test-only).

### 2.5 Inline candidates (extension)

| Candidate | Call sites | Reasoning |
|---|---|---|
| `src/core/name/verify.ts` (20L) | `fileNameExtension` → 1 prod site (`entrypoints/content/file-meta.ts:55` via `sanitize.ts:16`); `hasFileExtension` → 0 prod | Fold into `core/name/sanitize.ts` — 10 lines of real regex knowledge, single consumer, no seam |
| `src/core/name/derive.ts` (23L) | 1 prod site (`file-meta.ts:47` via `sanitize.ts:17`) | Same — fold into sanitize |
| `src/engines/v3/api/index.ts` (10L) | exactly 1 (`src/v2/render/classroom-download-controller.ts:40`, imports ~8 names) | Weak delete — one consumer means the barrel saves one long import; marginal |

### 2.6 Extension drift risk (deepen, not delete)

**`src/shared/drive-endpoint.ts`** — its header claims content and background "can never drift" because they import it. Reality: `src/core/acquire/download-url.ts:26` carries a comment-enforced copy, and `src/student_work/url-classifier.ts:76-84` has its own `buildDriveDownloadUrl` emitting a **different endpoint** (`drive.google.com/uc?export=download…` vs `drive.usercontent.google.com/download?…&confirm=t`). The third copy is imported by `engines/v3/api/classroom-api-client.ts:1`; the shared one by `entrypoints/background/url-helpers.ts:6` and `entrypoints/content/url-utils.ts:7`. **Fix:** route all three through the shared module (its entire reason to exist), or delete it and accept three explicit literals.

---

## 3. Website findings (~900L)

### 3.1 Dead files

| Candidate | Lines | Evidence | Verdict |
|---|---|---|---|
| `routes/overview2/+page.svelte.disabled` + `routes/samples/+page.svelte.disabled` | 597 + 190 | `.disabled` suffix is never routed or imported; 0 references. | **DELETE** — git is the archive |
| `lib/actions/glassSheen.ts` | 40 | 0 imports anywhere. `prototype-micro-interactions.html:417` literally says "still in the codebase, currently unused"; only other mention is a comment in `lib/styles/glass.css:11`. | **DELETE** |
| `lib/index.ts` (the `$lib` root barrel) | 1 | Exports nothing; nobody imports `from '$lib'`. | **DELETE** |

### 3.2 Dead exports in live files

- `lib/config.ts` — `ORACLE_API_BASE_URL` (:64, test-only alias for `PUBLIC_API_BASE_URL`) and `ENABLE_FEEDBACK_NAV` (:72, referenced by nothing including tests). Other config exports have 12-19 consumer files each — the file itself stays.
- `lib/svgCatalog/types.ts` — the `S` export (and its re-export at `index.ts:5`): a record-builder with **0 importers**; instead `float1.ts:2` through `float4.ts:2` each define private identical copies. **Delete the export — or deepen:** make the four float files import it, collapsing 4 duplicated locals.
- `lib/uninstall/feedback.ts` — dead duplicate `detectBrowserFromUserAgent` (:9-15) diverges from `lib/browser/detect.ts`; the uninstall page imports the real one. **Delete the duplicate.**
- `routes/overview/+page.svelte:609` and `routes/overview-editor/+page.svelte:486` — private `browserDisplayName` duplicates of `lib/browser/detect.ts`. Fold into the module.

### 3.3 Inline candidates (single-caller modules)

| Candidate | Caller | Verdict |
|---|---|---|
| `lib/analytics/uninstallParams.ts` (24L, own test) | `routes/uninstall/+page.svelte:7` | **INLINE** into the page; keep the header comment documenting the cross-app `d`/`a` param contract, move the test alongside |
| `lib/analytics/uninstallViewEvent.ts` (41L, own test) | `routes/uninstall/+page.svelte:8` | **INLINE** (defensible keep if you value one-file-per-event-shape, but the deletion test says complexity reappears in exactly one place) |
| `lib/uninstall/feedback.ts` (26L, own tests) | `routes/uninstall/+page.svelte:9` | **INLINE** + delete the dead UA duplicate |

### 3.4 Deepen (website)

- `routes/landing2/+page.svelte` — 21 lines of JS-only client redirect to `/overview`; the codebase already has the deeper pattern in `routes/emails/+page.server.ts` (server `throw redirect(308, …)`, works without JS). Replace.

### 3.5 Website near-miss

`detect/structural/structural-detector.ts` (extension, 223L) is real logic but its only production consumer is the dev-only `--mode compare` path — not shallow, just dev-only.

---

## 4. Cloudflare Worker findings (~570L)

### 4.1 The extraction island that lies (highest-priority deletion in the monorepo)

| Candidate | Lines | Evidence |
|---|---|---|
| `src/downloads_do/constants.ts` | 76 | 1 importer: the dead `quota.ts`. Live `downloads_do.ts` redefines the constants inline at :461-466, :928 **with conflicting values**: `QUOTA_SOFT_LIMIT` 50_000 (dead) vs **40_000 (live)**; `QUOTA_VERY_HARD_LIMIT` 90_000 (dead) vs **70_000 (live)**. Verified. |
| `src/downloads_do/quota.ts` | 99 | `computeQuotaDescriptor` extracted from the DO, never wired: 0 importers in src or tests. Live copy is inline at `downloads_do.ts:1760` (used at :4554, :4706) — and drifted (different thresholds). |

**Verdict: DELETE both immediately.** A dead constants file that actively misstates production quota values is a trap for the next refactor.

### 4.2 Dashboard island

- `src/dashboard/index.ts` (18L) — barrel with 0 importers; TS resolves `from "./dashboard"` to the sibling `src/dashboard.ts` file, never this directory.
- `src/dashboard/utils.ts` (108L) — formatTs/formatAge/renderTableRows/etc.; only importer is the dead barrel. `dashboard/main.ts` defines private copies of all of them (:30, :44, :83, :179, :213, :244). Dead island whose knowledge was already duplicated into main.ts.
- `src/dashboard/login.ts` (46L) — a second, simpler `renderLoginPage(errorMessage?)`; only reference is `tests/dashboard.test.ts:3`. Prod login is `dashboard/main.ts:252` (takes `scriptNonce`). Orphaned divergent copy of a **security-sensitive** page. **DELETE** (plus its test block).

### 4.3 Tested library nobody uses

`src/ip_utils.ts` (224L) — IPv4/IPv6 validation/canonicalization. 0 production imports; only `tests/ip_utils.test.ts:2` and `scripts/ip_canonicalize_check.ts:9` (a check script referenced by no package.json script). `dashboard/main.ts:6583` has its own inline `isValidIpAddress`. Stale docs still praise it (`.github/agents/jules/prompts/gate.md:41,96` — which also lists a nonexistent `oracle-endpoint.ts`). **DELETE the trio** (module + test + check script), or wire it in.

### 4.4 Trim, not delete

`src/downloads_do/helpers.ts` (84L) — only `generateSecureRandomString`/`secureRandom` are used in prod (`downloads_do.ts:26`); `json` is tests-only; `todayUtcDate` is duplicated inline at `downloads_do.ts:946`; `maskIpAddress`, `getCurrentHourStart/End` have 0 callers. **Delete the 4 dead exports, keep the 2 used ones.**

---

## 5. Oracle backend findings (~250L)

### 5.1 The dashboard TypeScript island

`oracle-backend/dashboard/` (`main.ts` 14L, `state.ts` 26L, `renderers/bootstrap.ts` 10L, `renderers/website.ts` 6L, `api.ts` 54L) — a "TypeScript source-of-truth bridge" that is typechecked (`typecheck:dashboard`) but **never bundled**: `scripts/build-dashboard.mjs` concatenates `static/oracle-dashboard.legacy.js` with an inline IIFE that *duplicates* `main.ts`'s `__CQD_ORACLE_TS_BUILD__` logic. The `esbuild` devDependency is installed and never imported. Production effect: zero. **DELETE the directory** (or genuinely wire it with esbuild).

### 5.2 Duplicate health handler

`internal/handlers/health.go` — `DBHealthHandler` (file's second half): 0 production routes. `cmd/app/main.go:271` routes `/health/db` to its own `HealthDBHandler` (:657) with different behavior (`SELECT 1` + text "ok" vs `PingContext` + JSON). **DELETE the handlers-side duplicate**, pick one canonical implementation. `APIHealthHandler` in the same file stays (routed at main.go:266-267).

### 5.3 Pass-through wrappers (inline)

- `cmd/app/middleware.go:180` `decodeJSONBodyStrict` — pure 1:1 delegation: `return handlers.DecodeJSONBodyStrict(r, dst)`. 2 prod callers (`cmd/app/auth.go:240,841`) + 3 test uses. **INLINE** — callers import the handlers function directly.
- `internal/handlers/website_ops.go:488` `websiteSyncExecRunner` (+ `insertWebsiteSyncBatchWithRunner`) — single-method `ExecContext` interface, 1 prod caller, **no test fake exists**. Same for `store_batch.go:1301`'s anonymous exec interface. **INLINE** — take `*sql.DB` directly. A single-adapter seam with no second adapter and no fake is unearned indirection.

### 5.4 Deepen note

`cmd/archiver/main.go:31` carries its own duplicate `logEvent` outside the ~52-call-site logging seam in `internal/handlers/logging.go` — fold in if one logging seam is ever wanted.

---

## 6. Tools, scripts, and package.json

| Candidate | Evidence | Verdict |
|---|---|---|
| Root `package.json` scripts `phase12:verify` / `phase13:smoke` / `phase13:monitor` / `phase13:rollout` | `tools/phase13_*.sh` **do not exist** (verified: `ls` → no matches). Guaranteed-failure commands. | **DELETE the script entries** (or restore files) |
| `tools/capture-classroom-post-strings.mjs` (15.6KB) | 0 refs in package.json, workflows, docs | **DELETE** (or document as manual diagnostic) |
| `tools/probe-browser-channels.mjs` | 0 refs anywhere | **DELETE** |
| `scripts/set-amo-secrets.sh` (only file in root `scripts/`) | 0 refs | **DELETE** |
| `tools/__pycache__/` | Build junk | **DELETE** |
| `tools/commit-planner/` | Referenced only by its own README; self-contained with own tests | **KEEP** only if used manually; otherwise delete |

---

## 7. Cleared — the deletion test came back negative

Recorded so these are not re-litigated. All verified multi-caller with real added behavior:

**Extension:** `decide/thresholds.ts` (4 importers, dozens of threshold reads) · `core/detect/ceilings.ts` (6+ acceptance sites) · `student_work/constants.ts` (6 importers) · `compare/compare-mode.ts` (90% security rationale; build-time DCE guarantees no store-build path) · `shared/drive-endpoint.ts` (2 prod importers — but see §2.6) · `bus/event-bus.ts`, `queue/queue-engine.ts` (wired at `entrypoints/background/queue.ts:12-17`), `retry/backoff.ts` (`background/index.ts:312-314,628-630`), `history/history-store.ts` (`download-handler.ts:22`), `contracts/detection.ts` · `v2/orchestrator/bridge-relay.ts` (1 prod site but it IS the topic-to-bridge seam, fake-tested) · `v2/decision/download-url.ts` (2 sites, adds the one impure input over the pure core) · `roles/*` (one wiring site each at `orchestrator.ts:443-458`, but seams earned: `tests/v4-roles.test.ts` builds real fake adapters; not 1:1 delegation) · `core/i18n/resolve.ts` (3 surfaces) · `core/acquire/failure-copy.ts` (1 site, but a taxonomy table with an enforcing test is real knowledge) · `ui/settings/store.ts`, `student_work/channel.ts`, `core/detect/*`, `strategies/detect/api-detector.ts` — all multi-consumer.

**Website:** `lib/celebration/balloons/index.ts` (3 importers, real facade) · `lib/svgCatalog/index.ts` (composes categories, 2 importers) · `lib/actions/portalToBody.ts` (2 sites, documents the footer-reveal/`position:fixed` invariant) · `lib/grid/bendField.ts`, `lib/motion/magneticField.ts`, `lib/cursor/cursorStates.ts` (one consumer each but deliberate pure-math seams with dedicated tests — the test is the second adapter) · `lib/emails/sanitize.ts` (XSS-sink guard built to be unit-tested) · `lib/api/changelog.ts` (owns the changelog normalization contract) · `lib/components/animated-number/in-view.ts` (three visibility paths + stuck-at-zero guard behind a 1-function interface — actually deep) · `lib/browser/detect.ts` (5 files). Framework-mandated files (not candidates): `routes/+layout.ts`, `routes/emails/+page.server.ts`, `routes/indexnow-key.txt/+server.ts`, `hooks.server.ts`, the ~15 six-line `<SeoContentPage>` route pages (SvelteKit requires one file per URL).

**Cloudflare Worker:** `timing.ts` (6 sites, documented security primitive) · `assets.ts` (3L of pure data, 3 consumers) · `reliability.ts`, `archive-trends.ts`, `event-archive.ts`, `store-stats.ts`, `store-reviews.ts`, `release-notes.ts` — all wired with real computation.

**Oracle backend:** `cmd/app/api_error.go` (31 sites, JSON error envelope) · `internal/handlers/audit_helpers.go` (21 sites, adds nil-db guard + 500 behavior) · `internal/handlers/json_decode.go` (48 sites of `DecodeJSONBodyStrict`; hides DisallowUnknownFields + trailing-data invariants — keep the function, kill the wrapper in §5.3) · `internal/handlers/logging.go` (~52 sites).

**Website-wide negative result:** zero interface/abstract-class single-adapter seams exist in production code; where seams matter (IntersectionObserver, event submission, fetch), tests confirm real+fake adapters.

---

## 8. Suggested execution order

1. **PR 1 — `cloudflare-worker`:** §4.1 (quota constants+quota.ts), §4.2 (dashboard island + login.ts), §4.4 (helpers trim). ~350L, zero judgment calls, removes the lying-constants trap. Also fix the stale jules gate doc while there.
2. **PR 2 — extension Tier 3:** §2.3 (all dead barrels), §2.4 (dead contract surface + `download-all/state.ts` dead setters). ~200L, zero-risk.
3. **PR 3 — extension Tier 2 (the big one):** §2.1 + §2.2 clusters. ~3,000L incl. their test files. Each cluster is independently revertable; `diagnostics/build.ts` may be deferred if wiring into the popup is preferred over deletion.
4. **PR 4 — website:** §3.1, §3.2, §3.3. ~900L.
5. **PR 5 — oracle-backend:** §5.1-§5.3. ~150L.
6. **PR 6 — tooling:** §6 script entries + orphaned tools.
7. **Follow-up (deepen):** §2.6 drive-endpoint consolidation (fix the broken anti-drift invariant), §5.4 logging seam.

Every deletion here passed the same test: **complexity does not reappear at callers, because the callers already have (or never needed) the knowledge.**
