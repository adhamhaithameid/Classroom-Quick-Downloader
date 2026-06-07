# Jules Review Rules

Use this checklist when reviewing Jules-generated work.

## Accept

- The PR or Issue is scoped to the agent's documented domain.
- The change fixes one concrete problem or files one actionable suggestion.
- The title follows `[AgentName]: [concise finding or change description]`.
- The body explains agent, day, date, severity, impact, fix, verification, and notes.
- Tests or validation are present when the touched area has a practical test path.
- The change does not expose secrets or add new broad permissions.

## Reject Or Request Changes

- The agent modifies files outside its prompt boundaries.
- The PR combines unrelated findings.
- The PR is speculative but changes code anyway.
- The PR duplicates an existing open Issue or PR without explaining why.
- The PR weakens privacy, permissions, CSP, auth, rate limiting, or telemetry hygiene.
- The PR rewrites working systems without a narrow reason.

## Merge Order

Prioritize review in this order:

1. Security fixes affecting extension message handling, Cloudflare Worker request handling, or Oracle backend auth.
2. User-reported bugs from survey-created Issues.
3. Test coverage that protects active release blockers.
4. Small reliability and accessibility fixes.
5. Suggestions, growth work, broad refactors, and planning-only output.

## Current Policy

External PRs remain closed without review under the source-available contribution policy. Jules PRs are owner-controlled internal maintenance and should still be reviewed manually before merge.
