# Session log — End-to-end hardening

Date: 2026-08-21
Branch: `qa/e2e-hardening` (branched off `feat/detection-engine-seam`, **not pushed**)

---

## What was asked

Take ownership of testing, debugging, fixing and improving the whole system
end-to-end. Actually run it as a user would, not just read the code. Keep
looping test → find → fix → verify.

## Baseline established by running, not reading

| Component | Result |
|---|---|
| Extension | 112 files / 3,324 tests |
| Website (SvelteKit) | 29 files / 978 tests |
| Cloudflare worker | 19 files / 951 tests |
| Oracle backend (Go) | all packages ok, `go vet` clean |

All green — which is exactly why unit tests were not where the defects were.

---

## Problems found and fixed

### 1. Timed-out HTTP requests were never cancelled — `website/src/lib/api/publicSite.ts`

`withTimeout()` took an already-started promise and rejected alongside it. The
underlying `fetch` kept running: it held a connection and its response was
discarded. Zero `AbortController` usage anywhere, across four call sites.

Worst on the three POST endpoints (uninstall feedback, website events,
newsletter): a timed-out request that actually *succeeded* server-side is
invisible to the caller, so a retry double-submits.

**Fix:** `withTimeout` now takes a factory `(signal) => Promise<T>`, owns an
`AbortController`, and aborts for real on deadline. All four call sites pass the
signal through.

**Verified:** two new tests — one proves the signal is aborted on timeout, one
proves it is *not* aborted on success. Both failed before the fix (`seenSignals`
was empty, proving no signal existed at all).

### 2. Uninstall reason pills had no accessible selected state — `website/src/routes/uninstall/+page.svelte`

Selection was conveyed *only* by a CSS class and a decorative checkmark SVG. No
`aria-pressed`, no role. A screen-reader user could not tell which reason was
selected.

**Fix:** `aria-pressed` bound to selection; decorative icon and checkmark marked
`aria-hidden`/`focusable="false"`.

**Verified:** in a real browser — 7/7 pills carry `aria-pressed`, exactly one is
`true` and it tracks the visual `active` class. Regression test added.

### 3. Form submission results were never announced — same file

The result toast rendered in a bare `<span>`. The only `aria-live` region on the
page was SvelteKit's own, and it was empty. Both success and failure were
silent to assistive tech.

**Fix:** the live region is now rendered **unconditionally** with
`aria-live="assertive" aria-atomic="true"`, with the visual toast conditional
*inside* it. A region that first appears at the same moment its content does is
not reliably announced — the assistive tech has to be observing the node before
it gains content.

**Verified:** in a real browser, region present-and-empty before submit, then
carrying the error text after a simulated 500.

### 4. Playwright had been removed, making the entire e2e suite unrunnable

`package.json` recorded: *"@playwright/test ^1.59.1 and playwright ^1.59.1 were
unused (2026-02-28)"*. They were not unused — `playwright.config.ts` and four
specs in `tests/e2e/` depend on them. The project's **only** real-browser
coverage had been dead for ~6 months, and nothing in CI noticed.

**Fix:** restored `@playwright/test`, corrected the false note, added
`test:e2e` / `test:e2e:headed` scripts, and added an `extension-e2e` CI job
(xvfb, since extension APIs need headed Chrome) wired into the `ci-passed` gate
so it cannot rot again.

**Verified:** 14/14 pre-existing e2e tests pass in real Chromium — content
script injection, Download All, authuser-prefixed routes, iframe bridge
resolution. None had ever run in CI.

### 5. Stale download entries leaked two maps — `extension/entrypoints/background/cleanup.ts`

`cleanupOrphanedPendingDownloads()` calls `cleanup(pending)` with no
`downloadId`, but `cleanup()` only cleared `pendingByDownloadId` and
`cancelledByUs` when given one explicitly. A download that had already been
assigned a browser download id and then went stale left both entries behind
permanently.

**Fix:** `cleanup()` falls back to `pending.currentDownloadId`, so every caller
benefits rather than just the sweep.

**Verified:** test reproduces the leak (failed before, passes after), plus two
guards for the explicit-id and no-id paths. Extension coverage gates (100% on
critical/runtime profiles) still pass.

---

## Improvements beyond the bugs

- **New real-browser core-flow suite** (`tests/e2e/core-flow.spec.ts`, 6 specs).
  The existing e2e covered Student Work only; the journey almost every user
  takes had none. Serves the committed golden fixtures under the real
  `classroom.google.com` origin via request interception, so no Google account
  is needed. Covers: per-attachment button injection, Forms links correctly
  rejected, **RTL layout containment** (asserts the button does not escape its
  card — jsdom has no layout so it cannot see this), **no duplicate injection
  under DOM churn** (the classic MutationObserver failure), and no uncaught
  errors on post-less pages.
- **CI gate** for the e2e suite so real-browser coverage is now enforced.

---

## Things checked and found correct (not "fixed")

Verified rather than assumed, and deliberately left alone:

- `/indexnow-key.txt` returning 404 locally is the endpoint's designed
  behaviour when `INDEXNOW_KEY` is unset — an env var, production-only.
- `/emails` → `/emails2` 308 is an intentional redirect.
- `SeoMeta` hydration warnings are the canonical URL differing between the
  configured production origin and localhost — intentional canonicalisation
  from the `pages.dev` mirror, dev-only noise.
- `stream-flagged-post-en.html` getting no download button is **correct** — the
  fixture has zero Drive links. My first test asserted otherwise; the test was
  wrong, not the extension.
- `/api/site/v1/snapshot` 404ing against Oracle was my own misconfiguration —
  those routes belong to the Cloudflare worker. The site degraded gracefully
  through it, which is itself a useful result.
- Oracle's `storage_emergency_backpressure` on a fresh empty DB is **correct**:
  it measures host filesystem usage, and this machine's disk is 94% full.
- The `pendingByUrl` race the sprint plan still lists as unscoped has already
  been fixed — `Set` buckets plus `pendingByUrlGet` preferring unassigned
  entries handle concurrent same-URL downloads.
- Oracle security posture is strong: CSP with nonces, `frame-ancestors 'none'`,
  HSTS, `nosniff`, `X-Frame-Options: DENY`, Permissions-Policy, method
  enforcement, fail-closed startup on missing secrets.
- Extension manifests correct across chrome-mv3 / firefox-mv2 / edge-mv3 —
  minimal permissions, proper CSP, version 1.5.5 consistent.

---

## Final verification

Full sweep, all green:

| Gate | Result |
|---|---|
| Extension tests | 112 files / **3,394** tests |
| Extension golden | 8 suites |
| Extension coverage (100% critical + runtime) | both pass |
| Extension `tsc --noEmit` | clean |
| Website tests | 29 files / **980** tests |
| Website `svelte-check` | 1019 files, **0 errors, 0 warnings** |
| Worker tests | 19 files / 951 tests |
| Oracle `go test ./...` | all packages ok |
| Oracle `go vet` | clean |
| **Real-browser e2e** | **20/20** |
| Version sync | in sync |

Clean new-user walkthrough: 10 routes served 200, no error markers in HTML,
**zero** JS errors or unhandled rejections captured, both a11y fixes confirmed
live in a fresh session.

---

## Not tested, and why

- **Real Google Classroom.** No credentials or authenticated session were
  available in this environment. Everything Classroom-facing was exercised
  against the committed golden fixtures served under the real origin via
  request interception, which satisfies the content scripts' hostname gate but
  is not live Classroom DOM.
- **Real downloads to disk.** The e2e specs stub the download path; no file was
  actually written by the browser.
- **Production deploys** (Cloudflare Pages / Workers, Oracle host). Not
  exercised — that needs credentials and would be an outward-facing action.
- **Live POST traffic.** Deliberately avoided: dev config falls back to
  *production* API URLs, so submitting for real would have pushed test data
  into live analytics. Failure paths were exercised with a stubbed `fetch`
  instead.
- **Firefox / Edge at runtime.** Both build cleanly and their manifests were
  audited, but the e2e harness is Chromium-only (Playwright cannot load
  extensions into Firefox the same way).

## Open items

- Oracle #415 (in-memory sessions) reproduced live — the backend warns at
  startup that sessions will not survive a restart. Still the last open
  Sprint 1 item, still gates #418.
- The two dead-code items from the seam work remain flagged, not deleted:
  `src/detection/index.ts` (zero importers) and the unused `isInExcludedArea`
  import.
- Host disk is at 94%, which is what trips Oracle's storage backpressure
  locally.
