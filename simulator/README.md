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
   "fetch failed" surface has no live trigger. The extension's own builds
   never use this config.
3. **Route B style relocation** — the real injectors
   (`injectStyles`, `injectV2Styles`, `injectFlagStyles`) run on the simulator
   document; the produced `<style>` bytes are then copied verbatim into the
   iframe head. Production injects into the Classroom page itself.
4. **Route B direction mirror** — production's `applyDirection` writes
   `body[data-cqd-dir]` on the host page; the driver sets the same attribute
   on the iframe body so the badge CSS reads it.
5. **Group water fill** — forced through the real CSS contract
   (`.cqd-all-busy` + `--cqd-progress`); the group machine normally feeds it.

## Known-impossible in the simulator

- **Real downloads.** No `chrome.downloads` backend; buttons render and force
  states, nothing downloads.
- **Cross-context storage sync.** One context exists; the background service
  worker and its settle chain are not running.
- **The MutationObserver pipeline.** Page scanning and live re-scan do not
  run; Route B renders fixture decisions through the real renderers instead.
- **Live network.** The changelog oracle path is already disabled in the
  production module; no other network calls exist.

## Tests

`vitest run` in this workspace covers: first-run mount, first-download
(confetti stubbed), failed history rows, the non-Classroom view, the changelog
fetch-fail surface, the API gate, the corrupt history record, the options
page, the state map (at least 20 states), and the classroom driver running the
real renderers against the real fixture markup.

The extension's own suite is untouched; this workspace adds no runtime
dependency beyond react tooling already in the monorepo (canvas-confetti
resolves through the extension's own dependency).
