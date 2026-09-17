# Engine V4 S11 — Cross-browser & Performance (Gate G5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** G5 met: Chrome + Edge (+ Firefox via signed xpi, owner credentials permitting) smoke green in CI; `handleMutations` p95 < 6ms measured and asserted; the i18n `_locales` migration family (#612→#611→#617) landed; selector audit (#615) baselined.

**Architecture:** Instrument the EXISTING `PerformanceMonitor` (label `handleMutations` is defined but never recorded — engine-v2.ts:247 region). Perf budget as a qa spec (qa-perf) on qa-chromium wired into the extension-e2e CI job. Edge via a third Playwright project on the msedge channel loading chrome-mv3. i18n: generate `_locales/<locale>/messages.json` from the TRANSLATIONS monolith verbatim (generator script, `default_locale: en`, CI drift check), migrate `t()` to chrome.i18n with the monolith as fallback (zero user-visible string changes).

**Tech Stack:** Playwright (qa-chromium + new qa-edge + msedge channel), Stryker NOT in this sprint (S12), chrome.i18n, web-ext (signing — owner credentials pending).

**Spec:** `docs/ENGINE_V4_MASTER_PLAN.md` §6 S11 row, §5 G5; bead `Classroom-Quick-Downloader-1yf.11`; gh #611 #612 #615 #617; S10 parked items (global-setup force-rebuild flag; scoped-sheet de-dupe; bridge duplicate-answer broadcast drop).

## Global Constraints

- Full verification per master plan §11 before close (unit/golden/accuracy/compile + qa).
- Parallel session may interleave commits — pathspec-limited commits, ≤100-char headers, Write/Edit tools, no pushes.
- Never touch website/*, cloudflare-worker/*, root package.json verify:contract.
- The Firefox signing leg is OWNER-BLOCKED (AMO API credentials): build everything up to the signed-xpi qa run behind an env-gated project; document the fallback (G5 met on Chromium+Edge, Firefox leg = unit-seam + owner-run) if credentials never arrive.
- `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`.

## Tasks

### Task 1: Perf instrumentation + budget
1. RED: unit test — driving EngineV2.handleMutations records the `handleMutations` label in PerformanceMonitor (getPercentiles('handleMutations') after N calls). GREEN: add `startTimer`/`endTimer` around the mutation pipeline in engine-v2.ts:247 region (additive; exclude self-injected-node early-returns the same way fullScan timing does).
2. RED: new tests/e2e/qa/qa-perf.spec.ts — scripted mutation burst (≥ 200 mutation batches via __cqdSimChurn or injected DOM), then read the extension's real p95 via the debug global/window bridge (expose `window.__cqdPerfSnapshot()` additive read of performanceMonitor.getPercentiles('handleMutations') — extension world via CDP like qa-08). Assert p95 < 6ms. Wire into qa suite.
3. Commit: `feat(engine): handleMutations p95 instrumented + 6ms qa budget (S11)`

### Task 2: Edge project + smoke matrix
1. playwright.config.ts: project `extension-edge` (msedge channel, --load-extension chrome-mv3, headless:false) mirroring extension-chromium; run core-flow + extension-smoke + qa-01 under it (testIgnore pattern to exclude qa/ from extension projects needs care — mirror the chromium project's filters; include the three smoke specs via testMatch override or grep param).
2. CI: ci.yml extension-e2e job — install msedge channel alongside chromium; add `pnpm run test:e2e:edge` (root package.json script) running the smoke subset on the edge project.
3. Verify locally (msedge channel must be installed — `pnpm exec playwright install msedge` if missing).
4. Commit: `test(e2e): edge browser smoke project + ci leg (S11)`

### Task 3: Firefox signing pipeline (owner-blocked, env-gated)
1. Add `scripts/sign-extension.mjs` (web-ext sign via AMO API v5, env AMO_JWT_ISSUER/AMO_JWT_SECRET, unbranded self-distribution) + package script.
2. playwright.config.ts: env-gated project qa-firefox-signed (only materializes when tests/e2e/.signed.xpi exists); harness: when signed xpi present, install it in the firefox profile (xpinstall.signatures.required true path) and run the qa subset; else existing ENVIRONMENT skip documentation remains.
3. CI: optional job step gated on secrets presence (if: secrets exist), documenting the owner action (bd 5w5-style owner note on 1yf.11).
4. Commit: `test(e2e): amo signing pipeline + env-gated firefox leg (S11)`

### Task 4: i18n _locales migration (#612→#611→#617)
1. tools/generate-locales.mjs: parse entrypoints/content/i18n.ts TRANSLATIONS (147 locales × ~21 keys) → extension/_locales/<locale>/messages.json (key names snake_cased; `default_locale: en` in wxt.config manifest — CAREFUL: wxt.config.ts is parallel-session territory ONLY for homepage_url; the manifest default_locale edit is this task's and must be coordinated: read the file fresh, change ONLY default_locale, commit pathspec-limited).
2. CI drift check: regenerate + `git diff --exit-code extension/_locales` job step.
3. Migrate t(): chrome.i18n.getMessage first, TRANSLATIONS fallback (keeps all tests green; content scripts need the `_locales` in the bundle — WXT copies _locales automatically). Popup: leave hardcoded English this sprint (documented; S12 scope).
4. Unit tests: generator round-trip; t() resolves via chrome.i18n when present; fallback path intact.
5. Commit: `feat(engine): _locales generated from translations monolith; t() via chrome.i18n (S11)`

### Task 5: Selector audit + S10 parked items
1. #615: instrument hash-id fallback rate (core detect already counts idSource? — check FileNode.idSource) → expose in the perf/debug snapshot; write docs/engine/selector-audit-2026-09.md with the corpus vs baseline numbers.
2. global-setup force-rebuild flag (env QA_FORCE_REBUILD=1) + make the qa scripts default to rebuild-on-change (hash the src tree cheaply).
3. Scoped student-work stylesheet: de-dupe the button CSS duplication (comments cross-reference; single source constant shared by both sheets — keep byte-identical output).
4. Bridge duplicate-answer: drop instead of broadcast when no requesting tab (update the pinned test — declared).
5. Commits per item.

### Task 6: Closeout
Full verification (unit/golden/accuracy/compile/qa including qa-perf + edge smokes); session log docs/session-logs/<date>-engine-v4-s11-cross-browser-perf.md; ENGINE_TASK_LIST S11 row; bd close 1yf.11 with G5 evidence (note Firefox-leg status honestly per owner-credential outcome).

## Self-Review

- G5 acceptance mapped: T2 (Chrome+Edge CI), T3 (Firefox leg honest), T1 (p95<6ms measured+asserted).
- i18n family: T4 covers #612 (generation) #611 (migration) #617 (validated when signed-Firefox leg runs — else documented).
- All S10 parked minors dispositioned in T5.
