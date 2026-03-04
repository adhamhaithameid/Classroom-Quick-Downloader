# CQD Unified Plan

## Archived Plan A
### Changelog Reliability Recovery Plan (Oracle-Centered, GitHub-Backed, Fast Cache)

This section preserves the previously approved plan for changelog reliability recovery and Oracle-centered synchronization.
It is retained for history and rollback context.

Status: Archived (superseded by Active Plan)

## Archived Plan B
### Plan Addendum: Python Website Backend (Read Cache + Event Ingest + 3h Oracle Sync)

This section preserves the previously approved Python backend addendum.
It is retained for architecture history only.

Status: Archived (superseded by Active Plan)

## Active Plan
### Final Plan Rewrite: Free-Tier Cloudflare Edge Backend + Session-Pinned Website Cache + Manual Changelog

#### Goals
- Keep website fully on Cloudflare runtime/services where possible on Free tier.
- Keep Oracle as centralized source of truth and archival storage.
- Remove runtime changelog customization dependencies and move changelog management to manual source-controlled files.
- Prevent placeholder `0` flashes and pin numbers per browser session.
- Update only Oracle dashboard visual language (Google AI Studio dark similarity), no website redesign.

#### Phase Checklist
- [x] Phase 0: Plan + docs bootstrap complete.
- [x] Phase 1: Cloudflare site backend routes (`/api/site/v1/*`) live.
- [x] Phase 2: Session-pinned website cache + no-refresh-button UX complete.
- [x] Phase 3: UTC schedules aligned (Oracle pull / Oracle export).
- [x] Phase 4: Manual changelog source + sync tooling complete.
- [x] Phase 5: Legacy changelog customization commented out (not removed).
- [x] Phase 6: Oracle dark UI update complete.
- [x] Phase 7: Version bumps complete (`extension=1.3.9`, `cloudflare=3.0.0`, `oracle=5.0.0`).
- [x] Phase 8: Strict test suite expanded and passing.
- [x] Phase 9: Documentation overhaul complete.

#### Mandatory Scan Gate (after each phase)
1. `pnpm run test:smoke`
2. `pnpm run test:security:all`
3. Targeted package strict checks for touched components.

#### Key Decisions
- Queue pipeline remains optional behind feature flag on free plan.
- No auto-delete for Oracle truth tables.
- Website data stays stable for current open session.
- New data only appears on next page refresh/reopen.
