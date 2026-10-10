# CQD Simulator

A developer sub-project that shows every state the Classroom Quick Downloader
extension can present — without loading the extension. It mounts the REAL
extension surfaces. It never re-implements component markup.

## Run it

```bash
pnpm install            # once, at the repo root
pnpm -C simulator dev   # http://localhost:5173
```

Checks:

```bash
pnpm -C simulator typecheck   # strict tsc, simulator tsconfig
pnpm -C simulator build
pnpm -C simulator test        # vitest + jsdom smoke suite
```

## Routes

| Hash | Route | What it shows |
| --- | --- | --- |
| `#/` | State map | Every simulatable state, grouped, deep-linked |
| `#popup=<state-id>` | Popup | The real `extension/entrypoints/popup/App.tsx` in a phone frame, plus a control panel |
| `#page=<fixture-id>` | Classroom | A captured fixture page in an iframe with the REAL injected stylesheets and renderers |
| `#options=permissions` | Options | The real `extension/entrypoints/options/OptionsApp.tsx` (permissions rows, toggles) |

State registries live in `src/fixtures/states.ts` (popup) and
`src/fixtures/pages.ts` (classroom). The map renders from those registries, so
a new state in the registry appears on the map automatically.

## How it stays honest

- **Real code only.** The popup, options page, renderers, style injectors, the
  settings store, the checksummed stats record, and the state machines are
  imported from `../extension/...` by relative path. Nothing is rebuilt.
- **Fixture chrome.** `src/fixtures/fixture-chrome.ts` installs a
  `globalThis.chrome` adapted from `extension/tests/setup.ts` (callback +
  promise duality) and backed by a live fixture store. Production write paths
  (`saveSetting`, `saveDownloadStats`, `chrome.storage.local.set`) run against
  it, so the popup reacts exactly as it does in the extension.
- **Gestures, not fakes.** States that need a user action (API confirm card,
  privacy ledger, share panel, BMC scroll) replay the gesture on the real
  mounted markup — a click on the actual button.

## Seams (test-only overrides, kept as small as possible)

1. **Fixture `globalThis.chrome`** — the sanctioned mock pattern from the
   extension's own test setup; no extension file changes.
2. **Changelog fetch seam** — `vite.config.ts` transforms ONLY
   `extension/entrypoints/utils/changelog.ts`, wrapping the
   `fetchChangelogDetailed` export with a `globalThis.__cqdChangelogOverride`
   check. Production's module always succeeds (manual changelog), so the
   "fetch failed" and "offline fallback" surfaces have no live trigger. The
   extension's own builds never use this config.
3. **Route B style relocation** — the real injectors
   (`injectStyles`, `injectV2Styles`, `injectFlagStyles`) run on the simulator
   document; the produced `<style>` bytes are then copied verbatim into the
   iframe head. Production injects into the Classroom page itself.
4. **Route B direction mirror** — production's `applyDirection` writes
   `body[data-cqd-dir]` on the host page; the driver sets the same attribute
   on the iframe body so the badge CSS reads it.
5. **Group water fill** — forced through the real CSS contract
   (`.cqd-all-busy` + `--cqd-progress`); the group machine normally feeds it.
6. **Route B same-origin serving** — production Classroom pages come from
   google.com; the simulator serves its captured fixtures from its own
   dev-server origin (`/sim/classroom/<id>.html`) so the Annotate tool can
   read `contentDocument` and capture click targets inside the frame.

## Known-impossible in the simulator

- **Real downloads.** No `chrome.downloads` backend; buttons render and force
  states, nothing downloads.
- **Cross-context storage sync.** One context exists; the background service
  worker and its settle chain are not running.
- **The MutationObserver pipeline.** Page scanning and live re-scan do not
  run; Route B renders fixture decisions through the real renderers instead.
- **Live network.** The changelog oracle path is already disabled in the
  production module; no other network calls exist.

## User view

The simulator opens in **User view**: for popup states that means the REAL Chrome presentation — the popup document (only the extension's own stylesheets, 360x600 via App.css) inside a browser-drawn bubble (10px radius, Chrome shadow), anchored under a mock toolbar with the extension icon, over a dimmed captured Classroom page. Click the page to dismiss; click the toolbar icon to reopen — no controls, no notes, exactly what a user sees. A floating pill (bottom-right) offers **Controls** (back to the full scenario UI) and **Annotate**. The choice persists (localStorage `cqd-sim-userview`).

## Annotate mode (dev tool)

Press **Annotate** in the top bar to leave notes for a fixing agent. It never
ships in the extension; it only exists in the simulator.

Workflow:

1. Toggle **Annotate**. Clicking the rendered surface places a numbered pin
   (the click does not reach the UI underneath while the mode is on).
2. Clicking a pin opens a tiny editor: optional short label, note text,
   Save, Delete, Cancel. Pins are buttons — Tab to a pin, press Enter.
3. The side panel lists the notes for the CURRENT state; flip on
   "Show all states" to list every state's notes. Each entry jumps to its
   pin (navigating first when the note lives on another state).
4. **Copy notes as Markdown** puts the export (shape below) on the
   clipboard; **Clear notes** deletes the current state's notes after a
   confirm.

Notes persist in `localStorage` under
`cqd-sim-annotations:v1:<state-id>`, so switching states, remounts, and
reloads keep them. Classroom demo variants key separately
(`<page-id>?demo=<demo>`), so a note on the buttons demo never leaks onto
the plain page; the exported deep link reproduces the exact variant. Pin
numbers follow the per-state creation order and stay dense after
deletions.

### Click-target capture

Each note stores what makes it actionable: tag, id, significant classes
(all `cqd-*`, up to 3 others), key `data-*` attributes (`data-cqd-*`
first), 60 chars of visible text, a 4-step CSS-ish path, and percent
coordinates inside the surface. Route A (popup) and Route C (options)
capture in the simulator DOM; Route B captures inside the classroom
iframe, which is same-origin by construction: fixture pages are SERVED
by the dev/preview server at `/sim/classroom/<page-id>.html` (see
`src/fixtures/page-html.ts` + the plugin in `vite.config.ts`, which also
emits the pages into the build output), so `contentDocument` is always
readable.

### Export format

"Copy notes as Markdown" writes exactly this shape (groups sorted by
state id, note numbers per state):

```
## SIMULATOR ANNOTATIONS — <ISO date>
Total: N notes

### [<n>] <state id> — <state title>
- Route: <popup|classroom|options|map>
- Reproduce: <deep link, e.g. http://localhost:5173/#popup=first-download>
- Target: <element descriptor or "percent x,y">
- Note: <the note text>
```

A `Target` looks like
`div.luto0c > a.VkhHKd > button.cqd-download-btn "syllabus.pdf Download" @ 42.5,31`
(path, visible text, percent center) or falls back to
`percent 8.3,22.1` when no element sat under the click. Element notes add
a `Data:` line with the strongest re-location anchors, e.g.
`- Data: data-cqd-file-id="fixture-file-0" id="dl-btn"` (omitted when the
capture had no data attributes or id).

Real-browser coverage for the parts jsdom cannot see (same-origin iframe
reads, real-layout pin placement, clipboard export) lives in
`tests/e2e/simulator/annotate.spec.ts`; run it with
`pnpm test:simulator-e2e`.

## Tests

`vitest run` in this workspace covers: first-run mount, first-download
(confetti stubbed), failed history rows, the non-Classroom view, the changelog
fetch-fail and offline (cache-fallback) surfaces, the API gate, the corrupt
history record, the corrupt stats reset, the pre-schema migration, the options
page, the state map (at least 20 states), and the classroom driver running the
real renderers against the real fixture markup. The annotate suites cover the
Markdown export (golden string), click-target capture, pin placement, the
localStorage store, the same-origin fixture server, and Route B capture
inside a readable frame document.

The extension's own suite is untouched; this workspace adds no runtime
dependency beyond react tooling already in the monorepo (canvas-confetti
resolves through the extension's own dependency).
