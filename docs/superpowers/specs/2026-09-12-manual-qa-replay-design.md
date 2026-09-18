# Manual-QA Replay Pipeline — Design Spec

Date: 2026-09-12
Status: Approved (implementation contract: 31-section brief + architectural addendum)

## Core architectural principle

**Test against Google Classroom — don't recreate it.**

The Classroom Simulator is **a minimal Classroom-shaped test harness containing only
the DOM contracts and user journeys CQD needs to exercise.** It is not a Classroom
clone and must never become one.

```text
Real Google Classroom
        │
        │ capture / inspect / validate
        ▼
Classroom DOM primitives
        │
        ▼
Minimal deterministic simulator
        │
        ▼
Automated QA replay
```

The simulator is derived from reality; it does not define reality. When production
Classroom structure changes, the refresh order is: production CQD behavior if
necessary → captured primitives/fixtures → simulator primitives → tests. Never the
reverse, and never relaxing tests toward the simulator.

## Three-layer testing model (never merged)

| Layer | Question | Runs against | Nature |
|---|---|---|---|
| 1 — Unit / Golden | Does the CQD engine logic behave correctly? | jsdom + fixtures | existing fast deterministic tests |
| 2 — Manual-QA Replay | Does the **built** extension behave correctly in a real browser across the complete manual QA journey? | minimal simulator + real Chromium/Firefox | this work |
| 3 — Live Classroom Canary | Does the current production Google Classroom DOM still look compatible with CQD? | actual Google Classroom | read-only drift detection, gated |

### A. Deterministic automated QA (Layer 2)
Proves CQD behavior deterministically: button injection, Download All, cancellation,
filename handling, real download bytes, flag behavior, popup settings, navigation,
MutationObserver survival, dark mode, RTL, duplicate prevention.

### B. Live Classroom canary (Layer 3)
Proves CQD still recognizes and operates against Google's **current production DOM**.
It is **not** a second QA suite and does not duplicate the simulator journey.

## Goals

- Deterministic automated reproduction of the manual CQD QA runbook
  (`docs/EXTENSION_TESTING_RUNBOOK.md`) and golden behavior matrix
  (`docs/EXTENSION_GOLDEN_BEHAVIOR_MATRIX.md`).
- Chromium (MV3) + Firefox (MV2) against the built extension.
- Real browser download events — real bytes, real filenames.
- Evidence screenshots with stable names; machine-readable per-check results.
- A generated manual-style runbook report, rebuilt from artifacts alone.
- An optional read-only live-Classroom canary for production drift detection.

## Non-goals

- Google account/auth automation.
- Pixel-diff visual regression.
- CI browser matrix (documented as future work).
- Modifying live Classroom data; live-Classroom downloads.
- Replacing the existing Classroom DOM capture/refresh workflow
  (`tools/capture-classroom-snapshot.ts` → `tools/extract-fixture.ts`).
- Recreating Classroom's UI, routing, backend, auth, permissions, business logic,
  visual design, APIs, or full page inventory.

## Pipeline

```text
Typed QA Scenario
      ↓
Classroom Simulator
      ↓
Real Browser + Built Extension
      ↓
QA Journey
      ↓
Assertions + Screenshots + Console Capture + Downloads
      ↓
Machine-readable Result Artifacts
      ↓
Report Generator
      ↓
docs/runbook-style report.md
```

The report generator consumes generated artifacts only — never Playwright internals.

## Contracts

Adapted to repo conventions; small and strongly typed.

```ts
type QaStatus = "passed" | "failed" | "skipped";

type FailureClass = "PRODUCT" | "HARNESS" | "ENVIRONMENT";

interface DownloadEvidence {
  filename: string;
  expectedFilename?: string;
  size: number;
  contentValid: boolean;
}

interface AssertionResult {
  description: string;
  passed: boolean;
  details?: string;
}

interface QaCheckResult {
  checkId: string;            // e.g. "qa-01"
  runbookReference: string;   // e.g. "RUNBOOK manual check 1 / GOLDEN rule 1"
  browser: "chromium" | "firefox";
  status: QaStatus;
  failureClass?: FailureClass;
  durationMs: number;
  screenshots: string[];      // run-relative paths
  consoleErrors: string[];
  downloads: DownloadEvidence[];
  assertions: AssertionResult[];
  error?: string;
  scenario?: Record<string, unknown>;
}
```

## Failure classification

Every failed check is classified at the assertion site:

- **PRODUCT** — CQD itself behaved incorrectly (missing button, wrong filename,
  wrong badge, Download All state-machine failure, popup setting not propagating,
  engine not re-initializing on navigation).
- **HARNESS** — the simulator/test implementation is broken (simulator failed to
  serve an expected primitive, route misconfigured, extension failed to load,
  invalid scenario construction). An assertion failure is never reclassified as
  HARNESS merely because it is inconvenient to debug.
- **ENVIRONMENT** — the runtime prevented the check (browser launch failure,
  Firefox extension-loading infrastructure failure, browser-level download
  failure, missing environment).

## Simulator philosophy

The simulator provides only the smallest deterministic set of primitives CQD's
actual behavior needs:

- attachment cards; supported/unsupported links (Drive/Docs/Sheets/Forms/YouTube/external)
- stream posts; classwork pages; assignment/material details; submissions views
- comments; edited metadata; count chips; headers; the captured Classroom
  classnames/attributes CQD keys on (`n4xnA JUr7jb`, `data-stream-item-id`,
  `.luto0c`, `.KlRXdf`, `.qCWAqb .huI6Cb`, `IMvYId`, `meta-row`, comment shells)
- dynamic DOM insertion; SPA-style navigation; delayed loading; scroll/load-more;
  DOM churn; light/dark themes; LTR/RTL layouts
- Drive/Docs download endpoints; Drive virus-scan interstitial

It does **not** implement: complete UI, complete routing, backend, authentication,
permissions, real application behavior, complete visual design, business logic,
APIs, or every possible page.

## Simulator modules (`tests/simulator/`)

- `scenario.ts` — typed model + `createScenario({...})`; attachment factories
  `drive()/docs()/sheets()/forms()/youtube()/external()`; flag inputs; locale/theme/route.
- `pages/builder.ts` — emits Classroom-like DOM from scenario data using reusable
  primitives (cards, attachments, link kinds, comments, edited metadata, count
  chips, headers, submissions, assignment details).
- `app.html` + `router.ts` — SPA shell over the real URL space
  (`/u/0/c/{id}`, `/t/all`, `/a/{id}/details`, `/m/{id}/details`,
  `/a/{id}/submissions/...`); `history.pushState` + DOM swap; delayed post
  insertion; scroll load-more; DOM churn; repeated-scan dedup surface.
- `drive.ts` — deterministic endpoints: `drive.google.com/uc?export=download&id=…`
  and Docs `/export` serve tiny real-magic-byte files (`%PDF`, `PK`) with
  `Content-Disposition` names; `drive.google.com/open?id=…` serves a fake
  virus-scan interstitial; `/spreadsheets/d/{id}/edit` serves a viewer; all other
  routes 204. Zero uncontrolled external traffic.
- `server.ts` — context fixture wiring all routes under the real origins
  (extends the proven `tests/e2e/core-flow.spec.ts` route.fulfill pattern).

## Browser architecture

- Playwright projects `qa-chromium` (chrome-mv3) and `qa-firefox` (firefox-mv2 via
  Playwright Firefox persistent context). `global-setup` builds both.
- Chrome-only behavior (`chrome.downloads.onDeterminingFilename`) skips via
  `test.skip(browserName !== "chromium")`.
- Firefox infrastructure limitations are isolated behind documented fallbacks;
  shared assertions are never weakened.

## QA journeys (`tests/e2e/qa/`)

| File | Runbook mapping | Covers |
|---|---|---|
| `qa-01-buttons.spec.ts` | manual checks 1–2, golden rules 1–4 | one button per eligible attachment, `data-cqd-name`/ext/url, Forms/YouTube/external excluded, hover/cancel states, dedup, deliberate `.cqd-download-btn` rename regression |
| `qa-02-download-all.spec.ts` | Download All behavior | grouping ≥2, header placement, progress text, success auto-reset, error, hold-to-cancel, `cqd-all-*` classes, dedup |
| `qa-03-flags.spec.ts` | manual check 3–4, golden rules 5–8 | comment/edited/both badges, `+diff`, pulse, tooltips, RTL geometry, dark classes, live `cqd-flag-toggle` without reload |
| `qa-04-popup.spec.ts` | manual check 5 | real popup page, seeded analytics, toggles broadcast, open-Classroom on non-Classroom tab |
| `qa-05-navigation.spec.ts` | real Classroom verification flow | stream→classwork→details→submissions→back, engine re-init, delayed posts, load-more, churn, dedup, no full reload |
| `qa-06-downloads.spec.ts` | download flows | real download events, filename + magic bytes, Drive bypass lifecycle (gated interstitial → click-through → download → success → tab close) |
| `qa-07-live-canary.spec.ts` | production drift | read-only production compatibility observations |

## Evidence + artifacts

```text
qa-artifacts/
  <run-id>/
    run.json
    chromium/
      checks/
        qa-01/ { result.json, screenshots/01-buttons.png, ... }
        ...
      console.json
      downloads/
    firefox/
      ...
  report.md
```

- Stable screenshot names: `01-buttons.png`, `02-download-all-progress.png`, …
- `result.json` is sufficient to reconstruct the run without Playwright (check id,
  runbook ref, browser, status, failure class, duration, assertions, screenshots,
  console errors, download evidence, error, run id, scenario metadata); paths are
  run-relative.

### Console-error policy

- Severe errors originating from the extension (uncaught page errors, `console.error`
  from extension contexts) fail the check — a human tester notices these.
- Benign expected noise (network 204s, Google script absences, deprecation warnings)
  does not fail checks. The filter is: **pageerror → fail; console.error from
  extension code → fail; console.error from simulator/browser internals → record
  only; console.warn/info → record only.**

## Report generator

`pnpm test:qa:report` rebuilds `qa-artifacts/report.md` **from artifacts only**:
runbook-mapped checklist (PASS/FAIL/SKIP, browser, duration, failure class,
assertions, screenshot links, download evidence, console errors) + summary
(total/passed/failed/skipped; PRODUCT/HARNESS/ENVIRONMENT; per browser). It makes
immediately obvious which manual checks are automated and which failed.

## Live canary rules

Requires `QA_LIVE_CLASSROOM=1` **and** an explicitly supplied authenticated Playwright
storage state, in a dedicated non-primary browser profile. Without the flag: SKIP,
and Classroom is never touched.

May: navigate known Classroom pages, inspect DOM, detect real attachment cards,
detect CQD-injected buttons, detect real flag indicators, inspect metadata/layout,
inspect dark/light and RTL where available, capture screenshots and console errors,
record DOM compatibility observations.

Must never: modify Classroom data, submit assignments, create/edit/delete posts,
post comments, change settings, download Classroom files, click CQD download
controls, or perform any destructive action.

Purpose: **read-only production compatibility monitoring / DOM drift detection.**

## Scripts

Implemented in the extension workspace (`extension/package.json`), pointing at
the root `playwright.config.ts`:

- `pnpm -C extension test:qa` — qa-chromium, headed, local simulator, built extension.
- `pnpm -C extension test:qa:firefox` — qa-firefox.
- `pnpm -C extension test:qa:live` — gated live canary (inert without the flag).
- `pnpm -C extension test:qa:report` — regenerate `qa-artifacts/report.md` from artifacts.

## Regression-detection acceptance

Deliberately renaming `.cqd-download-btn` must fail `qa-01`. The test must not be
relaxed to tolerate it.

## Local-first

Headed browsers, local simulator, built extension, real interactions, local
evidence. CI/xvfb is future work.

## Status (2026-09-13)

Implemented and verified. qa-chromium: 11 passed / 3 skipped / 0 failed; the
skips are documented HARNESS limitations (qa-02 error-state retry timing, qa-04
analytics popup-window context, qa-05 fixture-derived submission rows), tracked
in a follow-up bead. **All three HARNESS skips resolved 2026-09-14 (bead 0wq):
qa-chromium 13 passed / 1 skipped / 0 failed — the only skip is the env-gated
live canary.** qa-02 uses deterministic always-403 drive ids (`forbidden`
prefix, no socket reset) so the real auth-cycling → all-failed path runs;
qa-04 anchors the popup with a synthetic active-Classroom-tab `tabs.query`
stub (fallback skip kept as a diagnostic, not a standing skip); qa-05's
simulator submission rows now satisfy the student-work container contracts.
qa-firefox: `simulator-sanity` passes; extension journeys
skip with a classified ENVIRONMENT reason — probe-verified that Playwright's
bundled Firefox deletes the unsigned sideloaded xpi at startup (signing pref
ignored), so no extension background page can exist; see the runbook's
"Firefox QA limitation". Firefox adapter logic is covered at the unit seam by
`extension/tests/background-bypass-flow.test.ts`. The report generator rebuilds
`qa-artifacts/report.md` from artifacts only; the canary remains gated and
inert without `QA_LIVE_CLASSROOM=1`.
