# QA sweep matrix (bead hl4.7, sweep 1 — 2026-10-29)

The full-surface test matrix for the extension, mapped to the tool that can
actually run each cell. Execute top-to-bottom per release; sweep 1 results
are recorded below. See E2E_BROWSER_MATRIX.md for browser coverage walls and
EXTENSION_TESTING_RUNBOOK.md for the manual-check map this matrix extends.

## The matrix

| Surface | Student | Teacher | Tool |
| --- | --- | --- | --- |
| Stream: inline attachment buttons, exclusions, dedup | ✅ automated | n/a (student view) | Playwright qa-01 |
| Classwork: assignments + materials, topic pages | ✅ automated (qa-01/qa-03) | ✅ routes covered | Playwright qa-01/03/05 |
| Details deep links (`/a/<id>/details`) | ✅ automated | ✅ | Playwright (bs7c guard family) |
| Download All (grouping, placement, hold-to-cancel, error state) | ✅ automated | ✅ | Playwright qa-02 |
| Per-file downloads: filename + deterministic bytes | ✅ automated | ✅ | Playwright qa-06 |
| Drive zero-tab auth sweep | ✅ automated | ✅ | Playwright qa-06 |
| SPA navigation, delayed posts, load-more | ✅ automated | ✅ | Playwright qa-05 |
| Flags/badges: counts, tooltips, dark, RTL | ✅ automated | ✅ | Playwright qa-03 |
| Popup: seeded stats, toggles write-through, engine mode | ✅ automated | ✅ | Playwright qa-04 |
| Popup update dot + pill (all three signals + dismissal) | ✅ automated | ✅ | Playwright qa-09 (PR #835) |
| Resilience: zero dead ends, observer stress | ✅ automated | ✅ | Playwright qa-08 |
| Update-dot live signal | ✅ unit + e2e | ✅ | unit + qa-09 |
| Live real classroom.google.com (logins, real Drive) | ⬜ HITL | ⬜ HITL | live harness (hl4.1–.5) + human steps in docs/LIVE_CLASSROOM_TESTING.md |
| Branded Chrome 137+, Arc | ❌ provably non-automatable | ❌ | manual probe only |
| Teacher submissions (`/submissions`) bulk download | ⬜ HITL | ⬜ HITL | live harness hl4.4 |

⬜ = pending the only-quiet-human steps (Google blocks scripted logins);
the harness is built and validated (hl4.1–.5 all closed).

## Sweep 1 results (2026-10-29, qa-chromium, headless, 1 worker)

- **16 of 18 checks passed** (14 passed + 2 ENVIRONMENT-classified skips for
  popup window-context harness limits); **2 failed, both green on
  immediate single-file retry → classified HARNESS flake under full-suite
  load, not product regressions**:
  1. `qa-01` "manual checks 1-2" — failed with `ERR_CONNECTION_CLOSED`
     console noise from the local simulator proxy; passed in 1.7s on retry.
  2. `qa-02` "hold-to-cancel during a long run" — timed out waiting for
     `cqd-all-cancelled` while the group showed `busy → error` under load;
     passed in 2.4s on retry. Retry protocol: two-strike rule — a failing
     check re-runs once alone; only a second failure files a PRODUCT bead.
- The qa-01 journey re-verifies the bs7c regression guard (material-card
  button placement) — passed on retry; bs7c stays closed.
- **Local Firefox leg: ENVIRONMENT-blocked** — the bundled Firefox build
  fails to launch under the darwin sandbox (known wall, filed upstream as
  mozilla/web-ext#3913). CI's signed-Firefox leg covers this surface.
- **Harness finding found + fixed in this PR:** a failed browser launch
  (e.g. the darwin sandbox denying bundled Firefox) made `launchQaContext`
  throw before `closeQa` was assigned, so `afterAll` crashed with
  `TypeError: closeQa is not a function`. The harness now degrades a dead
  browser to the standard ENVIRONMENT skip path with a safe no-op close;
  re-probed: local Firefox skips cleanly, chromium smoke still green.

## Known-good walls (do not re-derive)

- Branded Chrome and Arc cannot load extensions under automation.
- Scripted Google logins are blocked; live-classroom cells stay HITL.
- The simulator MITM proxy is the only network surface in a QA run; real
  downloads flow through a real socket.
