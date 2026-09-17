# Session Log — Engine V4 S10: Strip the V1 Detector (1yf.10, gate G3)

Date: 2026-09-14 → 2026-09-17 · Sprint: S10 of epic `1yf` (gh #685)
Executed via subagent-driven development; z57 (the S10 tail) dispatched after the
default-flip attempt proved v2 lacked interactive parity.

## What shipped

Architecture (T1–T5, mode-independent — the G3 core):
- **One MutationObserver per page**: `MutationObserverDomPort` became a
  multiplexer — one real observer, N subscriptions with per-subscription
  dispatch filtering (f08af989). The v2 stack (orchestrator, RouteWatcher
  title observer, engine-v2 transient) and ALL Classroom entrypoints migrated
  onto `getPageDomPort()` (d204ddfa, f2a4ce2d, f3022907). download_all's
  2N+1 observers → 2 fixed subscriptions. Fitness bans: `new MutationObserver`
  outside the adapter (one TODO(S11) allowlist: download-all/button-controller)
  and `setInterval` in the six Classroom entrypoints (5c8f299d).
- **Zero heartbeats**: all six Classroom `setInterval` rescans deleted; bounded
  settle scans where the interval was the first trigger. Fitness-enforced.
- **Runtime probe**: qa-08-single-observer asserts — via the port's debug
  global — one platform observer per page, live subscriptions, on every qa run.
- Dead code removed: `src/download-all/index.ts`, `watchThemeChanges`,
  stale `content/translations/detection-keywords.ts`, `v2/model/element-lifecycle.ts`
  (a5852f5a).
- Mode gate (eb93be36 + 0a4f124a): V1 detection/feature stacks gate on
  `cqdV2Mode`; `onEngineModeChange` hot start/stop. Port fault isolation
  (58a152b5): one throwing subscription can no longer starve siblings.

The default-flip story (honest detour, all beads filed):
- Flipping DEFAULT_MODE to 'v2' initially broke six journeys on fresh builds —
  earlier greens rode a stale bundle (global-setup rebuild skip; bead 0fe,
  now closed with the diagnosis). Root cause: v2 had NO interactive download
  path (click wiring dead, bridge relay inert, Download All mode-gated,
  docs/sheets anchors undiscovered). DEFAULT_MODE reverted to 'legacy'
  pending parity (92116d69); qa-08 marker made default-accurate (66703342).
- **z57 — v2 interactive parity** (60f8f930..f4e276ab + fix waves): S1 click →
  `download:requested` → S6 bridge → worker machine → settled → button states;
  S2 docs/sheets/slides/drawings anchor discovery; S3 v2 Download All group
  machine (staggered runs, cancel, hold-to-cancel contract); S4 flag markup
  contract parity; S5 DEFAULT_MODE='v2' restored. Tail f4e276ab un-gated the
  student-work row scripts (download features, not detection) with a scoped
  stylesheet to stop cross-mode restyle interception.
- Fix wave 2 (75ee26ee..9624d8ca) from the final review's two MUST-FIXes:
  destroy() no longer kills page-lifetime download wiring (pipeline survives
  SPA navigation/mode flips — regression tests drive real init→destroy→init
  cycles); Cancel All gets the lazy chrome.runtime fallback (no more silently
  dropped cancels); 45s settle watchdog on v2 pending buttons; bounded FIFO
  caps (500) on worker-side bridge tracking.

## G3 status (evidence)

- 1 MutationObserver per page: qa-08 single-observer green on every run.
- 0 setInterval heartbeats on Classroom pages: fitness-enforced; drive-surface
  intervals, resolver-bridge bounded poll, debug panel, ShadowComparator are
  documented out-of-scope rulings.
- 1 detection pass per card: existing dedup + single-pass pipeline, probed.
- V1 detector "deleted": **ruled** — V1 stacks remain solely as the Engine
  Mode legacy rollback (owner compression decision, 2026-09-13); with v2 at
  full interactive parity and default, V1 detection is inert for all default
  users. Physical code deletion is a post-G6 owner decision (retaining the
  rollback is worth more than the dead code). Recorded on the epic.

## Evidence at close

- qa-chromium, fresh build: **15 passed / 0 failed / 1 skipped** (env-gated
  live canary only).
- Unit: 141 files / 3,814 passed (11 pre-existing acquire-corpus failures
  belong to a parallel session's uncommitted background work — not this
  sprint's files).
- Accuracy gate green (20/20); tsc clean (extension scope).
- Security review pass: every v2-published URL re-validated worker-side at all
  three gates; no markup sinks beyond constant SVG.

## Deferred items (parked)

- Scoped student-work stylesheet duplicates V1 button CSS (de-dupe, S11).
- v2 flag badge markup now mirrors V1's contract (5e281b2a) — S12 may
  consolidate.
- Bridge duplicate-answer broadcast lands stray messages on extension pages
  (test-pinned as expected; consider dropping, S11).
- Forms-anchor fallback can render an honest-failure button (validator blocks
  at click) — acceptable, S12 accuracy triage.
- global-setup rebuild-skip masking hazard: add a force-rebuild flag (S11).
