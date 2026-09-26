# Phase 0 Execution Plan — Pre-Plan Hardening Gate (epic `0h4d.12`)

**Date:** 2026-09-26 · **Owner:** Adham Haitham · **Tracker:** bd epic `Classroom-Quick-Downloader-0h4d.12`
**Directive:** every known issue, bug, and security finding is fixed before the Free→Pro plan phases (0h4d.1/.2/.3) proceed.

## Baseline findings (what the tracker said vs reality)

Six of the fourteen open beads were **stale** — their fixes had already landed
on main without the beads being closed:

| Bead | Reality on main (2026-09-26) |
|------|------------------------------|
| `2h4` + `p3l` | identity bullet present at `website/src/lib/content/privacy.ts:119`; seoRegression 11/11 green |
| `hqq` | svelte-check 0 errors on clean main; the `:global()` WIP landed fixed |
| `e4v.1` | SSRF allowlist + DO-RPC origin pinning + `tests/do-rpc-origin.test.ts` all on main; worker 1011/1011 |
| `hl4.6` | canary rewritten to the dedicated live profile with loud signed-in guard — but its hermetic guard test had never landed (built in this pass) |
| `rhq` | legacy pages.dev host verified 301ing in production (redeploy restored `_worker.js`); verifier passes 17/17 from a residential IP |

One **new known problem** was discovered and filed: the extension `tsc
--noEmit` is red on main (cross-package test import pulls worker sources
without workers-types globals), which breaks the pre-push gate for every
local push — vitest never surfaced it and GitHub merges bypass the hook.

## Waves

1. **Wave 1 — website** (`0h4d.12.2` magnetic half, `ipxb` copy half): restore
   `prototype-magnetic.html` to git (gitignore negation; the magnetic guard
   reads it as source of truth), approve `TestimonialsSection` in the guard's
   wired set (wiring shipped with the testimonials integration), reconcile
   "We collect nothing"/"No tracking" copy with the disclosed aggregate-
   telemetry posture ("Private by design" / "No personal data").
2. **Wave 2 — worker security** (`e4v.1` verify, `0h4d.12.1` triage): suite
   verification; taint finding at `engine-v3.ts:232` confirmed false positive
   (path terminates in `tests/v2-docs-anchor-discovery.test.ts:20` jsdom
   scaffolding; audit report S6).
3. **Wave 3 — deploy reliability** (`q8o`, `sqa9.4`, `rhq`): browser UA +
   retries on the deploy smoke curls; legacy-301 contract extracted to
   `tools/check-legacy-redirect.mjs` with fixture tests; hourly monitor runs
   the full `verify-production.mjs` (`SKIP_ORACLE_CHECK=1` — Oracle is
   severed from the live path); byline marker made markup-resilient (it was
   breaking every post-deploy verification).
4. **Wave 4 — canary guard** (`hl4.6`): hermetic structural guard for the
   canary auth contract.
5. **Final — new typecheck bead, `0h4d.12.4` deep scan, `4fo`, `0h4d.12.5`.**

## Execution constraints honored

- Work happens in a dedicated worktree (`CQD-wt-phase0`) off `origin/main` —
  parallel sessions own the main checkout's branch state.
- bd runs from the repo root (the worktree has no `.beads` Dolt DB).
- No Cloudflare dashboard mutations from an agent session (per sqa9.4):
  custom domain / WAF allowlist for CI, Redirect Rule, and store publishing
  are owner actions with exact steps in the close comments.
- The pre-push gate (`pnpm run test:gate`) runs before any push.

## Validation

Website 1189/1189 · worker 1011/1011 · extension typecheck clean · verifier
fixture tests 3/3 · canary guard 6/6 · verifier 17/17 against production ·
full gate green before push.
