## v1.3.9
### Summary
Current stable manual-changelog release.
### Added
- Manual changelog source flow and generated artifacts for deterministic releases.
### Changed
- Strengthened website snapshot freshness behavior and changelog rendering stability.
### Fixed
- Fixed stale website/session snapshot behavior that could show old numbers.

## v1.3.8
### Summary
Revision-aware changelog update.
### Added
- Changelog revision checks for same-version republish scenarios.
### Changed
- Update detection now compares version and content revision semantics.
### Fixed
- Fixed missed changelog notifications when content changed without version increment.

## v1.3.7
### Summary
Changelog and UX polish release.
### Added
- Website changelog integration from extension changelog actions.
### Changed
- Improved popup changelog footer/action layout.
### Fixed
- Fixed close-button position and hover issues.

## v1.3.6
### Summary
Dependency compatibility maintenance release.
### Added
- Compatibility guardrails for extension dev/runtime tooling.
### Changed
- Updated dependency wiring for browser dev flow.
### Fixed
- Fixed `minimatch`/ESM export runtime failures during dev startup.

## v1.3.0
### Summary
Major hardening and reliability release.
### Added
- Stronger analytics resilience and security-oriented runtime checks.
### Changed
- Improved analytics transport, buffering, and retry behavior.
### Fixed
- Fixed cancellation accounting and flush edge-case inconsistencies.

## v1.2.7
### Summary
Operations maturity and integration expansion release.
### Added
- Broader extension-to-dashboard and telemetry integrations.
### Changed
- Improved ingestion and retry behavior across services.
### Fixed
- Fixed auth/telemetry integration regressions found in production-like flows.

## v1.2.3
### Summary
Usability and telemetry consistency release.
### Added
- Better feedback/uninstall data capture integrations.
### Changed
- Improved extension schema alignment with backend endpoints.
### Fixed
- Fixed inconsistent telemetry fields in specific event paths.

## v1.2.2
### Summary
Cancel-flow polish release.
### Added
- Extra cancellation behavior coverage and safety checks.
### Changed
- Improved cancel interaction responsiveness.
### Fixed
- Fixed inconsistent cleanup after cancellation.

## v1.2.1
### Summary
Unified cancel system iteration release.
### Added
- Unified cancel-system handling for active operations.
### Changed
- Refined cancel/retry UX behavior.
### Fixed
- Fixed slow cancel-state reflection edge cases.

## v1.2.0
### Summary
Cancel feature baseline release.
### Added
- Core cancel-download functionality for in-progress operations.
### Changed
- Updated operation lifecycle to support cancellation.
### Fixed
- Fixed flow limitations where in-flight operations could not be interrupted.

## v1.1.10
### Summary
Late 1.1 line reliability release.
### Added
- Additional stability checks for repeated classroom workflows.
### Changed
- Tuned runtime defaults for safer long-session operation.
### Fixed
- Fixed regressions discovered across prolonged usage sessions.

## v1.1.5
### Summary
Mid 1.1 quality and compatibility release.
### Added
- Expanded compatibility checks for supported browsers.
### Changed
- Improved popup/runtime consistency.
### Fixed
- Fixed minor behavior mismatches in repeated task flows.

## v1.1.1
### Summary
Post-1.1 stabilization release.
### Added
- Additional background-flow instrumentation coverage.
### Changed
- Improved queue and error-handling defaults.
### Fixed
- Fixed early 1.1 edge-case runtime failures.

## v1.1.0
### Summary
Feature and packaging expansion release.
### Added
- Broader multi-browser support improvements.
### Changed
- Updated setup/runtime behavior for wider compatibility.
### Fixed
- Fixed packaging/config mismatches.

## v1.0.1
### Summary
Post-launch stabilization release.
### Added
- Better diagnostics for analytics and sync.
### Changed
- Improved compatibility in repeat-use scenarios.
### Fixed
- Fixed first-wave regressions after 1.0.0 rollout.

## v1.0.0
### Summary
First stable production release.
### Added
- Core one-click Classroom download experience.
### Changed
- Established baseline extension data contracts.
### Fixed
- Fixed pre-stable blockers before public release.

## v0.0.0
### Summary
Initial project bootstrap baseline.
### Added
- Initial extension scaffolding and project foundations.
### Changed
- Set initial repository and extension structure.
### Fixed
- N/A
