# Session Log — 2026-08-22: Engine V4 Sprint 1 — Accuracy Harness (S1 complete)

## Scope executed

User approved: claim and implement `CQD-1yf.1` Sprint 1 task chain T1→T8 per
`docs/superpowers/plans/2026-08-22-engine-v4-s1-accuracy-harness.md`. All 8 tasks
done, TDD order preserved. No commits (conservative git profile — user directive).

## Beads

| Bead | Task | Status |
|---|---|---|
| `1yf.1.1` | Corpus label types | CLOSED |
| `1yf.1.2` | Pure metrics module | CLOSED |
| `1yf.1.3` | Strict corpus loader | CLOSED |
| `1yf.1.4` | Tier A + Tier B runners | CLOSED |
| `1yf.1.5` | Seed corpus (3 labelled cases) | CLOSED |
| `1yf.1.6` | Gate + ratcheting budget | CLOSED |
| `1yf.1.7` | Report script + pnpm tasks | CLOSED |
| `1yf.1.8` | CI wiring | CLOSED |
| `CQD-ass` (new) | **D12** — comment verdict lost without golden/L0 selectors | OPEN, P1 |

## Files created / modified

Created (all under `extension/tests/accuracy/` unless noted):
- `types.ts` — label/report types, no logic
- `metrics.ts` + `metrics.test.ts` — pure scorer (5 tests)
- `corpus.ts` + `corpus.test.ts` — strict loader (4 tests)
- `tier-b.ts`, `tier-a.ts`, `runners.test.ts` — real-detector + real-decider runners (3 tests)
- `accuracy-budget.json` — measured baseline (see below)
- `accuracy.test.ts` — THE GATE (8 tests)
- `corpus/stream-edited-and-comments-en/{page.html,expected.json}`
- `corpus/rtl-flagged-post-ar/{page.html,expected.json}` (copied from trusted fixtures)
- `corpus/plain-post-no-flags-en/{page.html,expected.json}` (hand-written negative control)
- `extension/tools/accuracy-report.mjs`

Modified:
- `extension/package.json` — added `test:accuracy`, `accuracy:report` scripts
- `.github/workflows/ci.yml` — "Run Extension Accuracy Gate" step after golden suites (guarded on corpus presence, matching existing convention)
- `docs/ENGINE_V4_MASTER_PLAN.md` §7 — D12 added to defect register

Deleted: `tests/accuracy/debug-probe.test.ts` (temporary T6 baseline probe).

## Verification (commands + results)

| Command | Result |
|---|---|
| `pnpm compile` (after T1, after T8) | PASS, exit 0 both times |
| `pnpm vitest run tests/accuracy/metrics.test.ts` | RED then GREEN 5/5 |
| `pnpm vitest run tests/accuracy/corpus.test.ts` | import-fail RED → ENOENT RED (per plan) → GREEN 4/4 after seeding |
| `pnpm vitest run tests/accuracy/runners.test.ts` | RED then GREEN 3/3 |
| `pnpm vitest run tests/accuracy/accuracy.test.ts` | 7/8 → C1 caught 2 failing cases → 8/8 with baseline budget |
| `pnpm test:accuracy` | PASS 20/20 across 4 suites |
| `pnpm run accuracy:report` | prints verbose gate output as designed |
| `python3 yaml.safe_load(ci.yml)` | `yaml ok` |
| `pnpm test` (full extension suite) | **116 files / 3414 tests, all pass**, 45.6s |

## The headline finding — D12 (new defect)

The harness paid for itself on its first run. Both positive seed cases fail the
same way: engine extracts `commentCount=5` and `edited=true`, but predicts
`commentPresent=false`.

Why: in these DOM shapes the count lives in a `.comment-count` shell that matches
no scoring layer above L4 TreeWalker (15–20 pts). Decide needs ≥40
(`comment_show`). L0 (`.qCWAqb .huI6Cb`) and L3 golden selectors never fire.
So whenever Google's classes drift or an alternate shell appears, the entire
comment verdict silently disappears while the count is still reported.

Implication: current detection depends hard on a handful of class names; there
is no structural fallback. This is exactly the fragility Engine V4 exists to
remove. D12 filed (`CQD-ass`), scheduled S4, cost 1 d. Fix must not reintroduce
D5-style blind trust.

## Measured baseline (2026-08-22)

| Metric | Value |
|---|---|
| Coverage | 1.0 (3/3 posts observed) |
| Comment precision | 1.0 (vacuous: 0 predicted positives) |
| Comment recall | **0.0** ← the D12 hole |
| Edited precision / recall | 1.0 / 1.0 |
| Count exact rate | 1.0 (2/2) |
| Exact cases | plain-post-no-flags-en |
| knownFailures | stream-edited-and-comments-en, rtl-flagged-post-ar |

Negative control passed: engine correctly ignores "Commentary" / "Add comment"
(D3/D6 guards hold on this shape).

Ratchet state: floors locked at measured values; `knownFailures` may only shrink;
a case that starts passing while listed FAILS the build.

## Deviations from plan (both benign, both surfaced)

1. Plan T6 Step 3 said "Expected: PASS, 8 tests" but also "C1 tells you which
   cases the current engine gets wrong". Reality: C1 failed with 2 cases. Step 4's
   procedure (record measured baseline) was followed exactly as written.
2. Sprint checklist required linking knownFailures to §7 defect IDs; they matched
   none of D1–D11, so D12 was created and appended to §7.

## Blast radius

- Runtime product code: ZERO lines touched. Everything is test harness + CI step + package.json scripts + docs.
- CI impact: new gate runs on every PR once merged; guarded so branches without the corpus skip it.
- Risk: if the accuracy suite flakes, CI blocks — mitigation is the same as every other suite here (jsdom, deterministic, no network).
- Rollback: delete `extension/tests/accuracy/`, revert package.json + ci.yml hunks. Nothing else depends on it.

## Not done (deliberate, per user instruction)

No git commits. Staging command when approved:

```bash
git add extension/tests/accuracy extension/tools/accuracy-report.mjs \
        extension/package.json .github/workflows/ci.yml docs/ENGINE_V4_MASTER_PLAN.md \
        docs/session-logs/2026-08-22-engine-v4-s1-accuracy-harness.md
```

(Working tree also contains unrelated pre-existing drift — do NOT stage wholesale.)

## Next

Sprint S2 (`1yf.2`) unblocks now that S1 closed: corpus growth to ~40 cases,
capture/sanitization tool, V1 characterization. First ratchet target: fix D12,
empty `knownFailures`, raise comment recall floor off 0.
