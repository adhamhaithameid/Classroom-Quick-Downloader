# Changelog

This is the main engineering changelog for Classroom Quick Downloader.
It focuses on meaningful product, reliability, security, and architecture changes instead of raw commit history.

## Versioning Notes
- Current extension release line: `1.5.5`
- Recommended next patch release: `1.5.6`
- Planned next engine milestone: `1.6.0`
- Pre-`1.0.0` bootstrap work is intentionally omitted from the user-facing release ledger

## [Unreleased]

### Summary
Student Work stabilization update focused on silent resolution and strict per-submission file mapping.

### Changed
- Removed popup-based Student Work resolver fallback so resolution is fully silent.
- Increased default Student Work resolver timeout to reduce premature timeout failures.

### Fixed
- Fixed Student Work flows that could land in error state before bridge resolution completed.
- Fixed edge-case wrong/repeated mapping risks by tightening strict hinted extraction and candidate selection.

### Security
- Hardened debug panel rendering by escaping runtime values before HTML injection.

## [1.5.5] - 2026-03-17

### Summary
A packaging optimization release focused on reducing extension size while preserving stable classroom behavior.

### Added
- Added tighter packaging checks for Student Work and core download modules to prevent unnecessary artifact growth.

### Changed
- Reduced bundled payload by trimming unused runtime paths and release artifacts.

### Fixed
- Fixed extension package bloat that increased install and update cost on slower networks.

## [1.5.4] - 2026-03-16

### Summary
A performance-focused release with two targeted throughput improvements across scan and download orchestration.

### Added
- Added lightweight scan throttling safeguards for busy Student Work pages.

### Changed
- Improved scan scheduling throughput for large submission boards.
- Improved download-state propagation throughput to reduce UI lag during multi-file runs.

### Fixed
- Fixed repeated heavy-pass work that could slow down larger Classroom pages.

## [1.5.3] - 2026-03-15

### Summary
Introduced a new flags/files detection layer to keep ownership and mapping stable across complex Classroom layouts.

### Added
- Added a dedicated correlation layer that aligns file cards and flag ownership with stricter DOM boundaries.

### Changed
- Updated detection order so file identity and flag identity resolve from the same scoped card context.

### Fixed
- Fixed edge cases where shared wrappers could cause mis-scoped file or flag decisions.

## [1.5.2] - 2026-03-14

### Summary
A focused stabilization release delivering bug fixes and stronger security hardening for production classrooms.

### Added
- Added stricter URL validation and safer resolver guardrails for indirect Student Work links.

### Changed
- Improved defensive checks around download-state transitions and resolver message-bridge handling.

### Fixed
- Fixed download-state and mapping regressions that could impact reliability under mixed attachment sets.

## [1.5.1] - 2026-03-13

### Summary
Expanded Student Work tap coverage so teachers can download attached files and media directly from submissions.

### Added
- Introduced support for Student Work tap downloads based on real user needs — big thanks to @Ahmed for the valuable feedback 🙌

### Changed
- Aligned Student Work button rendering and Download All wiring with the stable classroom download flow.

### Fixed
- Fixed early Student Work gaps where some submissions were not reachable through the normal download UX.

## [1.5.0] - 2026-03-10

### Summary
This release stabilizes the current DOM-first engine architecture and brings the extension to the best practical state it has reached so far for real Classroom usage. The main focus is accuracy: better download targeting, cleaner button placement, cleaner flag placement, stronger bad-link rejection, and a stronger V2 foundation without changing the live user experience unnecessarily.

### Added
- Added a clearer V2 foundation around discovery, scoring, validation, and repair so future engine work can move forward without rewriting the stable path.
- Added baseline tooling for selector catalogs, runtime capture, and regression verification to make future refactors safer.
- Added stronger test coverage for attachment targeting, invalid Docs-family links, URL normalization, popup behavior, and live toggle reactions.
- Added real-time flag toggle handling so comment and edited badges react immediately when settings are changed.

### Changed
- Tightened download-target classification so the extension prefers real attachment surfaces instead of loose post-body links.
- Improved Google URL normalization for real Classroom, Drive, and Docs flows, including `/u/<number>/...` variants.
- Improved popup settings behavior and changelog/settings interaction flow while keeping the extension runtime stable.
- Reframed the engine roadmap so the stable DOM-first milestone remains `1.5.0`, and API-assisted discovery becomes the later `1.6.0` step.

### Fixed
- Fixed random download buttons appearing on Google Forms and Google Sheets links that are not real downloadable file attachments.
- Fixed missing download buttons on real Classroom attachment cards after the stricter link filtering pass.
- Fixed duplicate or nested flag borders where both the full post and an inner section could receive styling.
- Fixed download completion states that could remain stuck in loading even after the browser finished the file.
- Fixed popup image loading regressions in development caused by an overly strict CSP allowance.
- Fixed several false-positive and false-negative paths around post-card detection and attachment promotion.

## [1.4.0] - 2026-03-08

### Summary
A large architecture and reliability milestone that introduced the V2 engine foundation in shadow mode. This release focused on building a safer internal future without sacrificing the current stable behavior that users already rely on.

### Added
- Added the V2 orchestrator, route classification, canonical model, placement pipeline, and flag-scoring foundation.
- Added shadow-mode comparison and diff tooling so V2 can be measured against the legacy engine before takeover.
- Added selector-scoring and fallback structures to prepare for Classroom DOM changes.
- Added deeper validation, correction-queue, and performance-budget modules for future runtime governance.
- Added debugging and baseline tooling for safer engine iteration.

### Changed
- Shifted engine work from isolated scripts toward a unified orchestrated runtime model.
- Improved internal separation between discovery, decision-making, rendering, validation, and repair.
- Updated release planning so future engine steps can be shipped in deliberate milestones instead of hidden rewrites.

### Fixed
- Fixed several legacy fragility points by introducing stronger structure around selectors and rendering responsibility.
- Fixed multiple hard-to-debug areas by giving the codebase clearer module boundaries and testing seams.

## [1.3.9] - 2026-03-05

### Summary
A release focused on changelog consistency and product communication across the extension and website.

### Added
- Added a clearer manual changelog source flow for predictable releases.
- Added stronger coverage for changelog publishing and display behavior.

### Changed
- Improved release communication consistency between extension and website surfaces.
- Standardized changelog formatting and release-note structure.

### Fixed
- Fixed inconsistent changelog visibility and stale update-state edge cases.

## [1.3.8] - 2026-03-02

### Summary
A changelog reliability release that made updates detectable even when the version number stayed the same.

### Added
- Added revision-aware changelog tracking for same-version republishes.
- Added stronger integration coverage for update and seen-state behavior.

### Changed
- Changed changelog detection to use version plus content revision instead of version alone.
- Improved update-state handling in changelog flows.

### Fixed
- Fixed same-version publish cases where users could miss important new changelog content.
- Fixed stale changelog state after content updates.

## [1.3.7] - 2026-03-01

### Summary
A UI and UX polish release for the changelog experience.

### Added
- Added stronger website changelog integration from extension surfaces.
- Added cleaner user-facing release communication.

### Changed
- Improved changelog action layout and button arrangement.
- Refined changelog interaction behavior for a smoother user experience.

### Fixed
- Fixed close-button layout and hover inconsistencies.
- Fixed footer/button layout issues in the changelog view.

## [1.3.6] - 2026-02-20

### Summary
A dependency and compatibility maintenance release.

### Added
- Added compatibility guardrails for the development and runtime toolchain.

### Changed
- Updated dependency routing and browser-development compatibility behavior.

### Fixed
- Fixed `minimatch` and ESM export compatibility failures that broke dev startup.

## [1.3.0] - 2026-02-18

### Summary
A major reliability and security hardening release across the extension, worker, and analytics path.

### Added
- Added stronger analytics resilience, runtime checks, and security-oriented hardening.
- Added stricter validation for extension-side data handling.

### Changed
- Improved analytics transport, buffering, and retry behavior.
- Improved queue integrity and safer processing defaults.

### Fixed
- Fixed cancellation accounting inconsistencies and flush edge cases.
- Fixed multiple reliability issues in the event-processing path.

## [1.2.7] - 2026-02-04

### Summary
A broad security and operations maturity release.

### Added
- Added stronger extension-side protections and wider security coverage.
- Added broader dashboard and telemetry integrations.

### Changed
- Improved resilience under heavy workloads and production-like flows.
- Improved ingestion and retry behavior across connected services.

### Fixed
- Fixed auth, telemetry, and integration regressions discovered under harder testing conditions.

## [1.2.3] - 2026-02-02

### Summary
A usability and telemetry consistency release.

### Added
- Added better feedback and uninstall integration paths.

### Changed
- Improved schema alignment between the extension and backend endpoints.

### Fixed
- Fixed inconsistent telemetry fields in specific event paths.

## [1.2.2] - 2026-01-31

### Summary
A cancellation polish release.

### Added
- Added extra coverage and safety checks for cancel behavior.

### Changed
- Improved cancel responsiveness and clearer cancel-state handling.

### Fixed
- Fixed inconsistent cleanup after cancellation.

## [1.2.1] - 2026-01-29

### Summary
A unified cancel-system iteration release.

### Added
- Added unified cancel-system handling for active operations.

### Changed
- Refined cancel and retry behavior.

### Fixed
- Fixed slow cancel-state reflection edge cases.

## [1.2.0] - 2026-01-27

### Summary
The first cancellation-focused release.

### Added
- Added core cancel-download functionality for in-progress operations.

### Changed
- Updated operation lifecycle handling to support cancellation.

### Fixed
- Fixed flows where in-flight operations could not be interrupted.

## [1.1.10] - 2026-01-25

### Summary
A late 1.1 stability release.

### Added
- Added more stability checks for repeated Classroom workflows.

### Changed
- Tuned runtime defaults for safer long-session operation.

### Fixed
- Fixed regressions discovered during prolonged usage sessions.

## [1.1.5] - 2026-01-22

### Summary
A mid-line quality and compatibility release.

### Added
- Added broader compatibility checks for supported browsers.

### Changed
- Improved popup and runtime consistency.

### Fixed
- Fixed smaller behavior mismatches in repeated task flows.

## [1.1.1] - 2026-01-21

### Summary
A post-1.1 stabilization release.

### Added
- Added background-flow instrumentation and coverage.

### Changed
- Improved queue defaults and error-handling behavior.

### Fixed
- Fixed early 1.1 runtime failures.

## [1.1.0] - 2026-01-20

### Summary
A feature and packaging expansion release.

### Added
- Added broader multi-browser support improvements.

### Changed
- Updated setup and runtime behavior for wider compatibility.

### Fixed
- Fixed packaging and configuration mismatches.

## [1.0.1] - 2025-12-20

### Summary
A post-launch stabilization release.

### Added
- Added better diagnostics for analytics and sync behavior.

### Changed
- Improved repeat-use compatibility and reliability.

### Fixed
- Fixed the first wave of regressions after 1.0.0.

## [1.0.0] - 2025-12-10

### Summary
The first stable production release of Classroom Quick Downloader.

### Added
- Added the core one-click Google Classroom download workflow.
- Added the baseline product and data contracts used by the stable extension line.

### Fixed
- Fixed pre-stable blockers before the public release.
