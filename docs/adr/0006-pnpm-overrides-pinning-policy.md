# ADR-0006: Aggressive pnpm Overrides Pinning for Supply-Chain Security

- **Status:** accepted
- **Date:** 2026-08-21 (formalizes pre-existing practice)
- **Deciders:** Adham Haitham

## Context

The project ships a browser extension to three store review processes. Transitive
dependency vulnerabilities (or malicious updates) reach users through store
updates with slow review cycles. Audit findings had already led to a large
`pnpm.overrides` block pinning specific safe versions (e.g. `shell-quote`
1.9.0, `esbuild` 0.28.2, `ws` 8.21.0).

## Decision

Keep and maintain the root `pnpm.overrides` block as the supply-chain control:
when an audit flags a transitive dep, pin the patched version there rather than
waiting for upstream releases. Every override carries provenance in `_meta`
notes (date + reason), and `scan:security` runs audits across all workspaces.

## Consequences

- Patched transitive deps land immediately, independent of upstream maintainers.
- Overrides must be revisited when direct dependencies bump (a pinned override
  can conflict with a new major); `_meta.notes` keep the archaeology cheap.
- Lockfile diffs grow; Renovate's lockfile-maintenance keeps them healthy.

## Alternatives Considered

- Wait-for-upstream: too slow for store-distributed extensions.
- Full lockfile freezing without overrides: doesn't fix vulnerable transitive
  ranges that semver would otherwise allow.
