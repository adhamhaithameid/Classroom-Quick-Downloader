## v1.5.0
### Summary
This is the best and most reliable state the extension has reached so far. Download buttons, flag placement, and post detection are now much more accurate in real Google Classroom usage.
### Added
- Better internal engine foundations for safer future upgrades.
- Stronger protection against bad detections and unstable page structures.
### Changed
- Download buttons are now much more careful about where they appear.
- The engine roadmap now keeps `1.5.0` as the stable DOM-first milestone and `1.6.0` as the later API-assisted step.
### Fixed
- Fixed random buttons appearing on Google Forms and Google Sheets links.
- Fixed missing buttons on real Classroom attachment cards after stricter filtering.
- Fixed duplicate or nested flag borders on some posts.
- Fixed download states that could stay stuck even after the browser finished the file.

## v1.4.0
### Summary
A major under-the-hood release that introduced the V2 engine foundation. It made the extension safer to improve without breaking the stable experience you already rely on.
### Added
- A new V2 engine foundation for smarter discovery, placement, and flag logic.
- Better internal tooling for testing and catching regressions.
### Changed
- The extension architecture is now much more structured and ready for future upgrades.
### Fixed
- Fixed several fragile internal paths by giving the extension clearer runtime boundaries.

## v1.3.9
### Summary
Improved release consistency and user-facing clarity across the website and extension experiences.
### Added
- Added clearer user-facing release communication for the current update cycle.
- Added stronger coverage for changelog publishing and display paths.
### Changed
- Updated changelog delivery flow so website and extension updates are more predictable.
- Refined release-note formatting consistency for easier reading.
### Fixed
- Fixed issues where changelog visibility could be inconsistent across surfaces.
- Fixed multiple reliability edge cases in update-state handling.

## v1.3.8
### Summary
Improved changelog reliability so users always receive updates, even when the version number stays the same.
### Added
- Revision-aware changelog tracking that detects content changes during same-version publishes.
- Stronger integration coverage for changelog synchronization.
### Changed
- Update detection now compares version plus changelog revision instead of version alone.
- Popup changelog flow now force-refreshes before marking an update as seen.
### Fixed
- Fixed same-version publish cases where users could miss new changelog updates.
- Fixed stale version-pill and changelog content after changelog updates.

## v1.3.7
### Summary
Improved daily reliability and clearer release communication for normal users.
### Added
- Cleaner user-facing release-note wording in extension update channels.
- Better in-product guidance around install and update flow.
### Changed
- Refined runtime status handling for smoother transitions.
- Improved behavior during heavy multi-file class sessions.
### Fixed
- Fixed cancelled-download accounting edge cases.
- Fixed intermittent long-run progress-state inconsistencies.

## v1.3.6
### Summary
Focused on stability and compatibility hardening for heavy classroom workloads.
### Added
- Extra runtime safety checks for extension processing.
- Expanded internal coverage for changelog and analytics behavior.
### Changed
- Improved handling of mixed and large file batches.
- Improved recovery after temporary tab sleep or network interruptions.
### Fixed
- Fixed stuck-progress scenarios during long runs.
- Fixed dependency-path compatibility friction.

## v1.3.0
### Summary
Delivered major reliability, remote-config, and analytics improvements.
### Added
- UTC-based scheduling and timestamp handling for extension analytics.
- Stronger metadata handling for accepted, duplicate, and invalid events.
### Changed
- Improved payload validation and safer queue processing.
- Improved retry behavior with stricter retry-limit handling.
### Fixed
- Fixed remote-config application issues on key limits and timing.
- Fixed queue integrity mismatch handling to avoid data drops.

## v1.2.7
### Summary
Broad security and reliability hardening across extension behavior.
### Added
- Stronger extension-side protections and validation coverage.
- Expanded runtime and security-oriented extension tests.
### Changed
- Improved resilience during high-volume mixed workloads.
- Improved consistency in security-sensitive paths.
### Fixed
- Fixed multiple reliability edge cases found during hardening.
- Fixed several production stability regressions.

## v1.2.3
### Summary
Usability and telemetry consistency release.
### Added
- Better feedback and uninstall data-capture integrations.
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
Unified cancel-system iteration release.
### Added
- Unified cancel-system handling for active operations.
### Changed
- Refined cancel and retry behavior.
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
- Improved popup and runtime consistency.
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
- Updated setup and runtime behavior for wider compatibility.
### Fixed
- Fixed packaging and configuration mismatches.

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
