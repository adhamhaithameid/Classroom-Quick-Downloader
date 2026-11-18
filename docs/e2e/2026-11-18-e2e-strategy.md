# Browser E2E strategy — 2026-11-18

Scope: the four test layers of this monorepo, what each layer owns, how to
run it, what it costs, and where the gaps were on 2026-11-18. Written by the
e2e session; the specs it added are listed under "Added this session".

## The pyramid

```
        /  live  \        real classroom.google.com, real accounts, HITL gate
       /----------\       qa/ journeys (8 spec files) on the qa-* projects
      / browser E2E \     tests/e2e/*.spec.ts + headed/ on extension-chromium
     /---------------\    extension vitest suite (4,400+ tests) + website tests
    /  unit + integration\ worker tests, golden/fuzz/stress/visual sub-suites
```

Rule of the pyramid: push a check down a layer only when the lower layer
cannot see the failure. The unit suite already proves detection logic against
fixtures. Browser E2E exists to catch what jsdom cannot: a live layout
engine, a real MutationObserver, extension loading, service-worker messaging,
and cross-page wiring (options -> storage -> content scripts).

## What exists

| Layer | Where | Runner |
|---|---|---|
| Unit / integration | `extension/tests/`, `website/src/**`, `tools/*.test.mjs`, `cloudflare-worker` | `pnpm -C <workspace> test` (vitest / node --test) |
| Golden | `extension/tests/` regression+fuzz+stress+visual sub-suites | `scripts/mega-e2e` stage `golden` |
| Browser E2E (extension) | `tests/e2e/*.spec.ts` (root config) | `pnpm test:e2e` = `playwright test --project=extension-chromium` |
| Browser E2E (qa journeys) | `tests/e2e/qa/qa-0*.spec.ts` | qa-chromium / qa-edge / qa-firefox projects via harness |
| Browser E2E (headed security) | `tests/e2e/headed/` | `pnpm test:e2e:headed-security` (E2E_HEADED=1; CI runs under xvfb) |
| Simulator | `tests/e2e/simulator/` | `pnpm test:simulator-e2e` (own Vite server, no extension) |
| Live Classroom | `tests/e2e/live/` | `pnpm test:qa:live`, needs `LIVE_CLASSROOM=1` + `.live-profile` |
| Production smoke (fetch) | `tools/verify-production.mjs` | `node tools/verify-production.mjs` against the live site |
| Website smoke (browser) | `tools/website-smoke-crawl.mjs` (added today) | see "Added this session" |

Key harness facts:

- `playwright.config.ts` sits at the repo root; `testDir` is `tests/e2e`.
  The lane name `extension/tests/e2e` in AGENTS.md is stale — that directory
  does not exist; specs live at the root.
- `channel: 'chromium'` (new headless) is the only headless build that loads
  extensions. Branded Chrome 137+ ignores `--load-extension`, so there is no
  `extension-chrome` project by design.
- `global-setup.ts` builds `extension/.output/chrome-mv3` before any run and
  reuses it only when the source fingerprint matches `tests/e2e/.build-stamp`.
- The full pre-deploy matrix is `scripts/mega-e2e` (build, unit, golden,
  e2e-chromium, e2e-edge, e2e-firefox, popup-qa, live, drift). It writes
  `qa-artifacts/mega-e2e/report.md`.

## How to run each layer

```bash
pnpm -C extension test                 # unit (fast, every commit)
pnpm test:e2e                          # browser E2E, chromium only (~min)
pnpm test:e2e tests/e2e/options-page.spec.ts   # one spec
pnpm test:e2e:headed-security          # headed security journeys (local only)
pnpm test:simulator-e2e                # simulator dev tool
node tools/website-smoke-crawl.mjs     # website route crawl (local preview)
BASE_URL=https://… node tools/website-smoke-crawl.mjs  # against a deploy
scripts/mega-e2e --quick               # build+unit+golden+chromium
scripts/mega-e2e                       # full pre-deploy matrix (store gate)
```

## Added this session (2026-11-18)

1. `tests/e2e/options-page.spec.ts` — options page loads in a real browser,
   all six setting switches render with `aria-checked`, a toggle persists
   across reload, the permissions accordion expands, the diagnostics link
   exists. Closes the options-page gap.
2. `tests/e2e/diagnostics-page.spec.ts` — diagnostics page loads, the report
   pre becomes parseable JSON with schema `cqd-diagnostics/1`, the report
   stays PII-free (no email-shaped strings), and all three action buttons
   enable. Closes the diagnostics-page gap.
3. `tests/e2e/flag-badges.spec.ts` — comment_frame + edited_frame in a real
   browser: combined badge (count + Edited) on the stream fixture, comment
   badge on a comment-only post, edited badge on an edited-only post. Found
   a live contract the unit layer does not pin: the default engine renders
   ONE combined V2 badge for both markers (data-cqd-flag-kind="both").
4. `tools/website-smoke-crawl.mjs` — browser crawl of every sitemap route:
   HTTP 200, zero console/page errors, non-blank rendered text, and every
   same-origin link resolves. Closes the "website has no browser E2E" gap.
   Findings recorded in the session log: the Cloudflare Insights beacon is
   blocked by the site CSP on every production route; current main renders
   an uninterpolated `images/{b}.svg` src (404) in footer/overview; `/watch`
   posters resolve to `//images/…` (ERR_NAME_NOT_RESOLVED); `/emails` does
   NOT reproduce the reported blank render (308 to `/emails2`, full text).

Still open (no browser E2E): `celebration` (needs a real download-completion
flow) and `v2_bootstrap` (indirectly exercised by flag-badges through the V2
renderer, but not asserted directly). A drift-probe style spec is the right
next step for celebration once a download journey fixture exists.

## Flake risks

- Headless timing: the content-script scanner runs on debounced observers.
  Specs wait on selectors with explicit timeouts; avoid bare `waitForTimeout`
  assertions on injection state except for negative (nothing-injects) cases.
- Service-worker startup races: MV3 workers sleep. Every spec must derive the
  extension id from `context.serviceWorkers()` with a `waitForEvent` fallback
  (see `download-start-timeout.spec.ts`).
- Clipboard: `navigator.clipboard` needs focus permissions in headless;
  assert on button state, not clipboard contents, unless the context grants
  `clipboard-read`.
- Edge project: `extension-edge` runs the same specs on channel `msedge`.
  Edge is not installed on this machine (known limit, bead juoc); CI covers
  it. Never run the default `playwright test` without `--project` locally.
- Live Classroom and signed-Firefox legs are environment-gated; mega-e2e
  reports every skip with its unlock command instead of failing silently.

## CI cost

- Every push: unit + integration per affected workspace (scoped pre-push
  gate locally; CI mirrors it). Minutes, not seconds.
- `ci.yml` runs the chromium browser E2E leg; the Edge leg runs in CI where
  Edge exists. Signed-Firefox and live legs never run on PRs.
- `extension-stores.yml` runs the mega-e2e gate before any store publish;
  the live leg becomes required with `--require-live`.
- Rough per-run browser cost: chromium E2E is the cheap real-browser layer
  (single worker, one build); the full mega-e2e matrix is the expensive one
  and is reserved for pre-deploy.
