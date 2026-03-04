## v1.3.8
### Summary
Improved changelog reliability so users always receive updates, even when the version number stays the same.
### Added
- Revision-aware changelog tracking that detects content/rule changes from Cloudflare publishes.
- Stronger integration coverage for extension-to-Cloudflare changelog synchronization.
### Changed
- Seen-state behavior now compares version plus changelog revision instead of version alone.
- Popup changelog open flow now force-refreshes from Cloudflare before marking as seen.
### Fixed
- Fixed same-version publish cases where users could miss new changelog updates.
- Fixed stale version-pill/changelog content after Cloudflare-side updates.

## v1.3.7
### Summary
Improved daily reliability and clearer release communication for normal users.
### Added
- Cleaner user-facing release note wording in extension update channels.
- Better in-product guidance around install/update flow.
### Changed
- Refined runtime status handling for smoother transitions.
- Improved behavior during heavy multi-file class sessions.
### Fixed
- Fixed cancelled-download accounting edge cases.
- Fixed intermittent long-run progress-state inconsistencies.

## v1.3.6
### Summary
Focused on stability and security hardening for heavy classroom workloads.
### Added
- Extra runtime safety checks for extension processing.
- Expanded internal coverage for changelog and analytics behavior.
### Changed
- Improved handling of mixed and large file batches.
- Improved recovery after temporary tab sleep/network interruptions.
### Fixed
- Fixed stuck-progress scenarios during long runs.
- Fixed dependency-path compatibility friction.

## v1.3.5
### Summary
Improved popup interaction quality and reduced day-to-day friction.
### Added
- Better keyboard support in popup interactions.
- Additional runtime checks for popup state transitions.
### Changed
- Smoother popup flow and status feedback.
- More consistent behavior in repetitive classroom usage.
### Fixed
- Fixed keyboard legend interaction regressions.
- Fixed minor popup UI behavior inconsistencies.

## v1.3.4
### Summary
Improved browser compatibility and safer internal request handling.
### Added
- Stronger guardrails for internal request validation.
- Additional compatibility checks for modern browser builds.
### Changed
- Improved cross-browser consistency across extension flows.
- Refined feedback in key extension actions.
### Fixed
- Fixed browser-specific instability edge cases.
- Fixed validation issues in extension request paths.

## v1.3.3
### Summary
Improved responsiveness and reliability in high-volume classroom usage.
### Added
- Better internal handling for heavy multi-file operations.
- More robust long-session state continuity protections.
### Changed
- Faster startup for large download batches.
- Better continuity after interruptions during active runs.
### Fixed
- Fixed noisy non-actionable error output in successful flows.
- Fixed recovery issues after refresh during active sessions.

## v1.3.2
### Summary
Improved long-session stability while keeping analytics privacy-first.
### Added
- Better safeguards for aggregated telemetry flow.
- Additional queue safety handling for long-running sessions.
### Changed
- Improved accuracy for partial/cancelled completion reporting.
- Refined background processing stability over long sessions.
### Fixed
- Fixed interrupted-flow accounting inconsistencies.
- Fixed queue flush timing reliability issues.

## v1.3.1
### Summary
Started the 1.3 line with core stability and predictability improvements.
### Added
- Baseline hardening for runtime behavior.
- Better internal checks for queue/state transitions.
### Changed
- Improved queue handling on heavy Classroom pages.
- Improved consistency for large attachment sets.
### Fixed
- Fixed early 1.3 regression points in normal flows.
- Fixed minor runtime consistency issues.

## v1.3.0
### Summary
Delivered major reliability, remote-config, and analytics improvements.
### Added
- UTC-based scheduling/timestamp handling for extension analytics.
- End-to-end ACK metadata handling for accepted/duplicate/invalid events.
- Server-time drift tracking support in config handling.
### Changed
- Improved payload validation and safer queue processing.
- Improved retry behavior with strict retry-limit handling.
### Fixed
- Fixed remote-config application issues on key limits/timing.
- Fixed queue integrity mismatch handling to avoid data drops.

## v1.2.7
### Summary
Broad security and reliability hardening across extension behavior.
### Added
- Stronger extension-side protections and validation coverage.
- Expanded runtime/security-oriented extension tests.
### Changed
- Improved resilience during high-volume mixed workloads.
- Improved consistency in security-sensitive paths.
### Fixed
- Fixed multiple reliability edge cases found during hardening.
- Fixed several production stability regressions.

## v1.2.6
### Summary
Improved reliability and prepared safer long-session behavior.
### Added
- More internal guard checks for queue/state control.
- Additional edge-case test coverage.
### Changed
- Refined in-flight download lifecycle handling.
- Improved user-facing state consistency in long sessions.
### Fixed
- Fixed intermittent state mismatch issues.
- Fixed repeated-workflow regression cases.

## v1.2.5
### Summary
Focused on predictable behavior and lower daily friction.
### Added
- Better fallback handling for unstable browser moments.
- Added diagnostics hooks used for stability verification.
### Changed
- Improved responsiveness under repeated actions.
- Refined UI-state transitions for clearer feedback.
### Fixed
- Fixed download-flow continuity regressions.
- Fixed status desync edge cases.

## v1.2.4
### Summary
Continued incremental runtime hardening for consistency.
### Added
- Additional background-processing safety checks.
- Better resilience for interrupted runtime states.
### Changed
- Improved event and queue sequencing behavior.
- Improved consistency across page variations.
### Fixed
- Fixed intermittent bugs in repeated batch actions.
- Fixed smaller session continuity issues.

## v1.2.3
### Summary
Improved cancellation handling and overall workflow stability.
### Added
- Unified cancellation handling foundations.
- Better sequencing safeguards for active operations.
### Changed
- Improved cancellation feedback during ongoing operations.
- Refined runtime flow for more predictable outcomes.
### Fixed
- Fixed cancellation edge cases in active downloads.
- Fixed stale-state leftovers after interruption paths.

## v1.2.2
### Summary
Polished cancellation UX and improved practical reliability.
### Added
- Better cancellation control handling in interaction flows.
- Extra test coverage for cancel-flow behavior.
### Changed
- Improved cancel button responsiveness and clarity.
- Improved behavior when stopping heavy operations.
### Fixed
- Fixed cancellation regressions in specific usage patterns.
- Fixed inconsistent cleanup after cancellation.

## v1.2.1
### Summary
Introduced a unified cancel system with UI polish.
### Added
- Unified cancel system for active operations.
- UI updates for clearer cancel-related state.
### Changed
- Improved interaction flow around cancel/retry behavior.
- Refined telemetry for cancellation outcomes.
### Fixed
- Fixed slow cancel-state reflection edge cases.
- Fixed minor inconsistencies in cancel-adjacent controls.

## v1.2.0
### Summary
Introduced the cancel-download feature baseline.
### Added
- Core cancel-download functionality for in-progress operations.
- Supporting state model for cancellation-aware workflow.
### Changed
- Updated lifecycle handling to support cancellation.
- Updated popup behavior for cancel-capable states.
### Fixed
- Fixed flow limitations where operations could not be interrupted.
- Fixed pre-1.2 state transition weaknesses.

## v1.1.1
### Summary
Improved runtime consistency and quality in the 1.1 line.
### Added
- Better multi-browser compatibility foundations.
- More resilient default configuration behavior.
### Changed
- Improved classroom workflow consistency in normal usage.
- Improved popup state handling stability.
### Fixed
- Fixed post-1.1.0 quality issues.
- Fixed smaller bugs affecting daily usage smoothness.

## v1.1.0
### Summary
Expanded browser support and improved packaging quality.
### Added
- Multi-browser support improvements.
- Refreshed icon and distribution asset set.
### Changed
- Improved setup/compatibility behavior across browsers.
- Updated dependency baseline for better stability.
### Fixed
- Fixed compatibility gaps in non-primary browsers.
- Fixed packaging/config mismatch issues.

## v1.0.1
### Summary
Delivered early post-launch stability and quality refinements.
### Added
- Early quality-of-life improvements in runtime handling.
- Additional compatibility and configuration tuning.
### Changed
- Improved dependency behavior for steadier runtime results.
- Improved reliability in repeat-use scenarios.
### Fixed
- Fixed first-run and repeat-usage issues after launch.
- Fixed minor regressions discovered after 1.0.0.

## v1.0.0
### Summary
First stable extension release for one-click Classroom download workflows.
### Added
- Initial stable architecture and core download workflow.
- Popup UI/settings baseline with analytics foundations.
### Changed
- Standardized project structure for extension evolution.
- Established baseline behavior for classroom interactions.
### Fixed
- Fixed pre-stable blockers required for production release.
- Fixed core flow issues discovered during stabilization.
