# Gamification: download levels and milestone celebrations

Status: **Current** (1.9.1). This document describes the user levels and the
milestone celebration system. The ladder lives in
`extension/src/history/download-stats.ts`; do not reorder or extend it
without an owner decision.

## What a level is

The lifetime download count drives everything. One record,
`cqd_download_stats_v1` in `chrome.storage.local`, checksummed like the
history store. Levels are derived on read — there is no level field and no
extra storage.

- A fresh install starts at **level 0** (zero downloads).
- The first download reaches **level 1**.
- Each of the 18 milestone rungs **is** a level: level N means the Nth rung
  on `MILESTONE_LADDER` is reached.
- Counts only grow, so levels never decrease.
- `levelFor(lifetimeCount)` computes the level: it counts the rungs at or
  below the count. Garbage input (negative, non-finite) sanitizes to 0.

## The levels table

| Level | Files needed (celebration rung) |
| ----- | ------------------------------- |
| 0     | — (fresh install)               |
| 1     | 1                               |
| 2     | 50                              |
| 3     | 100                             |
| 4     | 250                             |
| 5     | 500                             |
| 6     | 1,000                           |
| 7     | 2,500                           |
| 8     | 5,000                           |
| 9     | 7,500                           |
| 10    | 10,000                          |
| 11    | 25,000                          |
| 12    | 50,000                          |
| 13    | 75,000                          |
| 14    | 100,000                         |
| 15    | 250,000                         |
| 16    | 500,000                         |
| 17    | 750,000                         |
| 18    | 1,000,000                       |

Past level 18 the counter keeps counting; the level stays at 18.

## Behavior

- **One celebration per rung.** A settle crossing rungs records only the
  highest one as `milestonePending` — one confetti burst, not a barrage.
- **Two celebration surfaces: the popup AND the active Classroom tab.** The
  page side lives in `entrypoints/celebration.content.ts` (injected only on
  classroom.google.com). It watches the same stats record and plays a small
  bottom-corner banner: confetti burst, close button, Esc, 6-second
  auto-dismiss. The overlay never blocks Classroom — the positioning layer
  is `pointer-events: none`; only the banner card is interactive.
- **One celebration per milestone across surfaces.** Before playing, the
  page re-reads pending through the checksummed load path: a milestone the
  popup already cleared never plays on the page. After playing, the clear
  rides the background's `CQD_STATS_CLEAR_MILESTONE` chain message (the
  page, like the popup, never writes the stats record itself), so the
  popup never replays a milestone the page celebrated.
- **Confetti plays once.** The celebrating surface clears `milestonePending`
  after it plays. A missed celebration (no surface open during the
  download) replays as a toast-only tick on the next popup open, or as a
  banner on the next Classroom page open.
- **Reduced motion has a double gate.** Confetti fires only when both the
  OS `prefers-reduced-motion` check passes and the in-app
  `reducedMotionPreferred` setting allows it. Either gate alone reduces the
  celebration to the toast (popup) or the banner (page), and collapses the
  banner's entrance animation.
- **Toast copy names the level** ("Level 6 reached — 1,000 files!"; level 1
  reads "Level 1 reached — first file downloaded!").
- **Tracker card.** The popup card shows a level badge next to the lifetime
  count. Its empty state reads "Level 0 — download your first file".

## Where the count lives

`applyDownloadSettle` is the pure fold; `countCompletedDownload` serializes
load-fold-save behind one promise chain. The single write choke point is the
background service worker's success path in
`extension/entrypoints/background/index.ts`: each terminal 'complete' settle
increments the lifetime count at most once per download id (bounded ring of
counted ids, restart-safe).

## Dormant Cloudflare reporting

`reportDownloadCount` (extension/entrypoints/utils/analytics/count-reporter.ts)
is wired at the settle path but gated off by `REMOTE_COUNTS_ENABLED = false`
in `entrypoints/utils/analytics/constants.ts`. No fetch is built while the
gate is false. If the switch ever flips, only anonymous aggregates
(`installId` + `lifetimeCount`) leave the device. Levels and celebrations
stay local either way.

## Test surface

- `extension/tests/download-stats.test.ts` — `levelFor` boundaries: level 0,
  exact rungs, between rungs, past 1M stays 18, garbage sanitizes to 0.
- `extension/tests/popup-lifetime-tracker.test.ts` — card badge renders
  level 0, mid-ladder, and 18; empty-state copy.
- `extension/tests/popup-milestone-celebration.test.ts` — toast copy names
  the level; confetti gates; clear ack; the popup stays quiet for a
  milestone the Classroom page already celebrated and cleared.
- `extension/tests/celebration-page-overlay.test.ts` — the page overlay:
  plays on pending, clears through the background chain message, skips a
  popup-cleared pending (fresh re-check), reduced-motion banner-only,
  banner dismiss (button + Esc) and the 6-second auto-dismiss.
- `extension/tests/download-stats-clear-race.test.ts` — the serialized
  stats chain and the MV3 return-true ack contract for the clear message.
- `website/src/routes/gamification/` — public page with the same table.
