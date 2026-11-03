# Design: Production Pipeline — Two-Lane CI/CD (main / production)

Date: 2026-10-28 · Status: approved (plan review 2026-10-28; spec review round 1 fixes applied) · Epic: beads `9bmc`

## Problem

Everything production-facing ships from ad hoc triggers: the worker and website
deploy on every push to `main`, and the extension stores publish by
`workflow_dispatch` from any ref. Gaps found in the 2026-10-28 audit:

- The manual-QA replay suite (`tests/e2e/qa/`, 13 specs) never runs in CI.
- No version-monotonicity preflight (past failures: Edge "must be > live",
  AMO 409 version-exists).
- Store publish legs silently skip when secrets are missing or expired
  (CWS refresh token expires every 7 days).
- `extension-distribution.yml` auto-publishes AMO on any `v*` tag push with no
  mega-e2e gate — a bypass of every other gate.
- Only 4 status checks are required on `main`; the "CI ✅" summary and E2E are
  not required (bead `4fo`).
- No approval environments, no `production` branch, no reusable workflows.

## Goals

1. Block every known failure class before it reaches users (gate ledger below).
2. `main` = development lane (current activities, fast feedback).
3. New `production` branch = release lane: strict tests, full e2e, manual-QA
   replay, mutation gate, integration job, version preflight, one human
   approval, then worker deploy → website deploy → store publication.
4. Mutation testing also runs per-PR (incremental) and once per release SHA.
5. Agentic manual QA (browser-use + computer-use) becomes a documented,
   repeatable release step with evidence.

## Non-goals

- No staging infrastructure (single prod Cloudflare project; the dry-run mode
  of the pipeline is the rehearsal).
- No rewrite of the 21 existing workflows; additions and targeted trigger
  changes only.
- No auto-publish without approval, ever.

## Lane model

| | `main` (dev lane) | `production` (release lane) |
|---|---|---|
| Receives | topic-branch PRs, Renovate | promote-PRs from `main` only |
| CI | existing `ci.yml` + 3 new jobs | `production.yml` full strict stage |
| Deploys | none (after cutover) | worker, website, stores — after approval |
| Protection | required checks incl. "CI ✅" + E2E | strict contexts required; human gate = environment approval |
| Pre-push gate | scoped | full (like main) |

Review policy on `production`: no PR review requirement (the sole maintainer
cannot self-approve; merges ride the existing admin-merge norm). The enforced
human gate is the `production` environment required reviewer, which GitHub
applies to administrators too. Every publish/dispatch path that can reach
users carries `environment: production`, including the emergency dispatch.
The environment carries a required reviewer but NO deployment branch policy:
a branch policy would also block the emergency dispatches that run from tags
or `main` refs (policies bind administrators too). Ref discipline is enforced
by branch protection on `production` plus the ref guards inside each workflow.

## Gate ledger (threat → blocking gate)

| Threat (evidence) | Gate |
|---|---|
| Secret leaks (alerts #3–#9, 2026-10-27) | GitGuardian, CodeQL, fixtures-hygiene guard (landed); push protection = owner toggle |
| Vulnerable deps (fast-uri, brace-expansion, undici) | audit gate, Socket, Renovate backlog issue |
| Code vulns (CodeQL #36) | CodeQL required on `production` (triggers extended to `production` first) |
| Coverage collapse | `test:coverage:all` 100% profiles (existing) |
| Logic bugs surviving tests | Stryker: incremental per-PR on `src/core`; full 80% gate once per release SHA (promote-PR only); nightly stays |
| Cross-browser breakage | full e2e (chromium, edge, headed); signed-firefox stays best-effort evidence, quota-gated, never blocking (AMO review-latency class) |
| Manual-checklist regressions | qa/ replay in CI + HITL/agentic pass per release |
| Extension↔worker contract break | dedicated integration job (existing DO contract test + website integration layer) |
| Version skew / AMO 409 | `tools/version-preflight.mjs`: publish runs only when extension version > live store versions; bootstrap promote (equal versions) skips publishing by design |
| Publish bypass (legacy tag path) | distribution workflow becomes draft-release-only |
| Missing/expired secrets mid-publish | preflight validates exactly the stores in the release set; a leg with missing secrets blocks the release instead of silently skipping |
| Bad release reaching users | `production` environment approval + `dry_run` rehearsals |

## Version-preflight semantics (`tools/version-preflight.mjs`)

- Inputs: `extension/package.json` version, release set (default
  `cws,edge,amo`), store credentials from env.
- AMO: JWT GET of the add-on's versions (proven path). CWS: OAuth token
  exchange + item GET. Edge: product GET via api-key.
- Verdict per store: `publish-needed` (version > live), `current`,
  `unknown-probe-failed`, `missing-secrets`.
- Fail rules: any store in the release set with `missing-secrets` or
  `unknown-probe-failed` fails the release when the version is bumped
  (fail-closed exactly where publishing will happen). When the version equals
  live everywhere, publishing is skipped with a summary — infra-only promote.
- Probes for stores outside the release set never run (worker/website-only
  releases stay cheap and never blocked by store tokens).
- `--allow-unknown <store>` escape hatch for probe outages, printed loudly.

## Pipeline shape (`production.yml`)

Triggers: `push` + `pull_request` to `production`; `workflow_dispatch` with
`dry_run` (default `true`) and `publish_set` inputs. Caller sets
`permissions` explicitly and passes `secrets: inherit` to every
`workflow_call`/reusable usage (workflow_call does not inherit secrets).

Stage 1 — gates (PR and push): `strict-tests` (all workspaces) · `full-e2e`
(chromium+edge+headed; signed-firefox best-effort) · `qa-replay`
(qa-chromium, qa-edge; firefox best-effort) · `mutation-gate` (full Stryker
≥ 80, **pull_request events only** — the push re-runs the identical SHA's
already-proven gates without it) · `integration-gate` · `version-preflight`
· CodeQL (existing workflow, triggers extended to `production`) ·
`Release ✅` summary (`if: always()` accepting skipped as non-failure, so
event-scoped skips never wedge the branch).

Stage 2 — push only: `release-approval` (environment `production`) →
`deploy-worker` → `deploy-website` (reusable workflows, bodies moved verbatim
except concurrency: the stage uses one non-cancelling `production-release`
group, so a rehearsal or a follow-up promote can never cancel a live
`wrangler deploy` or a half-finished store submission) → `publish-stores`
(`extension-stores.yml` via `workflow_call`, `ref=production`,
`skip_gate=true` because stage 1 exceeded the quick scope) →
`post-publish-verify`.

Store legs are gated per store, not all-or-nothing: preflight emits a verdict
per store and `production.yml` passes `publish_cws` / `publish_edge` /
`publish_amo` inputs; each leg runs only when its verdict is
`publish-needed`. This kills the mixed-verdict residue (a "current" store
never re-attempts its equal version) and makes release retries idempotent:
an in-review or already-submitted AMO version classifies as `current`, and
the AMO leg additionally treats the version-exists 409 as a clean skip,
matching the parity the CWS and Edge legs already have.

Dispatch runs are rehearsals: `dry_run=true` executes stage 1 plus stage 2
with deploy/publish jobs in no-op mode that print intended actions.

## Main-lane additions (`ci.yml`)

- A `changes` job (git-diff based, no third-party action) emits per-scope
  booleans; `integration-tests`, `mutation-pr`, and `qa-replay` run `if` their
  scope changed. Docs-only PRs report all required contexts via the summary
  job, which treats `skipped` as non-failure.
- `integration-tests`: extension↔worker DO contract test + website
  `test:integration`.
- `mutation-pr`: Stryker `--incremental`, only when the PR touches
  `extension/src/core/**`, 80% floor via `mutation-score-check.mjs`.
- `qa-replay`: qa-chromium + qa-edge against the local HTTPS simulator.

## Trigger changes (cutover)

- `deploy-cloudflare-worker.yml`, `website-deploy.yml`: lose `push: main`;
  bodies move to reusable workflows called by `production.yml`; manual
  dispatch kept for emergencies, carries `environment: production`, and pins
  the website deploy to `--branch=production`.
- `extension-stores.yml`: gains `workflow_call`; dispatch refuses non-production
  refs unless `allow_non_production=true`, and its publish jobs carry
  `environment: production` so even the emergency path needs the approval.
- `extension-distribution.yml`: builds + draft release only; no publishing.
- `tools/pre-push-scope.mjs`: `production` pushes get the full gate.

## Cutover order (no half-states)

1. Land on `main`: reusable deploys, `production.yml`, stores `workflow_call`
   (old deploy triggers still active — zero behavior change yet).
2. Extend `codeql.yml` triggers with `production`.
3. Create `production` branch. Create the `production` environment (required
   reviewer = owner; no branch policy — see the review-policy note above).
4. Rehearse: dispatch `production.yml` with `dry_run=true` on `production`.
5. Cutover commit on `main`: remove `push: main` deploy triggers. Merge.
   From here deploys are intentionally paused.
6. Owner flips Cloudflare Pages production branch `main` → `production`
   (console). Paused window ends.
7. Promote `main` → `production` (real run): gates → approval → worker +
   website deploy (`--branch=production` now matches the Pages project) →
   publish skipped (versions equal live) → post-verify.

## Hotfix path

Fix lands on `main` through the normal lane; bump version if the extension is
affected; promote to `production`; the gates run and the approval click is the
fast human step. Store-level emergencies use the stores dispatch with
`allow_non_production=true`, which still requires the environment approval.
The full e2e stage is the accepted hotfix latency.

## Owner-only steps (documented checklists)

1. Cloudflare Pages project production branch: `main` → `production`.
2. Secret-scanning push protection: enable.
3. Branch protection / environment rules the token cannot write (bead `4fo`).
4. The approval click per release, after the HITL checklist.

## HITL + agentic manual testing

`docs/PRODUCTION_HITL_CHECKLIST.md` turns the hl4.7 QA sweep into the approval
checklist: mega-e2e evidence, qa replay report, live-Classroom student+teacher
spot check, then store consoles. New skill
`.agents/skills/release-qa/SKILL.md`: an agent session drives real browsers
(browser-use) against installed release builds and covers the no-API consoles
(Edge Partner Center, CWS console fallback, AMO dev hub) with computer-use;
evidence lands in `qa-artifacts/` and maps item-by-item to the approval.

## Accounting for parallel agents

All changes are additive jobs/workflows; existing surfaces other agents rely on
(scoped pre-push, `[amo-qa]` leg, workspace scripts) keep their contracts. The
deploy trigger removal is the one deliberate behavior change — announced here
and in `docs/RELEASE_PIPELINE.md`. Renovate automerge gets safer once "CI ✅"
is a required check (its ADR precondition).

## Validation

TDD for new tools scripts (`node --test`). `scripts/check --changed` per change.
YAML validation + a scratch-branch dry-run dispatch of `production.yml` before
cutover. Local `scripts/mega-e2e --quick` before the first production merge.
Final rehearsal with `dry_run=true` and a real approval click.
