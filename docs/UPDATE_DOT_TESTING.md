# Update dot and pill — test runbook (bead 08fg.3)

The red toolbar dot and the popup version pill share one decision: `updateTarget()`
in `extension/src/update/update-state.ts`. Both react to three update signals.

| Reason | Trigger | Dot target | Cleared by |
| --- | --- | --- | --- |
| `available` | Worker `GET /changelog` knows a newer release (checked at most every 12h, on service-worker start plus an alarm) | The newer live version | Opening the changelog |
| `updated` | Browser applied an update (`chrome.runtime.onInstalled`, reason `update`) | The newly installed version | Opening the changelog |
| `scheduled` | Browser detected and scheduled an update (`chrome.runtime.onUpdateAvailable`) | The scheduled version | Opening the changelog, or the update installing |

Dismissal writes the target version into the changelog seen map
(`cqd_changelog_seen_v1`); the dot re-evaluates on every seen-map change.

## Automated coverage

- Unit/behavioral: `extension/tests/update-state.test.ts` (target precedence,
  dismissal matrix), `extension/tests/background-update-dot.test.ts` (events,
  staleness gate, failure tolerance, v1 migration),
  `extension/tests/changelog-update-pill.test.ts` (pill rule),
  `extension/tests/background-icon-manager.test.ts` (decoration layering).
- E2E: `tests/e2e/qa/qa-09-update-dot.spec.ts` — seeds real extension storage
  through the background worker and asserts the real popup pill for all three
  reasons plus dismissal. Chromium only (the seeding seam needs the
  background page target); Firefox relies on the unit coverage.

## Manual checks

Load the unpacked build from `extension/.output/chrome-mv3`, then open the
service-worker console (`chrome://extensions` → the extension →
"service worker") for the storage snippets.

1. Update available:
   ```js
   chrome.storage.local.set({ cqd_update_state_v1: { latestVersion: '99.0.0', checkedAt: Date.now(), pendingVersion: null, pendingReason: null } })
   ```
   Expect: red dot on the toolbar icon (color and gray tabs), pill pulses red.
2. Just updated — reload the unpacked extension after bumping `version` in
   `extension/package.json` (unpacked reloads fire `onInstalled` reason
   `update` with the new version). Expect: dot + pill pulse until the
   changelog is opened once; after that both stay clear.
3. Dismissal: with the dot showing, open the popup changelog once.
   Expect: dot gone on every tab, pill back to its normal state; the state
   stays dismissed across browser restarts.
4. No false positive: `chrome.storage.local.remove('cqd_update_state_v1')`.
   Expect: no dot on a fresh install and no dot when the live latest equals
   the installed version.

## Known limits

- `onUpdateAvailable` never fires for unpacked extensions, so scenario 2's
  scheduled variant is covered by unit tests only; the applied-update path
  above supersedes it in real use.
- The spinner animation hides the dot while downloads run (seconds); the dot
  returns with the base icons.
- The live check needs network. Offline starts keep the previous state and
  retry on the next service-worker wake.
