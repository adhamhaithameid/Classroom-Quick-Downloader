# Briefing: Replace the simulated harness with the literal live extension

Date: 2026-10-12
Audience: a planning LLM. The owner will feed your plan back to the build agent.
Repo: `adhamhaithameid/Classroom-Quick-Downloader` (monorepo, pnpm workspaces).

## 1. The requirement (owner's words)

> "I need the extension's simulator to be the same as the live one by literally
> opening the extension, not to make a simulated one."

Goal: the developer simulator experience must run the actual built extension in
a real browser. No simulated popup document, no fixture `chrome` shim, no
stand-in environment. The state matrix, the user view, and the annotation
workflow are valued features; the question is how to keep their value while the
rendered thing is the real extension.

## 2. What the simulator is today

Workspace: `simulator/` (Vite + React app, own vitest + tsconfig). Run with
`pnpm -C simulator dev` (http://localhost:5173). Full doc: `simulator/README.md`.

Routes:

| Hash | Route | Content |
| --- | --- | --- |
| `#/` | State map | Registry-driven list of every simulatable state |
| `#popup=<state-id>` | Popup | Real `extension/entrypoints/popup/App.tsx` in a phone frame, with a control panel; "user view" mode renders it inside a browser-drawn Chrome bubble over a dimmed captured Classroom screenshot |
| `#page=<fixture-id>` | Classroom | A captured fixture page in a same-origin iframe with the real injected stylesheets and renderers |
| `#options=permissions` | Options | Real `extension/entrypoints/options/OptionsApp.tsx` |

Registries: `simulator/src/fixtures/states.ts` (39 popup states),
`simulator/src/fixtures/pages.ts` (classroom pages).

Real code only: popup, options, renderers, style injectors, settings store,
stats record, and state machines import from `../extension/...` by relative
path. Nothing is rebuilt. Gestures replay real clicks on real markup.

## 3. What is real vs simulated today

Real: the extension UI code, styles, state machines, settings store logic,
renderers, style injectors.

Simulated (the seams — all listed in `simulator/README.md`):

1. `globalThis.chrome` fixture shim (adapted from `extension/tests/setup.ts`),
   backed by an in-page fixture store — no real `chrome.storage`,
   no service worker.
2. Changelog fetch seam (vite transform wrapping one module) to reach
   "fetch failed" / "offline" states that production cannot trigger on demand.
3. Route B style relocation: real injectors run on the simulator document; the
   produced `<style>` bytes are copied into the iframe head (production
   injects into the Classroom page itself).
4. Route B direction mirror: `body[data-cqd-dir]` set on the iframe body.
5. Group water fill forced through the real CSS contract.
6. Fixture pages served same-origin (`/sim/classroom/<id>.html`) so Annotate
   can read `contentDocument` — real Classroom pages are cross-origin
   google.com.

Known-impossible in the simulator today (README's own list): real downloads
(no `chrome.downloads` backend), cross-context storage sync (no service worker
settle chain), the MutationObserver scanning pipeline, live network.

Extra dev features built on top: user view (Chrome-identical popup bubble,
persisted via `localStorage cqd-sim-userview`), annotate mode (numbered pins,
per-state notes in `localStorage cqd-sim-annotations:v1:<state-id>`, markdown
export with click-target capture: tag, id, classes, `data-cqd-*`, text, path,
percent coordinates). Real-browser coverage for annotate lives in
`tests/e2e/simulator/annotate.spec.ts` (`pnpm test:simulator-e2e`).

Recent commit line (for archaeology): `feat(simulator)` series ending at merge
`9bdb7f12` — chrome bubble presentation, annotate on the bubble, popup-fidelity
spec, route-A specs pinned to controls mode.

## 4. Why it was built simulated (the defense the plan must beat)

- 39 popup states on demand, deterministically, offline, no Google login.
  Many states (corrupt stats record, pre-schema migration, changelog offline,
  API gate, failure copy per classified failure) cannot be commanded on a real
  Classroom page without heavy seeding.
- Fast review loop for design and QA (state map + annotations + markdown
  export for fixing agents).
- CI-safe: jsdom suite plus a small Playwright spec; no store policy or
  Classroom ToS surface.

## 5. Existing infrastructure that already drives the REAL extension

- `tests/e2e/` — Playwright suites that load the built extension:
  `core-flow.spec.ts`, `extension-smoke.spec.ts`, `download-start-timeout.spec.ts`,
  `student-work*.spec.ts`, `console-hygiene.spec.ts`, `qa/` (channel
  `chromium` new headless runs MV3 extensions), `headed/`, `zen/`.
- `tests/e2e/live/` — live real-classroom harness on classroom.google.com:
  login-once browser profile, student+teacher suites (bead `hl4`; blocked on
  owner login/seed; known bug bead `sqa9.2`: canary passes storageState to
  launchPersistentContext which drops it).
- Signed-Firefox E2E leg exists (companion GUID; CI currently wedged, bead
  `0h4d.12.9`).
- `docs/E2E_BROWSER_MATRIX.md` — the automation facts: branded Chrome 137+ and
  Arc are provably non-automatable; headless chromium is the automation
  surface; there is a Playwright/MV3 runbook section in the docs.
- The extension builds via WXT: no `manifest.json` in repo (generated from
  `extension/wxt.config.ts`); `pnpm -C extension build` produces loadable
  unpacked builds (the 1.8.7 zips in `~/Desktop/code/CQD-store-upload/` were
  built this way).

## 6. The hard problems the plan must answer

1. **State forcing in the real extension.** On-demand states need real
   `chrome.storage.local` / `chrome.storage.sync` seeding (or a dev-only
   seeding hook). Which states become reachable this way? Which stay
   unreachable without a live Classroom (and what replaces them)?
2. **Real Classroom DOM.** The content-script surface needs a real
   classroom.google.com page (HITL login, ToS risk, non-determinism) — or a
   locally served stand-in page on a fake origin, which reintroduces a
   "simulated" host. Cross-origin frames block `contentDocument` reads, which
   the Annotate tool relies on.
3. **Annotations on the real thing.** Pins and click-target capture must work
   on extension pages (popup/options) and on the Classroom tab (content-script
   world). Today everything is same-origin by construction.
4. **The chrome bubble user view.** The "identical to Chrome" popup
   presentation was hand-built (10px radius, Chrome shadow, mock toolbar).
   A real browser gives the real popup for free — but only on a real Chrome
   automation surface, which branded Chrome forbids (headless chromium renders
   its own popup chrome; that may be fidelity enough or a regression).
5. **Downloads and the service worker settle chain.** Real `chrome.downloads`
   in automation works (E2E proves it); real Classroom file URLs do not exist
   without login. Decide the floor: seeded URLs? Local test server files?
6. **Loop speed.** Vite HMR vs launch-browser-per-state. The plan should state
   the target feedback loop.
7. **CI.** What runs headless in CI vs stays local-only (login-gated)?

## 7. Constraints

- MV3 service worker; WXT build; TypeScript strict; pnpm workspaces.
- Extension test suite is green and large (~4.5k tests); the coverage gate is
  `pnpm -C extension test:coverage:all`. Do not regress it.
- Owner gates: HITL login for real Classroom; no store-policy-risky automation
  against Google properties without sign-off.
- Bead `i6a1` epic owns the simulator line; simulator sign-off is an owner
  ticket (`i6a1.11` in the map).
- Parallel sessions share the checkout; significant work happens in a dedicated
  git worktree (announce before/after creating one — repo rule).

## 8. What the plan should deliver

- A target architecture: how a "state" becomes "the real extension opened in a
  real browser showing that state" — including the seeding mechanism.
- A migration stance for the three routes (popup, classroom page, options) and
  the two dev features (user view, annotate): keep, port, or drop, with
  reasoning.
- What remains simulated (be honest: fixtures, seeds, fake origins) and why
  that residual is acceptable under the owner's requirement.
- A build order in verifiable slices, each testable against the existing E2E
  infrastructure.
- Open decisions for the owner, separated from decisions the plan can make.
