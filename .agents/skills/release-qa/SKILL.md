---
name: release-qa
description: Agent-driven manual QA for a production release train. Browser-use drives real browsers against installed release builds; computer-use covers consoles with no API (Edge Partner Center, CWS console, AMO dev hub). Produces evidence for the production HITL checklist.
---

# Release QA (agentic manual testing)

You are preparing the human approval for a `production` release. The pipeline
proved the machine gates; you prove what only real hands and real browsers
can: real installs, real consoles, real store surfaces. Work from the
checklist in `docs/PRODUCTION_HITL_CHECKLIST.md` and leave evidence.

## Preconditions (verify, stop if missing)

1. A promote-PR or `production.yml` run exists; stage 1 is green.
2. Built artifacts exist: workflow artifacts (`cqd-chrome-zip`,
   `cqd-edge-zip`, `dist-firefox`) or local `extension/.output/{chrome-mv3,
   edge-mv3,firefox-mv2}` at the release commit.
3. Evidence root exists: `mkdir -p qa-artifacts/release-<version>`.

## Browser-use leg (real browsers, installed builds)

For each browser (Chrome, Edge, Firefox):

1. Install the release build the way a user would — Chrome/Edge: load
   unpacked is NOT a user install; prefer packing + drag-install or
   `--load-extension` only when drag-install is unavailable, and record which
   you did. Firefox: install the signed xpi (the QA companion when the store
   xpi is not yet live).
2. Drive the core journeys with the browser-use tool against
   `https://classroom.google.com` fixtures or the local HTTPS simulator
   (`pnpm test:simulator` surfaces, see `tests/e2e/qa/harness.ts` for
   scenario wiring): download single attachment, download all, student-work
   by status, options toggles, download history.
3. Capture per journey: screenshot + console errors + downloaded files list.
   Save under `qa-artifacts/release-<version>/<browser>/<journey>/`.

Never touch the daily browser profile. Never log into Google through the
automation browser — use the dedicated `.live-profile` flows or the simulator.

## Computer-use leg (consoles with no API)

Edge Partner Center, the Chrome Web Store console, and the AMO author area
have pages no API exposes. For each:

1. Open the console in the owner's real browser session (computer-use).
2. Capture: listing status, in-review state, version history head.
3. Screenshot into the evidence root; transcribe status into the run notes.

Read-only only. Never click publish/submit in any console — the pipeline is
the only submitter. If a console shows a state that contradicts the pipeline
verdict (stuck review, rejected submission), STOP and report the mismatch;
do not try to fix it in the console.

## Report

End with a table: browser × journey × pass/fail + evidence path, console
statuses, and one verdict line: "HITL evidence complete" or a list of
blockers as bead IDs. The approver reads your table; make it self-sufficient.

## Escalation

- Extension install fails outside Playwright → check `docs/E2E_BROWSER_MATRIX.md`
  known limitations (branded Chrome automation quirks) before filing a bead.
- Live-Classroom checks are the owner's session (`LIVE_CLASSROOM=1`,
  `.live-profile`); prepare the command, let the owner run it, capture output.
