# gosec Triage Profile

> Update (2026-02-28): Latest full-repository scan baseline is documented in /docs/MAJOR_SCAN_2026-02-28.md; deployment/rollout actions are tracked in /docs/DEPLOYMENT_RUNBOOK.md.

This repository runs `gosec` in CI as part of `ci.yml` and `oracle-backend-ci.yml` with the following triage policy:

- No global rule exclusions are allowed in CI.
- Findings fail CI unless they are fixed or have a targeted inline suppression (`#nosec`) with a justification.

## `G701` Handling Policy

`G701` is gosec taint-analysis SQL injection detection. In this codebase it can report false positives against static SQL executed with bound parameters via `database/sql` APIs (`QueryContext`, `QueryRowContext`, `ExecContext`, prepared statements).

For any safe false positive, add a precise inline suppression on the specific line and document the safety reason. Typical accepted reasons:

- SQL text is static at compile time.
- Dynamic identifiers are selected from explicit allow-lists.
- Untrusted values are always passed as bound parameters.
- High-risk dynamic SQL paths have additional guardrails and tests.

## Suppression Rules

When adding `#nosec`, keep it precise:

- Put it on the flagged line.
- Include the specific rule id (for example `#nosec G202`).
- Add a short reason describing the safety property.

Broad or blanket suppressions are not allowed.
