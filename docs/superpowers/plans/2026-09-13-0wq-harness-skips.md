# 0wq — Resolve the Three HARNESS QA Skips — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the three documented HARNESS skips to full checks: qa-02 error state (deterministic 403 injection), qa-04 analytics card (popup-tab context stub), qa-05 student-work rows (fixture-derived container contracts). No product (extension/src, entrypoints) changes — this is a simulator + QA-spec sprint.

**Architecture:** The Manual-QA Replay pipeline drives the built extension against the local MITM simulator (`tests/simulator/`). Each skip exists because the harness cannot make the product observe a condition; each fix supplies that condition deterministically.

**Tech Stack:** Playwright (qa-chromium), TypeScript simulator, vitest (simulator unit tests where cheap).

**Spec:** bead `Classroom-Quick-Downloader-0wq`; `docs/superpowers/specs/2026-09-12-manual-qa-replay-design.md` (skip documentation §284-287); runbook table `docs/EXTENSION_TESTING_RUNBOOK.md`.

## Global Constraints

- Classification contract: never fake a pass; a check either runs for real or skips with evidence.
- The parallel session owns S6 right now — never touch: extension/src/**, extension/entrypoints/**, extension/wxt.config.ts, popup App.tsx, background files, or its S6 files. This sprint touches ONLY: tests/simulator/**, tests/e2e/qa/**, docs (runbook/design-spec tables), package scripts if unavoidable.
- `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`; qa run: `pnpm -C extension test:qa` (needs repo-root playwright.config.ts projects qa-chromium).
- Mimosa hook: Write/Edit tools for file changes.
- Pathspec-limited commits, ≤100-char headers, no pushes.

## File Structure

- Modify: `tests/simulator/origins.ts` (Task 1: `forbidden-` prefix)
- Modify: `tests/e2e/qa/qa-02-download-all.spec.ts` (Task 1: use forbidden ids, drop skip)
- Modify: `tests/e2e/qa/qa-04-popup.spec.ts` (Task 2: addInitScript tabs.query stub, drop skip)
- Modify: `tests/simulator/pages/builder.ts` (Task 3: row DOM alignment as derived)
- Modify: `tests/e2e/qa/qa-05-navigation.spec.ts` (Task 3: drop skip)
- Modify: `docs/EXTENSION_TESTING_RUNBOOK.md` + design-spec skip table (closeout)

---

### Task 1: qa-02 error state — deterministic 403, no socket reset

**Files:** Modify `tests/simulator/origins.ts`, `tests/e2e/qa/qa-02-download-all.spec.ts`

**Interfaces:** Produces: drive ids prefixed `forbidden` on `drive.usercontent.google.com/download` (and `drive.google.com/uc?export=download` for parity) return `status: 403` HTML body WITHOUT `resetSocket` — the deterministic sibling of the parallel session's `authlocked` modeling (origins.ts:176-186, which 403s unless authuser=1).

- [ ] **Step 1 (RED):** Change qa-02's broken post to use `drive("forbidden-da-1")`/`drive("forbidden-da-2")`; keep the MutationObserver class recorder and the 60s bounded window; the `test.skip(...)` call at :248 STAYS initially — run the spec: `pnpm -C extension test:qa -- -g "error state"` → expected outcome per current code: skip fires again (observed classes never include `cqd-all-error`) — that IS the red evidence (skip reason string recorded in the report). Confirm the 403 arrives by asserting in the test's diagnostics that the buttons cycled (if the skip still fires, capture `seenBroken` into the skip reason as today).
- [ ] **Step 2:** Add the `forbidden` prefix branch in origins.ts next to `authlocked` (verbatim 403 shape from the authlocked branch, no resetSocket).
- [ ] **Step 3 (GREEN):** Re-run the spec → the group's buttons go through auth-cycling → all accounts denied → `AUTH_ALL_FAILED` → group class `cqd-all-error` observed → assertions pass → DELETE the `test.skip(...)` call. If the skip still fires, iterate on the DIAGNOSTIC data (which classes were seen) — never widen the timeout beyond 60s without recording why.
- [ ] **Step 4:** Full qa-chromium run: `pnpm -C extension test:qa` → all checks green (including the previously-skipped one).
- [ ] **Step 5: Commit** both files: `test(qa): deterministic 403 injection unskips qa-02 error state (0wq)`

### Task 2: qa-04 analytics card — popup tab context

**Files:** Modify `tests/e2e/qa/qa-04-popup.spec.ts`

**Interfaces:** The popup page's `isClassroomTab` (App.tsx:394-420) resolves from `chrome.tabs.query({active:true,currentWindow:true})`; opened-as-a-tab it returns the popup tab itself. The test stubs it BEFORE the popup app loads.

- [ ] **Step 1 (RED):** In the analytics test, BEFORE `page.goto(popup.html)`: `await page.addInitScript(() => { const orig = chrome.tabs.query.bind(chrome.tabs); chrome.tabs.query = (q, cb) => { const res = [{ id: 99, url: 'https://classroom.google.com/u/0/c/classroom-test', active: true, currentWindow: true }]; if (typeof cb === 'function') { cb(res); return; } return Promise.resolve(res); }; });` Keep the existing skip; run → skip still fires (proves the stub is required and the rest of the test was already sound).
- [ ] **Step 2 (GREEN):** Re-run → the "Download Activity" card renders (totals 7, pdf 4, zip 3 from the seeded local_stats) → assertions pass → DELETE the skip call. If the popup uses a different tabs API shape (check App.tsx:394-420 first), adjust the stub to the real call shape — never the product.
- [ ] **Step 3:** Full qa run green. **Step 4: Commit:** `test(qa): stub popup tab context, unskip analytics card check (0wq)`

### Task 3: qa-05 student-work rows — fixture-derived contracts

**Files:** Modify `tests/simulator/pages/builder.ts` (+ possibly `tests/simulator/scenario.ts`), `tests/e2e/qa/qa-05-navigation.spec.ts`

**Interfaces:** The student-work content scripts inject `button.cqd-download-btn` only into containers satisfying their real contracts (the ones the unit fixtures in `extension/tests/student-work-*.test.ts` encode). Derive the contract from those fixtures; align the simulator's `SubmissionsRow` DOM to it.

- [ ] **Step 1 (research, recorded in the report):** Read the scan predicates in `extension/entrypoints/student_work_by_status.content.ts` + `student_work_sidecar.content.ts` (what selector/attribute gates a row: expected container classes, attachment-card attributes, href shapes) and cross-check one unit fixture (e.g. tests covering submissions rows). Write the derived contract list into the report.
- [ ] **Step 2 (RED):** Align `builder.ts` submissions-row DOM to the derived contract (change ONLY the simulator's synthetic DOM). Run qa-05's row test with the skip still in place → capture rowDiag; if buttons still absent, the derived contract is wrong — iterate against the diagnostics.
- [ ] **Step 3 (GREEN):** Buttons observed on `nav-row-1` → assertions pass → DELETE the skip call.
- [ ] **Step 4:** Full qa run green. **Step 5: Commit:** `test(qa): simulator rows satisfy student-work contracts, unskip qa-05 (0wq)`

### Task 4: Closeout — docs + bead

- [ ] Update `docs/EXTENSION_TESTING_RUNBOOK.md` coverage table rows (qa-02-error/qa-04/qa-05 → Full) and the design-spec skip list; note the three flips with evidence.
- [ ] Full verification: `pnpm -C extension test:qa` green with ZERO skipped checks (simulator-sanity may still skip on Firefox — that is a documented ENVIRONMENT, not HARNESS).
- [ ] `bd close 0wq` with evidence comment; update the runbook + session note.

## Self-Review

- Spec coverage: all three skips from the bead get a dedicated task + closeout. No product changes anywhere.
- No placeholders: every step names the exact mechanism.
- Type consistency: `forbidden` prefix naming consistent across origins.ts + spec; stub shape matched to real App.tsx call.
