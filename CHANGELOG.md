# Changelog

This is the main engineering changelog for Classroom Quick Downloader.
It focuses on meaningful product, reliability, security, and architecture changes instead of raw commit history.

## Versioning Notes
- Current extension release line: `1.6.19`
- Planned next engine milestone: post-1.6 acquisition strategy wiring (API download tier behind the consent gate)
- Pre-`1.0.0` bootstrap work is intentionally omitted from the user-facing release ledger

## [1.6.19] - 2026-09-17

### Summary
Major download-engine overhaul: zero-window downloads with invisible multi-account fallback, a complete failure taxonomy with actionable messages, stall deadlines, and the Engine Mode switch. Every download either succeeds or tells the user exactly what to do next.

### Added
- Added invisible multi-account fallback: forbidden Drive files now cycle the signed-in accounts (bounded sweep) instead of failing on the first account.
- Added the Engine Mode popup control (`cqdV2Mode`, Legacy / New, live switch, one-click rollback) behind the G2 gate.
- Added the 150-second stall deadline (`PENDING_DEADLINE_MS`): stalled downloads cancel and report a timeout instead of hanging until the silent TTL reap.
- Added one bounded in-place retry with backoff for transient interrupts (`NETWORK_FAILED`, `SERVER_FAILED`, `NETWORK_TIMED_OUT`).
- Added the classified failure-message taxonomy: USER_CANCELED surfaces as cancelled; FILE_FAILED / STORAGE_FULL / CRASH / SERVER_BAD_CONTENT / FILE_VIRUS_INFECTED / FILE_BLOCKED each get specific guidance.
- Added the zero-tab acquisition contract across both browsers: `chrome.tabs.create` is gone from the background flow (verified in bundles and by qa journeys).
- Added the acquisition strategy chain as data (`direct` → `drive-auth` → reserved `api` tier, flag-gated off per #398) with the BrowserPort chrome adapter.
- Added an adversarial download-outcome corpus (11 cases, run differentially against the pure acquire state machine AND production), a fast-check property suite over the machine (terminal absorption, sweep boundedness, deadline closure), and the qa-08 resilience browser journey.

### Changed
- Drive downloads target `drive.usercontent.google.com` byte-serving endpoint directly (shared `drive-endpoint` module): no interstitial hop, faster transfers.
- Firefox `onCreated` correlates downloads only; success reports on `onChanged` complete like Chromium (no phantom successes).
- Content Drive-URL patterns are scoped to Google hosts; external `/file/d/` links no longer render doomed buttons.
- `onChanged` completion verifies the finished `DownloadItem` mime before reporting success.

### Fixed
- Fixed the Download All hang family: sticky failure bookkeeping plus live (non-seeded) in-progress state so groups always settle (success / partial / error).
- Fixed the visible "403 Access Forbidden" bypass-tab window that never closed (error pages cannot run the reporting script); the bypass-tab mechanism is fully removed.
- Fixed Drive error/quota HTML pages saving as fake `.html` files — detected at the filename hook or at completion, erased, and handled as access errors.
- Fixed non-Drive HTML responses saving as garbage — now refused with a sign-in message.
- Fixed Sheets export URLs being rejected as invalid by the download validator.
- Fixed background-tab rendering of Download All groups (requestAnimationFrame suspension) via a hidden-state timer flush.

### Security
- Hardened the download URL allowlist (all legitimate Google attachment shapes, external look-alikes still blocked) and kept scheme checks strict.
- Kept the zero-window, zero-third-party-network download surface: the extension still talks only to Google hosts.

## [1.6.15] - 2026-09-14

### Summary
Download All stabilization: the two remaining root causes of the hang family fixed, hidden-tab rendering repaired, and the QA runbook reached full automated coverage.

### Changed
- `download_all` groups flush updates on a 250 ms timer when `document.visibilityState === 'hidden'` — requestAnimationFrame is suspended in occluded tabs, which previously froze group progress.
- Automated Manual-QA Replay reached full runbook coverage: qa-04 via the anchored-popup stub (synthetic active Classroom tab), qa-05 via the simulator submissions-container contract fixes (`/g/tg/` viewer anchors, function-as-attribute bug) and journey corrections (popstate target, duplicate load-more id, delayed-post timer race).

### Fixed
- Fixed the Download All hang root cause: the aggregation loop seeded `inProgress` from the previous pass like the sticky flags, making in-progress permanent once buttons left the loading state — groups could never reach `allCompleted`. `inProgress` is now live, class-derived state (`download_all.content.ts`).
- Fixed background-tab group rendering (see above) — progress and terminal states now always render.

## [1.6.10] - 2026-09-13

### Summary
Download reliability milestone: invisible multi-account fallback, the zero-window byte-serving endpoint, bypass-tab removal, sticky group failures, the S5 role bus, and the S6 bridge + Engine Mode UI (gate G2).

### Added
- Added the signed-in-account sweep for forbidden Drive downloads (#537/#547): bounded authuser 0–9 rotation on both browsers, terminal `AUTH_ALL_FAILED` only after exhaustion; success mid-sweep stops the loop.
- Added the Engine Mode popup control (#684, `cqdV2Mode`) with live switching and one-click rollback; decision recorded as a separate settings control, API option hidden until the OAuth phase.
- Added the page event bus (`route:changed`, `post:scanned`, `file:discovered`, `decision:*`, `render:applied`, `correction:needed`, `budget:throttle`) with the four roles wrapping existing engines verbatim (S5), and the typed BridgePort with page relay + worker download service (S6).
- Added the Firefox `onCreated` mime guard: HTML "downloads" are cancelled+erased and treated as forbidden-family failures (Firefox has no `onDeterminingFilename`).

### Changed
- Drive downloads target `drive.usercontent.google.com/download?...&confirm=t` through the shared `drive-endpoint` module — the byte-serving endpoint, no interstitial hop.
- The bypass-tab mechanism was removed entirely (entry scripts, registry index, message handlers): `chrome.tabs.create` no longer exists in background code (zero-tab contract, bundle-verified).
- Forbidden failures run the full account bound (an early-exit on identical reasons was rejected: identical reasons cannot distinguish "no account has access" from "a later account holds access").

### Fixed
- Fixed the visible "403 Access Forbidden" bypass-tab window that never closed (error pages cannot run the reporting script; tabs hung until the 10-minute TTL).
- Fixed Firefox terminal-failing on the first 403 while Chromium cycled accounts.
- Fixed Download All sticky failure bookkeeping (`file.failed` survives per-file auto-reset) so mixed groups settle.

## [1.6.5] - 2026-09-12

### Summary
Accuracy blitz and the automated QA program: fifteen labeled defects fixed each with corpus evidence, the naming core extracted, and the Manual-QA Replay pipeline (real-browser journeys + deterministic simulator + gated canary) landed.

### Added
- Added the locale-driven `TypeLabelRegistry` with anchored, extension-corroborated label stripping (`core/name/`), fixing localized type labels leaking into filenames (#541).
- Added the Manual-QA Replay pipeline: a deterministic Classroom-shaped simulator behind a local MITM proxy (real sockets for real downloads), journeys qa-01…qa-07, artifact tree + report generator, and the gated read-only live-Classroom canary (`QA_LIVE_CLASSROOM=1`).
- Added the canonical action-button pattern table (D3) shared by all three consumers.

### Fixed
- Fixed comment-count false positives from dates in count shells (D13), verdict loss on class drift via the corroboration floor (D12), L0 numeral sanity (D5), Armenian keywords + token-exact word numbers + tashkeel folding (D1/D2/D7), whole-token matching for exclusions and phrases (D6/D14), Unicode month keys (D15), locale type labels (D10).
- Fixed V2-primary rendering through the render strategy (D8) and the docs/code default-mode mismatch (D9).
- Fixed the four-map download registry races with one authoritative registry and indexes-over-truth (D11).
- Fixed Google Sheets attachments receiving download buttons (#546), including assignment-detail placement.

## [1.6.0] - 2026-09-10

### Summary
The Engine V4 foundation (gates G0/G1): a labeled accuracy corpus with ratcheting floors, typed contracts + event bus + pure acquisition state machine, the extracted pure detection core, and hardened release gates.

### Added
- Added the accuracy corpus and gate: labeled expectations across locales, exact-match C1 with a ratcheting `knownFailures` list, statistical floors C2 (ADR-0008).
- Added `contracts/` (ports, topics), `bus/event-bus.ts` with subscriber isolation, the pure `core/acquire/state-machine.ts` (bounded authuser rotation as data, forced-deadline timeout, every path settles), and the architecture fitness suite (ADR-0007).
- Added hardened e2e, accuracy, and release gates to CI (#762).

### Changed
- Extracted the detection core into pure modules: `core/detect/{normalize,numerals,matching,action-buttons,ceilings}`.
## [Unreleased]

### Summary
Student Work stabilization update focused on silent resolution and strict per-submission file mapping.

### Added
- Added deploy-time search indexing automation for the website:
  - Bing submission via IndexNow (`tools/submit-search-indexing.mjs`)
  - Google Search Console sitemap submission when service-account credentials are configured
- Added website-level IndexNow key endpoint at `/indexnow-key.txt` for search-engine ownership proof.
- Added configurable website verification metadata for Google and Bing via public environment variables.
- Added an indexable HTML sitemap route at `/site-map` and linked it globally in the website footer to strengthen internal crawl paths.
- Added dedicated indexable video pages:
  - `/watch/cqd-demo`
  - `/watch/manual-vs-cqd`
- Added `VideoObject` metadata + sitemap video entries for both website demo videos (`solution.mp4`, `problem.mp4`).
- Added richer video sitemap metadata (`publication_date`, `duration`, `family_friendly`) for both indexed demo videos.

### Changed
- Removed popup-based Student Work resolver fallback so resolution is fully silent.
- Increased default Student Work resolver timeout to reduce premature timeout failures.
- Improved website SEO metadata quality for richer search snippets and broader multi-engine indexing coverage.
- Updated indexing automation logging to explicitly capture DuckDuckGo visibility guidance via Bing indexing health.
- Replaced the favicon pack with a higher-clarity icon set (`16/32/48/192/512`, `apple-touch-icon`, `.ico`) optimized for SERP readability.
- Added homepage crawl-path links to the new video pages to improve discoverability and indexing signals.
- Added a homepage `WebPage` JSON-LD node and richer `VideoObject` fields (`duration`, `datePublished`) to strengthen search feature extraction.

### Fixed
- Fixed Student Work flows that could land in error state before bridge resolution completed.
- Fixed edge-case wrong/repeated mapping risks by tightening strict hinted extraction and candidate selection.
- Fixed popup icon-only controls with mismatched `title` and `aria-label` attributes.

### Security
- Hardened debug panel rendering by escaping runtime values before HTML injection.
- Replaced Student Work request ID and nonce generation with `crypto.randomUUID()`.

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
