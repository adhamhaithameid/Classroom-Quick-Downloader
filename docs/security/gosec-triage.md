# gosec Triage Profile

This repository runs `gosec` in CI as part of `ci.yml` with the following triage policy:

- Rule `G701` is excluded in CI.
- All other findings fail CI unless they are fixed or have a targeted inline suppression (`#nosec`) with a justification.

## Why `G701` Is Excluded

`G701` is gosec taint-analysis SQL injection detection. In this codebase, it currently reports many false positives against static SQL executed with bound parameters via `database/sql` APIs (`QueryContext`, `QueryRowContext`, `ExecContext`, prepared statements).

The SQL injection risk in Oracle backend is instead controlled by:

- Static SQL text for normal handlers.
- Explicit allow-list mapping for dynamic table operations.
- Bound parameters for untrusted values.
- Tests covering dangerous paths (SQL console guardrails, danger-zone constraints, backup path validation).

If gosec improves `G701` precision for these patterns, remove the exclusion and enforce it in CI.

## Suppression Rules

When adding `#nosec`, keep it precise:

- Put it on the flagged line.
- Include the specific rule id (for example `#nosec G202`).
- Add a short reason describing the safety property.

Broad or blanket suppressions are not allowed.
