# Verification agent prompt — CQD engine verification (1.6.19)

Copy everything below the line into a fresh agent session in
`/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader`.

---

You are an independent verification agent. Your job is to ADVERSARIALLY verify
that the Classroom Quick Downloader extension engines (detection engine,
download/acquisition engine, Download All engine, naming engine, bridge) work
correctly and have no reachable dead ends, and that the shipped claims of
performance and security improvement hold. Do NOT trust prior session claims —
re-derive everything from the code and the test runs. Your verdict must be
evidence-backed: every claim you confirm or refute cites a file:line, a test
result, or a command you ran.

## Ground rules

- Repo: `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader` (git).
- pnpm needs: `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`.
- Never modify source to make a problem disappear. If you find a defect,
  you may add a failing test proving it, but fixes are OUT of scope — report.
- Another agent session may be working in `website/`, `cloudflare-worker/`,
  and S10 engine files concurrently — do not touch or commit those.
- Do not push. Do not close issues or beads. You are read-only + test-runs.
- Time-box: if a check cannot complete, record exactly why and move on.

## Part 1 — Regression sweep (run, record exact numbers)

1. `pnpm -C extension run compile` — must be clean (ignore pre-existing TS
   errors in `src/v2/orchestrator/orchestrator.ts`,
   `tests/v4-single-observer.test.ts`, `tests/v4-roles.test.ts`,
   `tests/v4-orchestrator.test.ts`, `tests/classroom-entrypoint-domport.test.ts`
   IF AND ONLY IF they belong to the concurrent S10 session; verify ownership
   with `git log --oneline -2 -- <file>` and `git status` first, and say so).
2. `pnpm -C extension test` — record Test Files / Tests totals; any failure
   outside the S10 session's files is a FINDING.
3. `pnpm -C extension run test:golden` and `pnpm -C extension run test:accuracy`
   — record results.
4. `npx playwright test --project=qa-chromium` (repo root) — record the full
   matrix. The ONLY acceptable skip is `qa-07` (env-gated live canary).

## Part 2 — No-dead-ends verification (the core mandate)

The contract: every download click reaches a terminal outcome with an
actionable message; nothing hangs, nothing fails silently, no window opens.

1. Read `extension/entrypoints/background/index.ts` (onChanged handler),
   `extension/entrypoints/background/download-handler.ts`,
   `extension/entrypoints/background/state.ts` (stall deadline),
   `extension/src/core/acquire/state-machine.ts`. Build a complete map:
   for every reachable failure class (validator reject, browser-start fail,
   SERVER_FORBIDDEN / ACCESS_DENIED, NETWORK_FAILED, SERVER_FAILED,
   NETWORK_TIMED_OUT, USER_CANCELED, FILE_FAILED, STORAGE_FULL, CRASH,
   SERVER_BAD_CONTENT, FILE_VIRUS_INFECTED, FILE_BLOCKED, HTML response at
   the filename hook, HTML at completion, stall-to-deadline, account-sweep
   exhaustion), state what the user's button shows and where in code that is
   produced. Flag ANY class that can end without a terminal status call.
2. Prove the zero-tab contract: `grep -rn "tabs.create\|windows.create"
   extension/entrypoints/background/ extension/src/adapters/` must return
   nothing; repeat on the built bundles in `extension/.output/chrome-mv3/`,
   `firefox-mv2/`, `edge-mv3/` (`grep -c "chrome.tabs.create"` on
   `background.js` must be 0).
3. Prove the corpus is real: run
   `pnpm -C extension exec vitest run tests/acquire-corpus.test.ts
   tests/acquire-properties.test.ts` — confirm every corpus case runs BOTH
   the pure machine and the scripted production flow (read the test), and
   that the property suite actually samples random sequences (numRuns > 0).
4. Dead-end hunt: pick any THREE failure classes from your Part-2 map and
   trace them end-to-end yourself (test or targeted temporary probe deleted
   afterward). Confirm the terminal message matches the runbook table in
   `docs/EXTENSION_TESTING_RUNBOOK.md`.

## Part 3 — Claims audit (issues/PRs solved, performance, security)

1. `gh issue list --state open --limit 100 --json number,title,labels` and
   `gh pr list --state open` — for each ENGINE-related item, verify against
   the code whether it is genuinely solved (cite evidence) or still open
   (report). Non-engine items (website/SEO/store/credentials) are out of
   scope except to list them.
2. Beads: `bd list --status open` — same treatment for engine children of
   epic `Classroom-Quick-Downloader-1yf`. S10/S11/S12/S13 are KNOWN-open
   program sprints, not defects — verify their gating is respected (S10 must
   NOT have started the irreversible V1 deletion before a store release;
   check `bd show 1yf.10` comments vs actual `git log` for V1 deletions).
3. Performance claims to verify with evidence:
   - Direct byte-serving endpoint (one hop, no interstitial):
     `extension/src/shared/drive-endpoint.ts` + simulator journey qa-06.
   - Download All groups settle (hidden-tab timer flush + live inProgress):
     `extension/entrypoints/download_all.content.ts` `scheduleRefresh` +
     the aggregation loop; the qa-02 journeys pass.
   - 150s stall deadline: `state.ts` `PENDING_DEADLINE_MS` + the index.ts
     expiry hook.
4. Security claims to verify:
   - No network surface beyond Google hosts: check
     `extension/src/v2/decision/download-validator.ts` allowlist + manifest
     host permissions in `extension/wxt.config.ts` + CSP.
   - Simulator-only MITM proxy/certs are test-scope: confirm
     `tests/simulator/certs/` is not shipped (not referenced by
     `extension/` production code) and the CA is clearly test-only.
   - No secrets/credentials in the diff history of the release commits
     (`git log --oneline v1.5.5..HEAD` equivalent range:
     from commit `29c1138d` to HEAD; run a targeted `git diff` scan for
     token/key patterns; also confirm `tests/helpers/dummy-secrets.ts`
     contains only dummy values).
   - Zero-window download surface: Part 2.2 result.

## Part 4 — Verdict

Produce a report with exactly these sections:

- **Regression sweep**: numbers for every suite; pass/fail per suite.
- **No-dead-ends map**: the failure-class table from Part 2.1, each row
  PASS (terminal + guidance) or FAIL (dead end) with evidence.
- **Claims audit**: solved/refuted/open per issue and bead; performance and
  security claim verdicts with evidence.
- **Findings**: numbered, each with severity (P1 blocks release / P2 should
  fix / P3 note), reproduction, and file:line.
- **Final verdict**: SHIP or DO-NOT-SHIP for manual testing of 1.6.19, with
  the one-paragraph justification.

Be skeptical. If something is green only because a test is weak, say so.
Your value is in what you REFUSE to rubber-stamp.
