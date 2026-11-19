# Ledger: v3 base engine, Chrome first (2026-11-18 to 2026-11-19)

Branch `feat/v3-base-engine`, PR 934. Stacked on PR 933. 28 commits, 71 files, about 10.4k lines added (most are tests and reports).

## What changed and why

- **Chrome base engine behind a flag.** New `engineBase` flag (default `v2`, off). With it on, the Classroom API is the source of truth for an assignment's file list. API attachments are reconciled into the tracked post, deduped by Drive id, and kept on re-scan. The registry falls back to the V2 DOM scan. V1 stacks stay inert. All UI stays in the V2 render layer, pinned by an architecture guard.
- **Download All counts and runs the union.** A real-browser test found the label stuck at 2 files because the student-work sidecar strips `data-cqd-injected`. Fixed for the flag-on path only.
- **Non-Chrome auth scaffold (flag off, no caller).** `TokenSource`, PKCE S256 web auth flow, per-browser capability probe, `isApiConfigured()` web branch. `NON_CHROME_TOKEN_SOURCE_WIRED` stays false.
- **ADR 0010** with per-browser facts, owner prerequisites and rollout. Unverified facts are marked.
- **Review and test rounds.** Seven fresh-eyes reviews and six Stryker mutation rounds. Each finding was fixed test-first and verified.

## Evidence (all run by the coordinator)

- `scripts/check extension` exit 0. `pnpm -C extension test:coverage:all` exit 0: 255 files, 5036 tests, 100% on both profiles.
- Real Chromium `test:qa`: 23 passed, 2 skipped (live canary), including the flag-on spec.
- Flag-off parity: the base branch's own tests (239 files, 4689 tests) pass against this branch's source. `tsc` exit 0.
- Mutation: all reviewed files at 100% once proven equivalent mutants are excluded.
- Perf (flag off): bundles +6072 B (+0.25%); first-scan medians within 0.5%, ranges overlap; one API discovery call per view with the flag on. Flag-on scan time is not measured.
- Final review verdict: ship-safe with the flag off.

## Not proven

Real Google OAuth, real Classroom data, Firefox, Edge and Safari runs, native Docs/Sheets/Slides through the API URL path, whether the MV3 service worker exposes `navigator.userAgentData`.

## Owner items

1. **OAuth client type.** A Google Web client sends a client secret on the token exchange. Choose a client type that accepts PKCE alone, or a Web client with a Worker exchange proxy (the token source accepts an allowlisted `exchangeUrl`). Add the manifest web client id, redirect URIs per browser, the `identity` permission for Firefox and Edge, and check scope verification.
2. **Accept ADR 0010.**
3. **Persist `engineBase`** in `chrome.storage` and read it in every JS context before any flip.
4. **Decide**: gating the five ungated UI creators, tying the API snapshot to a post id, the details post dropping its own files on rescan (inherited, flag off).
5. **Merge** PR 933 first, then PR 934, plus PRs 930 to 932.

## Beads

82gr (persist flag), 4ao8 (owner OAuth), co2e (sidecar strips marker), 9v3g (snapshot post id), tj0l (gate UI creators), d2li (bail feedback, id forms), v2qe (watchdog never settles the group run, pre-existing).

## Process notes

GLM in ZCode ran chats 5 and 6 and started 7. Full-screen control timed out overnight, so later work ran as Claude subagents. Hook findings: a secret-scanner false positive on report prose (reworded, not bypassed); a flaky teardown race in `v2-bootstrap-flag-toggle.test.ts` (root cause fixed by mocking its lazy imports).

## Rollback

The flag is off by default. Revert the commits on the branch, or do not merge PR 934.
