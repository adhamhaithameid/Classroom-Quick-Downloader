# Release Pipeline — Two-Lane Model

Status: live design, 2026-10-28 · Spec: [superpowers/specs/2026-10-28--production-pipeline-design.md](superpowers/specs/2026-10-28--production-pipeline-design.md) · Epic: beads `9bmc`

## Lanes

| Lane | Branch | Gets | Never gets |
|---|---|---|---|
| Development | `main` | topic PRs, Renovate, fast CI, scoped pre-push gate | deploys, store publishes |
| Release | `production` | promote-PRs from `main` only | direct commits, unreviewed publishes |

**Behavior change (2026-10-28 cutover):** pushes to `main` no longer deploy
the worker or website. Everything production-facing runs from `production`
after the full strict pipeline and one human approval.

## The release train

`production.yml` runs on push/PR to `production` (plus dispatch rehearsals):

1. **Stage 1 — gates.** Strict tests (all workspaces, 100% coverage profiles),
   full e2e (chromium + edge + headed; signed-firefox best-effort),
   manual-QA replay (chromium + edge), integration
   (extension↔worker DO contract + website integration), mutation gate
   (Stryker ≥ 80%, promote-PR events), version preflight, `Release ✅`.
   CodeQL runs on `production` too and is a required check.
2. **Stage 2 — approval.** The `production` environment requires a reviewer.
   GitHub applies this to administrators. One approval per run releases:
   worker deploy → website deploy → store publication → post-publish verify.

Rehearsal (no effects): `gh workflow run production.yml` — `dry_run` defaults
to `true`. The approval click is exercised; deploy/publish legs no-op with a
notice of what they would have done.

## Gate ledger (incident → gate)

| Incident class | Gate |
|---|---|
| Secret leaks (fixtures, alerts #3–#9, 2026-10-27) | GitGuardian, CodeQL, `fixtures-hygiene.test.ts`, push protection (owner toggle) |
| Vulnerable deps (fast-uri, brace-expansion, undici, kit advisories) | audit gate, Socket, Renovate weekly backlog |
| Code vulns (CodeQL #36 bad-tag-filter) | CodeQL required on both lanes |
| Coverage collapse | `test:coverage:all` 100% profiles |
| Logic bugs surviving tests | Stryker: incremental per-PR (`src/core` changes), full 80% on promote-PRs, nightly on main |
| Cross-browser breakage (bs7c data-drive-id drift) | e2e matrix + mega-e2e drift probes |
| Manual-checklist regressions | `tests/e2e/qa/` replay in CI + HITL pass per release |
| Extension↔worker contract break | integration job (DO contract test) |
| Version skew (Edge "> live", AMO 409) | `tools/version-preflight.mjs` per-store verdicts |
| Publish bypass (legacy tag path) | `extension-distribution.yml` is draft-release only |
| Missing/expired secrets mid-publish (CWS 7-day token) | preflight fails the release; probes validate tokens before approval |
| Bad release reaching users | environment approval + dry-run rehearsals |

## Version preflight semantics

`node tools/version-preflight.mjs [--release-set cws,edge,amo] [--allow-unknown <store>] [--json]`

- Per store: `publish-needed` (version > live), `current` (live ≥ version —
  covers in-review and already-submitted), `missing-secrets`, `unknown`.
- Fail-closed exactly for release-set stores: a missing secret or a failing
  probe blocks the release. Stores outside the set are never probed.
- No store in the set needs publishing → the promote deploys infra only and
  publication is skipped with a notice. This is the bootstrap-safe path.
- Store legs additionally treat re-submission races as clean skips
  (CWS `ITEM_NOT_UPDATABLE`, Edge 409, AMO version-exists).

## Emergency paths

- Store-only emergency: dispatch `extension-stores.yml` with
  `allow_non_production=true` and a tag ref. The `production` environment
  approval still applies; the dispatch-preflight job records the exception.
- Worker/website emergency: dispatch the deploy workflow with
  `allow_non_production=true`. Same approval applies.
- Normal hotfix: fix on `main` → promote PR → gates → approval. The full
  e2e stage is the accepted hotfix latency.

## Cutover state and owner steps

Checklist history lives in the epic bead `9bmc`. Owner-only actions:

1. Cloudflare Pages project production branch: `main` → `production`
   (console). Do this in the same maintenance window as step 3 of the
   cutover — deploys are intentionally paused between the two.
2. Enable secret-scanning push protection (console).
3. Branch protection if the token cannot write it (bead `4fo` JSON in
   [E2E_BROWSER_MATRIX.md](E2E_BROWSER_MATRIX.md)).

## Related docs

- [STORE_PUBLISH_RUNBOOK.md](STORE_PUBLISH_RUNBOOK.md) — store mechanics,
  AMO 409 rule, slug/GUID quirks.
- [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) — worker/website deploy
  internals and post-deploy verification.
- [PRODUCTION_HITL_CHECKLIST.md](PRODUCTION_HITL_CHECKLIST.md) — what to do
  before clicking Approve.
- [.agents/skills/release-qa/SKILL.md](../.agents/skills/release-qa/SKILL.md)
  — the agent-driven manual QA protocol.
