# Plan: Exponential Backoff Retry Engine (bead `0h4d.1.3`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.3`
**Depends on:** — (independent; integrates with 1.2's queued waits when both land) · **Blocks:** `0h4d.1.11`

## Goal

Retryable failures back off exponentially with jitter, bounded — the current single transient retry (`transientRetried`, index.ts:534–542) becomes a policy-driven engine. The user always sees the attempt count; the failure is always honest at the end.

## Architecture

- **Pure policy:** NEW `extension/src/core/retry/backoff.ts` — `delayForMs(attempt, policy)` and `shouldRetry(policy, attempt)`; policy as data: `{ baseMs: 2000, capMs: 60000, maxAttempts: 3, jitter: 'full' }`.
- **State machine:** `src/core/acquire/state-machine.ts` `AcquireCommon` gains `retryCount?: number` (replaces the boolean `transientRetried` in machine state; the boolean on PendingDownload migrates). Machine stays pure — timing stays the engine's job (existing P3 deadline-closure property guards this).
- **Engine side:** `index.ts` onChanged TRANSIENT branch (525–542) consults the policy: `retryCount < maxAttempts` → schedule `retrySameAttempt` (index.ts:221–244) after `delayForMs`; else settle with the classified permanent path. The `2s setTimeout` becomes the computed delay.
- **Start-failure retry (S2):** the single `startRetried` in-place retry (download-handler.ts:309–316) stays as-is — its semantics were audited; only interrupt-driven retries scale.
- **Deadline:** `PENDING_DEADLINE_MS` (150s) re-arms per attempt — existing re-arm mechanics from job persistence cover restarts; the in-flight re-arm is the deadline scheduling already keyed to state transitions.
- **Queue interplay:** when 1.2 is merged, backoff waits occupy the `queued` state (no parallel timers); until then, in-place timers preserve current behavior.

## TDD Tasks

1. **Red:** `extension/tests/retry-backoff.test.ts` — fast-check: delay bounded by cap, ≥ base, jitter in `[0, delay)`; `shouldRetry` false at `maxAttempts`; policy immutable. **Green:** backoff.ts.
2. **Red:** state machine corpus — new cases: transient ×3 → terminal; transient ×1 → success; no retry after cancel. **Green:** machine `retryCount` handling; corpus differential (pure vs background-flow) stays green.
3. **Red:** property suite updates — P1/P3/P4 invariants hold with the new fields (random walks include retry events). **Green:** adjust generators.
4. **Red:** production engine test — `dispatchDownloadChange` interrupted with `NETWORK_FAILED` three times: three `retrySameAttempt` calls with policy delays (fake timers), then classified terminal. **Green:** index.ts policy wiring.
5. **Verify:** extension suite + critical coverage; corpus + differential green.

## Out of scope

Per-host retry budgets; retry after `SIZE_MISMATCH` policy split (lands with 1.5); Firefox-specific backoff.
