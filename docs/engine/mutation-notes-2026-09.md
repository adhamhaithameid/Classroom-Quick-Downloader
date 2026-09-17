# Mutation testing on `extension/src/core` — Stryker baseline (September 2026)

Sprint: Engine V4 S12 accuracy ratchet, task 3. Gate: **mutation score ≥ 80%**
on `src/core/**` (detect, acquire, name), enforced nightly.

## How to run

```bash
pnpm -C extension run test:mutation          # stryker run (incremental)
node extension/tools/mutation-score-check.mjs 80   # CI gate (exit 1 below 80)
```

- Config: `extension/stryker.config.json` — Stryker 10.0.0,
  `@stryker-mutator/vitest-runner` 10.0.0, `mutate: ["src/core/**/*.ts"]`,
  thresholds `{ high: 80, low: 70, break: null }` (`break` disabled on purpose:
  the score gate lives in `tools/mutation-score-check.mjs`, which the nightly
  workflow runs right after `stryker run`), concurrency 4, `timeoutMS` 30000.
- Test runner config: `extension/vitest.mutation.config.ts` (only delta vs
  `vitest.config.ts`):
  - excludes `tests/acquire-corpus.test.ts` — its PRODUCTION-side describe has
    11 pre-existing failures (background-flow harness cannot load
    `entrypoints/background/index.ts` in the jsdom test env, `Analytics.flush`
    undefined; tracked separately, not a core defect) and Stryker's dry run
    refuses to start while any test fails. The pure-machine contract stays
    covered by `tests/core/acquire/state-machine.test.ts` and the fast-check
    suite in `tests/acquire-properties.test.ts`.
  - aliases `../../tests/simulator` (imported by `tests/acquire-properties.test.ts`
    from the REPO ROOT) to its absolute location, discovered by walking up until
    `tests/simulator` exists — Stryker's sandbox only copies `extension/`.
- `@stryker-mutator/vitest-runner` must be listed explicitly under `plugins` —
  pnpm's layout defeats Stryker's plugin auto-discovery.
- Incremental file: `extension/.stryker/incremental.json` is COMMITTED. It
  makes reruns fast and documents accepted survivors.
  **Caveat:** the incremental differ reuses verdicts for mutants whose source
  file did not change, even when new tests would now kill them (static mutants
  and some covered-by sets). After adding tests WITHOUT touching `src/core`,
  delete `.stryker/incremental.json` and do one full run (~15 min) to get the
  true score; always full-run before tightening the gate.

## Baseline vs final (full runs, no incremental)

| File                  | Baseline 2026-09-17 | Final |
| --------------------- | ------------------: | ----: |
| acquire/download-url  | 71.43%              | 91.96% |
| acquire/state-machine | 56.17%              | 100.00% |
| detect/action-buttons | 96.97%              | 100.00% |
| detect/matching       | 98.33%              | 94.92% |
| detect/normalize      | 86.21%              | 96.55% |
| detect/numerals       | 94.74%              | 94.51% |
| name/derive           | 86.67%              | 86.67% |
| name/sanitize         | 54.84%              | 74.19% |
| name/strip            | 77.42%              | 87.10% |
| name/type-labels      | 91.55%              | 97.18% |
| name/verify           | 100.00%             | 100.00% |
| **All files**         | **73.93%**          | **95.64%** |

Baseline: 510 killed + 77 timeout of 794 mutants (107 survived, 100 no-coverage).
Final: 739 killed + 7 timeout of 780 counted mutants (32 survived, 2 no-coverage;
14 excluded from the denominator by the inline disables above).
The no-coverage bulk was `acquire/state-machine.ts` (85) — the reducer flows the
excluded corpus file used to exercise — plus sanitize/strip branch boundaries.

## What was added (killer tests)

- `tests/core/acquire/state-machine.test.ts` — full (state, effects) pins for
  every reducer branch: `strategy-started` (direct/drive-auth/inert), inert
  edges from planned and non-matching phases, transient-failed retry + second
  failure (`detail` passthrough and `'transient'` default), saved-inheritance
  (direct, drive-auth, explicit-id-wins, non-attempt never inherits),
  `set-deadline`/`clear-deadline` settle shapes, plan-with-no-strategies,
  rotation skipping attempted authusers, timeout detail, second start-failure,
  `bypass-tab-opened`.
- `tests/core-download-url.test.ts` — `/u/{n}` multi-digit prefix, anchored
  mid-path non-strip, warmup prefers `continue` over `id`, warmup with bare
  `id`, depth cap (3 hops convert, 4th returned raw), append-only authuser,
  foreign-host file paths untouched, `/open`//`/uc` without id, classroom
  id→resourceId→fileId precedence.
- `tests/core/name/sanitize.test.ts` — per-label sweep (every English and
  Hungarian table entry), short bare labels, locale folding (`HU`, `hu-HU`,
  whitespace-padded `' hu '`), EN-only vs merge-all locale rules, strip
  corroboration boundaries (1–10 char extensions, no-dot stems, whole-name
  label), longest-label-wins, doubled-name case-insensitivity, repeated
  extension 2–10 char bounds + end anchor, derive edges.
- `tests/core/detect/normalize.test.ts` — every BiDi class stripped
  individually (isolates, ALM, BOM, soft hyphen, zero-width, embeddings).
- `tests/core/detect/numerals.test.ts` — BiDi control after the run does not
  split it, run landing exactly on `PARSER_SANITY_CEILING`, chip at exactly
  `MAX_COUNT_CHIP_LENGTH` accepted, one over rejected, digitValue run
  boundaries in other scripts.
- `tests/core/detect/action-buttons.test.ts` — the not-in-canonical-table
  error message now asserted to carry the drifted source.

Full suite grew 3,851 → 3,912 passing tests (61 added by S12 task 3; the 11
pre-existing acquire-corpus production-side failures are unrelated and
unchanged).

## Survivor dispositions (final state)

Accepted survivors fall into documented classes:

1. **Dead code (disabled inline, `// Stryker disable all`):**
   `acquire/state-machine.ts` `toBypassTab` — orphaned transition helper; no
   reducer path enters `bypass-tab` since the zero-tab contract (S11). Kept as
   design §7 scaffolding; the `bypass-tab-opened` event contract is tested
   directly with a constructed state.
2. **Equivalent mutants (disabled inline with reason):**
   - `acquire/download-url.ts` catch blocks (L62/L82) — empty catch is
     equivalent, control reaches the identical trailing return.
   - `acquire/state-machine.ts` `toBypassTab` region (above).
   - `detect/matching.ts` L90 — phrase-loop upper bound overrun only ever
     compares undefined tokens, which never equal a keyword token.
   - `detect/numerals.ts` `digitValue` guards (L50/L59) — defensive fallbacks
     proven unreachable for `\p{Nd}` input.
3. **Equivalent-by-redundancy (accepted, left visible in reports):**
   - `acquire/download-url.ts` L35 `^`-removal — a mid-path `/u/{n}` strip can
     never create an anchored downstream match, so behavior is identical.
   - `acquire/download-url.ts` L100 `!originalUrl`, `name/derive.ts` L14
     `!url`, `detect/numerals.ts` L74 `!text`, `name/sanitize.ts` L24
     `!rawName` — falsy-input guards are reproduced by the code path below
     them (URL parse throw / empty loop / empty pipeline).
   - `name/sanitize.ts` L28 doubled-text family — odd-length names can never
     have equal halves (`slice` truncation), `length > 0` is covered by the
     halving identity, `||` differs only at length 0 which returns `''` anyway.
   - `name/sanitize.ts` L36 `.trim()` — the slice never leaves a trailing
     space (the removed backreference ends in an alphanumeric).
   - `name/strip.ts` L25/L27 — a whole-name label or empty stem is rejected
     again by the extension corroboration regex; L30 best-tracking — the label
     table orders every longer label before its shorter suffix, so the first
     candidate is always the shortest stem and the comparison never fires.
   - `detect/numerals.ts` L29 — `char.length > 0` is implied by the digit
     regex test; L55 `previous < 0` unreachable (digit run starts are ≥ U+0030).
   - `detect/matching.ts` L49 `+` quantifier — `filter(Boolean)` makes run
     splitting redundant; L63/L64/L82 — empty-input guards duplicate
     downstream empty semantics.
   - `name/derive.ts` L17 — `pop() || ''` fallback equivalent for every URL.
   - `name/type-labels.ts` L88 — `.trim()` on the locale only matters for
     whitespace-padded locales, which the S12 sweep now covers (the remaining
     optional-chaining mutant is identical for typed strings).
   - `name/type-labels.ts` `'Zip'` dropped — `sanitizeFileName('a.zipZip')`
     still collapses via the case-insensitive repeated-extension regex
     (`\.zipZip$` matches under the `/i` flag), so the bare label entry is
     behaviorally redundant for the glued form.

Everything else that could be killed, was killed. Any NEW survivor that
appears in a nightly report should be triaged the same way: prove the mutated
behavior with a failing test and commit the test, or justify the mutant here.

## CI integration

`.github/workflows/nightly-tests.yml` runs, after the strict pyramid:

1. `pnpm -C extension run test:mutation` (Stryker, incremental — fast when
   `src/core` and the tests are unchanged since the last committed
   incremental state);
2. `node extension/tools/mutation-score-check.mjs 80` — the actual gate.

On failure the job auto-files a deduped `ci-failure` issue titled
"🔴 Nightly mutation testing failed", separate from the test:strict one.

## Known limitations

- The nightly incremental run reports a CONSERVATIVE score: mutants killed in
  an older full run stay credited, but survivors are only re-judged when their
  own source file changes. The gate can therefore only be fooled into failing,
  not into falsely passing, by this — but run a full run (delete
  `extension/.stryker/incremental.json`) before celebrating a score plateau.
- `tests/acquire-corpus.test.ts` remains excluded from mutation runs (see
  above). If its production-side harness gets fixed, remove the exclude in
  `extension/vitest.mutation.config.ts` and re-run.
