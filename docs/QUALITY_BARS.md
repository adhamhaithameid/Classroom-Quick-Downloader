# Quality Bars — What the Gates Actually Enforce

Written for agents and contributors after the 2026-10-03 sessions retro (last
44 interactive sessions read). These are the gates that repeatedly surprised
sessions and cost the most rework. Read this before running the suite and
before treating a red gate as a mystery.

## Pre-push gate

`.husky/pre-push` runs `pnpm run test:gate` =
`test:strict` (the full smoke → functional → integration → regression → load →
stress → security → ui → fuzz → reliability pyramid, per-package) **plus**
`test:e2e` and `test:e2e:edge`. It is intentionally heavy: nothing reaches the
remote without the whole suite green on this machine. One-off skip for a single
push is sanctioned via `git push --no-verify` — use it deliberately, never
routinely.

## Extension coverage threshold is 100%

`extension/vitest.config.ts` enforces **lines/functions/branches/statements at
100%** for two coverage profiles (`COVERAGE_PROFILE=critical|runtime`), each
with a fixed include list (`entrypoints/background/*`, analytics utils).
The "default" profile has no thresholds.

Real failure mode from the sessions: a change drops coverage to 99.04% in
`download-handler.ts` / `message-sender.ts`, CI reds with a bare threshold
error, and the session burns time rediscovering the bar. When coverage reds:

```sh
pnpm -C extension test -- --coverage   # then read the uncovered-line report
```

Write tests for the specific uncovered lines — the bar is not negotiable and
will not be lowered for convenience.

## svelte-check: 0 errors is the bar; the warnings below are known

`pnpm -C website check` must report **0 errors**. The following warnings recur
(47+ identical "0 errors and 4 warnings" outputs across sessions) and are
**known/benign** — do not burn sessions chasing them, and do not add new ones:

- Unused CSS selector `.cqd-reveal.cqd-reveal-pending` (and `-in` variant) —
  reveal-animation states applied at runtime.
- Unused CSS selector `.ft-mega-pending`, `.ft-mega-word`, `.ft-mega-base` —
  footer mega-menu animation states.
- `<div>` with pointermove / mouseenter handler must have an ARIA role —
  pre-existing a11y warnings tracked separately.

If you touch those components, re-check whether the warning is genuinely still
there before preserving it; fix real new warnings you introduce.

## Typecheck per package — never across packages

Run typechecks through the package scripts:

```sh
pnpm -C extension run compile     # extension tsc --noEmit
pnpm -C cloudflare-worker run typecheck
pnpm -C website run check         # svelte-check
```

Do **not** run raw `npx tsc` from one package over another package's sources:
`website`/`extension` tsc sweeping `../cloudflare-worker/src` produced 46
`Cannot find name 'D1Database'` false errors before PR #794 made worker type
imports explicit. Worker code typechecks only inside `cloudflare-worker/`
(where `@cloudflare/workers-types` is configured).

## Headed-only Playwright specs

`tests/e2e/headed/*.spec.ts` (e.g. `filename-security.spec.ts`) exercise
`chrome.downloads.onDeterminingFilename`, which **never fires in headless
Chromium**. They require a real headed browser; running them headless or in a
stripped CI environment produces failures that look like product bugs but are
environment misses. The same spec looped 33 times in one session before this
was understood.
