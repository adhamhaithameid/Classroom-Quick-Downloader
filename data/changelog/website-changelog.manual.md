## v1.8.1
### Changed
- Background grid lines now bend gently around your cursor; static for reduced-motion / touch — falls back automatically.
- The footer now shares the page's ambient background (orbs + interactive grid) instead of painting its own.
### Fixed
- Fixed a duplicated static grid showing on the FAQ, Privacy, and Changelog pages.
- Fixed a slight horizontal scroll caused by decorative background glow bleeding past the screen edge.

## v1.8.0
### Summary
The no-dead-ends release: every download either succeeds or tells you exactly what to do next — with automatic retries, honest timeouts, and an adversarial test program proving it.
### Added
- Added automatic retry with backoff for temporary network and server failures.
- Added a 150-second download deadline: stalled downloads report "This download timed out. Try again." instead of hanging forever.
- Added specific failure messages for every error class: disk full, file unavailable, browser blocked, sign-in required, virus-blocked, and more.
### Changed
- Downloads now verify what actually landed — Drive error and quota pages are detected and handled, never saved as fake files.
### Fixed
- Fixed Sheets attachment downloads being rejected as invalid URLs.

## v1.7.9
### Summary
Firefox download reporting is now fully honest: success is only reported when the browser confirms the file finished.
### Changed
- Firefox downloads report success only on actual completion — no more phantom successes that later vanish.

## v1.7.8
### Summary
Stalled downloads now resolve honestly, and sign-in/error pages are never saved as fake downloads.
### Added
- Added a hard timeout: a stalled download cancels itself and reports "This download timed out. Try again." instead of hanging.
### Fixed
- Fixed sign-in and error pages being saved as fake download files — they are now detected and reported as sign-in errors.

## v1.7.7
### Summary
Every download failure now has a classified, actionable outcome.
### Added
- Added automatic retry for temporary network and server failures.
- Added specific messages for permanent failures: disk full, file unavailable, browser crashed, file blocked, and more.
### Fixed
- Fixed cancellations made from the browser's own download panel showing as errors — they now correctly show as cancelled.

## v1.7.6
### Summary
Internal hardening: a corpus of eleven real-world download failure scenarios now runs against both the engine's brain and its implementation, and they must agree on every outcome.

## v1.7.5
### Summary
The test simulator learned six new real-world failure shapes — server errors, sign-in redirects, mid-download connection drops, slow streams, empty files and quota pages — so the engine can be verified against them.

## v1.7.4
### Summary
Rendering groundwork for the next engine generation: all page observation now flows through one shared, throttled observer.

## v1.7.3
### Summary
Download All is now fully stabilized and the automated QA suite covers the entire manual runbook.
### Fixed
- Fixed the root cause of Download All groups hanging on "Downloading…" forever.
- Fixed Download All progress not updating when the Classroom tab was in the background.

## v1.7.2
### Summary
The Engine Mode switch shipped in popup settings (Legacy / New) with live switching and one-click rollback, and page detection is now wired to the download engine through one typed bridge.

## v1.7.1
### Summary
The engine's internals now communicate through a typed event bus — the architectural groundwork that lets every later change be measured and rolled back independently.

## v1.7.0
### Summary
Zero-window downloads verified end-to-end: the old background-tab workaround is fully removed, and a locked test file proves the invisible account fallback completes real downloads.

## v1.6.9
### Summary
The fix for the most-reported download bug: files that start but fail now quietly try your other signed-in accounts, and downloads go straight through Google's direct file endpoint.
### Fixed
- Fixed "files start but fail" reports on Firefox-family browsers (zen) and Brave.
- Fixed Download All groups with one broken file hanging instead of settling.

## v1.6.8
### Summary
The automated QA pipeline now replays the entire manual test runbook in real browsers — including real downloads verified byte-for-byte.

## v1.6.7
### Summary
Foundation for the automated QA program: a local, deterministic Google Classroom simulator that serves real downloadable files under the real Classroom origins.

## v1.6.6
### Summary
Detection and naming hardening: localized type labels no longer leak into filenames, download state races are fixed, and Sheets attachments get their buttons back.
### Fixed
- Fixed localized type labels (like "Tömörített archívum") leaking into downloaded filenames.
- Fixed download state races where concurrent downloads of the same file could cross wires.
- Fixed Google Sheets attachments not getting download buttons.

## v1.6.5
### Summary
More detection accuracy fixes: comment counts survive markup drift, exclusions match whole tokens, and localized dates parse correctly.

## v1.6.4
### Summary
Exclusion matching now operates on whole words, eliminating a family of false-positive detections.

## v1.6.3
### Summary
Detection defenses: number extraction now sanity-checks the page before trusting it.

## v1.6.2
### Summary
Detection accuracy across scripts: Armenian keywords, exact word-number matching, and Arabic diacritic folding fixed.

## v1.6.1
### Summary
The Engine V4 foundation: a measurable accuracy standard for the detection engine, a pure download state machine, and hardened release gates. Everything after this version is measured against a fixed corpus.
### Added
- Added the accuracy corpus and gates: detection decisions are held to labeled expectations across locales, with floors that may only move up.
- Added typed contracts, an event bus, and a pure acquisition state machine with bounded account rotation and forced deadlines.

## v1.6.0
### Summary
The Engine V4 foundation: a measurable accuracy standard for the detection engine, a pure download state machine, and hardened release gates — plus the security-audit roll-up that closed the 1.5 line. Everything after this version is measured against a fixed corpus.
### Added
- Added the accuracy corpus and gates: detection decisions are held to labeled expectations across locales, with floors that may only move up.
- Added typed contracts, an event bus, and a pure acquisition state machine with bounded account rotation and forced deadlines.
- Added cryptographically secure download identifiers and hardened release gates.
### Fixed
- Fixed a race condition where concurrent downloads of the same file could cross wires.
- Removed an unused browser permission (least privilege).

## v1.5.9
### Summary
A batch of reviewed, low-risk fixes and cleanups rolled into one stable release.

## v1.5.8
### Summary
Faster page scanning and a fully accessible popup.
### Changed
- Optimized DOM traversal with combined CSS selectors for faster scans on busy pages.

## v1.5.7
### Summary
A security-hardening release: the developer debug surface now escapes all runtime values before rendering.

## v1.5.6
### Summary
A security-and-accessibility release: cryptographically secure download identifiers, fully labeled controls, and deeper Student Work test coverage.

## v1.5.5
### Summary
A leaner packaging release focused on reducing extension size while preserving the same classroom behavior.
### Added
- Added tighter packaging checks for Student Work and core download modules.
### Changed
- Reduced bundled payload by trimming unused runtime paths and release artifacts.
### Fixed
- Fixed extension package bloat that increased install and update cost on slower networks.

## v1.5.4
### Summary
A performance-focused release with two measurable speed upgrades in scan and download orchestration paths.
### Added
- Added lightweight scan throttling safeguards for busy Student Work pages.
### Changed
- Improved scan scheduling throughput for large submission boards.
- Improved download state propagation throughput to reduce UI lag during multi-file runs.
### Fixed
- Fixed repeated heavy-pass work that could slow down larger Classroom pages.

## v1.5.3
### Summary
Introduced a new detection layer for flags and files to keep ownership mapping stable across complex Classroom layouts.
### Added
- Added a dedicated layer that correlates file cards and flag ownership with stricter DOM boundaries.
### Changed
- Updated detection order so file identity and flag identity resolve from the same scoped card context.
### Fixed
- Fixed edge cases where shared wrappers could cause mis-scoped file or flag decisions.

## v1.5.2
### Summary
A focused stabilization release delivering bug fixes and stronger security hardening for production classrooms.
### Added
- Added stricter URL validation and safer resolver guardrails for indirect Student Work links.
### Changed
- Improved defensive checks around download state transitions and message-bridge handling.
### Fixed
- Fixed download-state and mapping regressions that could impact reliability under mixed attachment sets.

## v1.5.1
### Summary
Expanded real-world support for the Student Work tap so teachers can download attached files and media directly from submissions.
### Added
- Introduced support for Student Work tap downloads based on real user needs — big thanks to @Ahmed for the valuable feedback 🙌
### Changed
- Aligned Student Work button rendering and Download All wiring with the stable classroom download flow.
### Fixed
- Fixed early Student Work gaps where some submissions were not reachable through the normal download UX.

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
