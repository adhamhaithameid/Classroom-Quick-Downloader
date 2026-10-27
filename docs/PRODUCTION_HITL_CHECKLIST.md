# Production Release — HITL Checklist

Human-in-the-loop gate before clicking **Approve** on the `production`
environment. Every box needs evidence linked in the release run notes.
Agent execution guidance: [release-qa skill](../.agents/skills/release-qa/SKILL.md).

## 0. Context (5 min)

- [ ] Release notes drafted: version, user-visible changes, risk areas.
- [ ] This release's changes are all merged to `main` and the promote-PR is
      the only diff `main..production`.
- [ ] `version` in `extension/package.json` is greater than every live store
      version (the pipeline's version-preflight shows `publish-needed`).

## 1. Machine gates (the pipeline proves these — verify, do not re-run)

- [ ] `Release ✅` green on the promote-PR: strict tests, full e2e,
      manual-QA replay, integration, mutation ≥ 80%, version preflight.
- [ ] CodeQL + GitGuardian + audit gates green on the head commit.
- [ ] `qa-replay-report` artifact downloaded and skimmed for `ENVIRONMENT:`
      skip reasons (expected: none on chromium/edge).

## 2. Local deep pass (before dispatching the rehearsal on release trains)

- [ ] `scripts/mega-e2e --quick` green locally.
- [ ] For user-visible download/detection changes: `scripts/mega-e2e
      --require-live` (needs `LIVE_CLASSROOM=1` and `tests/e2e/.live-profile`)
      — real Classroom student + teacher spot check.

## 3. Agentic manual QA (release-qa skill)

- [ ] Built artifacts installed in real Chrome, Edge, Firefox (release zips
      from the workflow artifacts or `extension/.output/`).
- [ ] Browser-use sweep: the hl4.7 matrix core journeys (download single,
      download all, student work by status, options toggles) on each browser.
- [ ] Computer-use steps where no API exists: Edge Partner Center listing
      health, CWS console status page, AMO author area — screenshot evidence.
- [ ] Evidence saved under `qa-artifacts/release-<version>/`.

## 4. Store readiness

- [ ] CWS refresh token younger than 7 days (re-mint if older — the token
      scoping lesson from 2026-10; preflight validates it anyway).
- [ ] AMO listed add-on state healthy (no stuck in-review from a prior run).
- [ ] Changelog updated (`data/changelog/` + website entry), version sync
      green (`pnpm run check:versions`).

## 5. Approve and watch

- [ ] Click Approve on the `production` environment.
- [ ] Watch the train: worker deploy → website deploy → store legs (or their
      dry-run notices) → post-publish verification.
- [ ] Store listing URLs render the new version (re-review queues can lag;
      the pipeline posts the links in the run summary).
- [ ] File follow-up beads for any warning surfaced along the train.

## Rollback posture

- Worker/website: redeploy the previous production commit via dispatch
  (approval still required). Extension stores: versions are immutable — a
  bad extension release needs a fixed follow-up version, not a rollback.
  Document the incident and the gate gap as a bead either way.
