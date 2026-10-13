# Slice 0 spike report — conductor driving the real extension

Bead: `wupn` · Branch: `feat/sim-conductor` · Worktree: `../CQD-wt-sim-conductor`
Date: 2026-10-12 · Runner: `node spike/spike.mjs` (repo root of the worktree)
Result: **7/9 checks passed; both failures fully diagnosed; verdict GO.**

## What was proven

| Check | Verdict | Evidence |
| --- | --- | --- |
| 1a. Built extension loads in persistent Playwright context, ID readable | PASS | id `eoleboicbaidbjflmnkmaiklefjlbjfc` |
| 1b. ID stable across profiles without a manifest `key` | PASS | same ID from two fresh profiles — the ID derives from the absolute extension path, which is identical across rebuilds on this machine. A `key` is only needed for cross-machine stability |
| 1c. `serviceWorker.evaluate` seeds `chrome.storage.local` | PASS | read-back verified |
| 2a. Popup opens at `chrome-extension://<id>/popup.html` and renders | PASS | 20,170 chars of body text; `state-a-fresh.png` |
| 2b. Milestone state end-to-end: seed → popup claims → confetti toast → storage cleared | PASS | toast text `✓ Level 2 reached — 50 files!`; `milestonePending` back to `null`; `state-b-milestone.png` |
| 2c. History rows render from seed | FAIL — **extension bug `cr9w`, not a conductor gap** | probe: `lastError: "The message port closed before a response was received."` |
| 4. Real content script injects download buttons into a route-fulfilled `classroom.google.com` fixture | PASS | 2 × `.cqd-download-btn`; `state-d-classroom.png` |
| 4b. Hard rule: non-fixture Google traffic aborted | PASS | `www.google.com` navigation fails as designed |
| 5. Headed `chrome.action.openPopup()` | PARTIAL | call resolves (needs `bringToFront()` first), the bubble is a native widget — no page target, not capturable by automation. A human at the machine sees it |
| 3. Network staging for changelog states | N/A | `fetchChangelogDetailed()` never fetches in 1.9.1 (`changelog.ts:171-179`, manual data only). The "fetch failed"/"offline" changelog states are unreachable in production code; network staging via `context.route`/`setOffline` stays valid for everything else |
| 6. `page.clock` need | N/A | popup `Date` usage is display-only (`App.tsx:1112,2122`); no popup state is wall-clock-dependent |

## The conductor seeding recipe (the load-bearing discovery)

`chrome.storage` reorders object keys (base::Value dict behavior). Any
integrity checksum computed over the pre-flight value will NOT match what
`loadDownloadStats`/`loadHistory` verify (they stringify the storage
read-back). The only correct seed is two-phase, inside the browser world:

1. `chrome.storage.local.set({ [key]: value })`
2. read the value BACK, `JSON.stringify` it, compute the djb2-base36 checksum
   over those exact bytes, set the integrity key.

With this recipe the extension's own verify passes and every integrity-gated
surface (stats, history) accepts the seed. Recipe proven by check 2b.

Also required for deterministic main-view states: the What's New changelog
overlay shows on every fresh profile (`cqd_changelog_seen_v1` empty). Dismiss
it once per profile, or seed the seen token.

## Bug found by the spike (filed as `cr9w`, P1)

`extension/entrypoints/background/index.ts:758-766` — `CQD_HISTORY_GET`
acks asynchronously but the single `onMessage` listener `return false`, so
MV3 closes the response channel before `sendResponse` runs. The popup's
callback gets `undefined`; `historyRows` stays `[]` forever. The popup
History panel can never display rows in 1.9.1. `CQD_HISTORY_CLEAR`
(`:768-774`) has the same shape (masked by the optimistic local clear).
The repo's own comment 20 lines below (`:780-783`) documents exactly this
contract for the milestone branch, which correctly `return true` — the
milestone claim works, history does not. Component tests mock
`sendMessage` directly, so the suites cannot catch it.

## User view decision input (check 5)

- Tab-based popup (`chrome-extension://<id>/popup.html`) is fully
  automatable and is the CI surface.
- `chrome.action.openPopup()` opens the real Chrome bubble in headed mode;
  it is a native widget: no page target, no screenshot via Playwright,
  invisible to CDP. Humans see it; automation cannot.
- Recommendation: Slice 7 uses the tab for automated parity, and a manual
  headed `openPopup` for human eyeballs. The old simulator's hand-built
  CSS bubble can be retired either way.

## Go/no-go

**GO.** All load-bearing mechanisms work: real extension, stable ID,
storage seeding (with the read-back recipe), content-script injection on
fulfilled fixtures, zero-Google-traffic guard, milestone end-to-end.
Two states are unreachable for now: history rows (blocked on `cr9w` fix —
a two-line extension change needing owner approval) and the changelog
offline/fetch-fail pair (dead code in 1.9.1).

## Decisions reserved for the owner (from the plan)

1. Popup fidelity: automated tab vs headed human-only bubble — spike
   recommends tab for CI + headed for eyeballs.
2. Approve the `cr9w` fix (two `return true` lines) so the history state
   becomes reachable; it is a user-facing bug fix regardless of the
   simulator work.
3. Accept the unreachable list: changelog fetch-fail + offline (dead code),
   history rows (until `cr9w` lands).
4. Manifest `key`: not needed for single-machine stability; only decide if
   cross-machine stable IDs matter.
5. Old-simulator deletion timing (Slice 8, after parity + `i6a1.11`).
