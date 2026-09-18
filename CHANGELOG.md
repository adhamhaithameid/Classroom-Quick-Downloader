# Changelog

This is the main engineering changelog for Classroom Quick Downloader.
It focuses on meaningful product, reliability, security, and architecture changes instead of raw commit history.

## Versioning Notes
- Current extension release line: `1.8.0`
- The `1.5.6`→`1.8.0` ladder below is the materialized internal history: every point version is anchored to the commit record and file-change dates of its window; patches never reach `.10` — the next minor takes over (`1.6.9` → `1.7.0`, `1.7.9` → `1.8.0`)
- Planned next engine milestone: post-1.6 acquisition strategy wiring (API download tier behind the consent gate)
- Pre-`1.0.0` bootstrap work is intentionally omitted from the user-facing release ledger

## [1.8.0] - 2026-09-17

### Summary
The no-dead-ends release: adversarial test program (outcome corpus run differentially against the pure machine AND production, fast-check property invariants, six new simulator failure shapes), the full interrupt taxonomy, the stall deadline, completion verification, the acquisition strategy chain, and the qa-08 resilience journey.

### Added
- Added the download-outcome corpus (`tests/acquire-corpus.test.ts`): 11 failure classes, each run twice — pure `nextAcquireState` and scripted production — which must agree.
- Added the fast-check property suite (`tests/acquire-properties.test.ts`): terminal absorption, sweep boundedness, deadline closure, effect discipline, resolver determinism, mapper totality.
- Added six simulator failure shapes (`srvfail-`, `signin-`, `resetmid-`, `slow-`, `zerobyte-`, `quota-`) with `destroyAfterSend` + `slowChunks` proxy support.
- Added the acquisition strategy chain as data (`direct` → `drive-auth` → reserved `api` tier, disabled per #398) and the chrome downloads BrowserPort adapter (`src/adapters/browser/`).
- Added the qa-08 resilience browser journey: transient 5xx, quota HTML and zero-byte files all reach a classified terminal with zero windows.

### Changed
- Interrupt taxonomy in `onChanged`: transient classes (`NETWORK_FAILED`, `SERVER_FAILED`, `NETWORK_TIMED_OUT`) retry once with a 2 s backoff; `USER_CANCELED` reports cancelled; permanent classes give specific guidance (disk full, file failed, crash, bad content, virus, blocked type).
- Browser-start failures retry once before the guided terminal.
- Completion now verifies the finished `DownloadItem` mime — Chromium can complete a 200 text/html Drive response with no Content-Disposition without ever firing `onDeterminingFilename`, which previously let error pages "succeed" as garbage files.
- Non-Drive HTML responses are refused with a sign-in message instead of being saved.

### Fixed
- Fixed Sheets export URLs being rejected as invalid; scoped content Drive patterns to Google hosts so doomed external buttons never appear.
- Fixed a residual finalized-pending race in the late-403 path.

### Security
- Kept the Google-only download surface; validator allowlist covers every legitimate attachment shape while external look-alikes stay blocked.

## [1.7.9] - 2026-09-17

### Summary
Firefox success honesty, the acquisition strategy chain as data, the BrowserPort chrome adapter, and the reserved API download tier design.

### Added
- Added the acquisition strategy chain (`src/strategies/acquire/strategy-chain.ts`): `direct` → `drive-auth` → reserved `api` tier with per-failure-class answering and a conformance test; the `api` tier is flag-gated off pending the #398 consent model (`docs/API_DOWNLOAD_TIER.md`).
- Added `src/adapters/browser/chrome-downloads-port.ts` — BrowserPort over the real `chrome.downloads` API; the port is no longer tests-only.

### Changed
- Firefox `onCreated` now correlates downloads only; success waits for the browser's own `complete` event, matching Chromium — a download that merely started is not a download that finished.

## [1.7.8] - 2026-09-17

### Summary
The stall deadline and the HTML response guards.

### Added
- Added the 150-second stall deadline (`PENDING_DOWNLOAD_TTL_MS` companion `PENDING_DEADLINE_MS` in `state.ts`): the registry fires an expiry hook that cancels the browser download, reports "This download timed out. Try again.", and cleans up — no button sits in "trying" until the silent TTL reap.

### Fixed
- Fixed non-Drive HTML responses being saved as garbage: both the Chromium filename hook and the Firefox mime guard now refuse them with "This link requires signing in…" on every host, not just Drive.
- Fixed the URL layer: the validator accepts Sheets exports, and content Drive patterns are scoped to Google hosts so external `/file/d/` links no longer produce download buttons that could only dead-end.

## [1.7.7] - 2026-09-17

### Summary
The interrupt taxonomy: every failure class classified, transient failures retried once, the user's own cancellations respected.

### Added
- Added classified handling for every `chrome.downloads` interrupt: transient (`NETWORK_FAILED`, `SERVER_FAILED`, `NETWORK_TIMED_OUT`) retry once in place with a 2 s backoff; `USER_CANCELED` reports cancelled — never an error; permanent classes get specific actionable guidance (disk full, file failed, crash, bad content, virus-infected, blocked type).
- Browser-start refusals retry once, then settle with "Browser blocked the download — check site permissions and try again."

## [1.7.6] - 2026-09-17

### Summary
The adversarial test program: the download-outcome corpus, the scripted production harness, and the differential contract between the pure machine and the real flow.

### Added
- Added the download-outcome corpus (`tests/acquire-corpus.test.ts`): 11 failure classes (validator reject, sweep exhaustion, mid-sweep success, transient retry-then-succeed, permanent fail-fast, storage full, user cancel, stall→timeout, browser-start retry, non-Drive HTML, late-403) each encoded as injected events + expected terminal outcome + expected message class.
- Added the scripted flow harness (`tests/helpers/background-flow.ts`): the real background listeners over a scriptable browser host (`id` / `lastError` / `never` per attempt).
- Every corpus case runs twice — the pure state machine AND production — and they must agree; a divergence is a defect by definition.

## [1.7.5] - 2026-09-14

### Summary
Property-based testing and the adversarial simulator vocabulary.

### Added
- Added the fast-check property suite (`tests/acquire-properties.test.ts`): terminal states absorb every event, the authuser sweep is monotonic and bounded, the deadline closes every non-terminal phase, settle effects are disciplined, and the simulator resolver plus the outcome mapper are deterministic/total.
- Added six adversarial simulator failure shapes: `srvfail-` (503), `signin-` (redirect), `resetmid-` (mid-stream destroy), `slow-` (chunked trickle), `zerobyte-` (empty success), `quota-` (HTML quota page) — with `destroyAfterSend` and `slowChunks` transport support in the MITM proxy.

## [1.7.4] - 2026-09-14

### Summary
S10 groundwork: the shared DOM port multiplexes all observation over one platform MutationObserver, and the V2 stack observes through it.

### Changed
- `src/adapters/dom/mutation-observer-dom-port.ts` multiplexes subscriptions over one platform observer; the V2 engine, route classifier and orchestrator observe through the port (S10 groundwork for gate G3 — the V1 strip itself remains gated on a clean store release).

## [1.7.3] - 2026-09-14

### Summary
Download All fully stabilized and the QA runbook reached full automated coverage.

### Fixed
- Fixed the Download All hang root cause: the aggregation loop seeded `inProgress` from the previous pass like the sticky flags, making in-progress permanent once buttons left the loading state — groups could never reach `allCompleted`. `inProgress` is now live, class-derived state.
- Fixed group rendering in background tabs: requestAnimationFrame is suspended in occluded tabs, so `scheduleRefresh` now flushes on a 250 ms timer when the document is hidden.
- Fixed the last three harness gaps in the QA journeys: the anchored-popup stub (synthetic active Classroom tab), the simulator submissions-container contract (`/g/tg/` viewer anchors; a function-as-attribute bug that dropped `data-submission-attachment-id` entirely), and journey corrections (popstate target, duplicate load-more id, delayed-post timer race).

## [1.7.2] - 2026-09-14

### Summary
Gate G2 complete: the S6 bridge (typed BridgePort, page relay, worker download service) and the Engine Mode popup control shipped; S5 closed.

### Added
- Added the Engine Mode popup control (#684, `cqdV2Mode`): a separate settings section (Legacy / New, API hidden until the OAuth phase), live switching via the mode controller, one-click rollback.
- Added the worker-side bridge download service: bridge requests drive the existing download state machine and terminal statuses settle each request exactly once (new `setDownloadStatusListener` seam firing before the tab guard, so no-tab bridge requests settle).

### Changed
- The page bus's `download:requested`/`download:settled` topics cross the BridgePort (`bridge-relay.ts`); decision topics flow through the S5 role bus.

## [1.7.1] - 2026-09-13

### Summary
S5 complete: the four roles (Detect/Compute/Render/Harden) wrap the existing engines verbatim behind the page event bus, with zero behavior change proven by the full suite.

### Added
- Added the page event bus topics (`route:changed`, `post:scanned`, `file:discovered`, `decision:flags`, `decision:placement`, `render:applied`, `correction:needed`, `budget:throttle`) published by the roles after each scan cycle.
- Added the architecture fitness rule banning role-to-role imports.

## [1.7.0] - 2026-09-13

### Summary
The zero-tab contract completed and verified in real browsers.

### Changed
- The bypass-tab mechanism was removed entirely (entry scripts, registry index, `CQD_BYPASS_SUCCESS`/`CQD_403_SEEN`/consent/register handlers, cancel-flow tab removal): `chrome.tabs.create` no longer exists anywhere in background code — verified in all three built bundles.
- Forbidden failures run the full account bound: an early-exit on identical failure reasons was deliberately rejected because identical reasons cannot distinguish "no account has access" from "a later account holds access".

### Fixed
- Fixed a late 403 from a still-bound tab resurrecting the cycle on an already-successful pending (finalized guard, covered by a flow test written red-first).
- Added the `authlocked-` simulator fixture (403 unless `authuser=1`) proving 403 → invisible sweep → bytes → button success end-to-end in qa-06.

## [1.6.9] - 2026-09-13

### Summary
The account-cycling fix for #537/#547 and the endpoint switch.

### Changed
- Drive downloads target `drive.usercontent.google.com/download?...&confirm=t` through the shared `drive-endpoint` module consumed by both the content URL layer and the background normalizer — the byte-serving endpoint Drive's own "Download anyway" link lands on.
- Forbidden failures cycle the signed-in accounts on both browsers (Firefox no longer terminal-fails on the first 403); a forbidden-family download interrupt (`SERVER_FORBIDDEN`/`ACCESS_DENIED`) now retries the next account instead of terminal-failing.
- Download All groups book failures stickily (`file.failed` survives the per-file auto-reset) so mixed groups settle.

### Fixed
- Fixed #537 (zen/Firefox, severity 5: "never ever works") and #547 (Brave: "download is unavailable") — downloads that start but fail now sweep accounts invisibly first.

## [1.6.8] - 2026-09-13

### Summary
The Manual-QA Replay pipeline completed: real-browser journeys for every runbook check, real download verification, the generated runbook report, and the gated live-Classroom canary.

### Added
- Journeys qa-01…qa-06 drive the built extension over the deterministic simulator: per-file downloads verify real bytes over TLS plus served Content-Disposition, the Drive gated-file flow runs the interstitial click-through, and the Download All, flags, popup and navigation flows are asserted end-to-end.
- Added the artifact-based report generator (`qa-artifacts/report.md` rebuilt from per-check `result.json` files only) and the `QA_LIVE_CLASSROOM=1`-gated read-only production canary.

## [1.6.7] - 2026-09-12

### Summary
The Manual-QA Replay pipeline foundation: a deterministic Classroom-shaped simulator served over a local MITM proxy, because route interception cannot feed Chromium's download manager — real downloads need real sockets.

### Added
- Added the typed scenario model, page builder, SPA router and Drive/Docs byte servers (`tests/simulator/`), a test-only CA with per-origin certificates, and the simulator-sanity journey proving the served surface under the real `classroom.google.com` origin.

## [1.6.6] - 2026-09-12

### Summary
Detection and naming hardening: the naming core extracted, the download registry rebuilt on one authoritative map, and four more labeled defects closed.

### Added
- Added the locale-driven `TypeLabelRegistry` with anchored, extension-corroborated label stripping (`core/name/{derive,strip,sanitize,verify}`), fixing localized type labels leaking into filenames (#541).
- Added the canonical action-button pattern table (D3) shared by keyword scoring, the smart detector and the exclusion engine.

### Fixed
- Fixed the four-map download registry races with one authoritative registry and indexes-over-truth (D11).
- Fixed V2-primary rendering through the render strategy (D8) and the docs/code default-mode mismatch (D9).
- Fixed locale-driven type labels (D10) and Google Sheets attachments not receiving download buttons (#546).

## [1.6.5] - 2026-09-12

### Summary
Corpus-first fixes for the second defect wave: count corroboration, chip-gated text, the canonical exclusion table, whole-token exclusions, and Unicode month keys.

### Fixed
- Fixed comment-count false positives from dates in count shells via a corroboration floor (D12) and chip-gated container text (D13).
- Fixed the canonical action-button exclusion boundary and count-ceiling edge (D3/D4).
- Fixed V2 text exclusion rules still substring-matching — moved to the shared whole-token matcher (D14).
- Fixed `parseUnicodeDate` month keys matching substrings (D15).

## [1.6.4] - 2026-09-11

### Summary
Whole-token matching for exclusion and phrase rules (D6), with its corpus cases written red-first.

### Fixed
- Fixed substring false positives in exclusion matching: the shared matcher operates on whole tokens with an attribute-context phrase policy (D6).

## [1.6.3] - 2026-09-10

### Summary
Detection defenses: the numeral layer sanity-checks the DOM truth it trusts, and the D6 false-positive corpus was captured red.

### Fixed
- Fixed blind trust in the L0 DOM signal — the numeral layer sanity-checks it (D5).
- Added the D6 false-positive corpus cases (red) pinning the substring-matching defect.

## [1.6.2] - 2026-09-10

### Summary
First labeled-defect wave: Armenian keyword coverage, token-exact word numbers, and Arabic tashkeel folding.

### Fixed
- Fixed Armenian keyword coverage (D1), substring word-number matching (D2), and Arabic tashkeel folding in keyword matching (D7).
- Added an own-property guard on the word-number token lookup.

## [1.6.1] - 2026-09-10

### Summary
The Engine V4 foundation (gates G0/G1): a labeled accuracy corpus with ratcheting floors, typed contracts + event bus + pure acquisition state machine, the extracted pure detection core, and hardened release gates.

### Added
- Added the accuracy corpus and gate: labeled expectations across locales, exact-match C1 with a ratcheting `knownFailures` list, statistical floors C2 (ADR-0008).
- Added `contracts/` (ports, topics), `bus/event-bus.ts` with subscriber isolation, the pure `core/acquire/state-machine.ts` (bounded authuser rotation as data, forced-deadline timeout, every path settles), and the architecture fitness suite (ADR-0007).
- Added hardened e2e, accuracy, and release gates to CI (#762).

### Changed
- Extracted the detection core into pure modules: `core/detect/{normalize,numerals,matching,action-buttons,ceilings}`.

## [1.6.0] - 2026-09-10

### Summary
The Engine V4 foundation (gates G0/G1): a labeled accuracy corpus with ratcheting floors, typed contracts + event bus + pure acquisition state machine, the extracted pure detection core — plus the security-audit and gate-hardening roll-up that closed the 1.5 line.

### Added
- Added the accuracy corpus and gate: labeled expectations across locales, exact-match C1 with a ratcheting `knownFailures` list, statistical floors C2 (ADR-0008).
- Added `contracts/` (ports, topics), `bus/event-bus.ts` with subscriber isolation, the pure `core/acquire/state-machine.ts` (bounded authuser rotation as data, forced-deadline timeout, every path settles), and the architecture fitness suite (ADR-0007).
- Added hardened e2e, accuracy, and release gates to CI (#762), including the security audit, dependency updates and CI hardening roll-in (#665).
- Added `crypto.randomUUID()`-based secure identifiers and student-work trust-boundary coverage.

### Changed
- Extracted the detection core into pure modules: `core/detect/{normalize,numerals,matching,action-buttons,ceilings}`.
- Adopted the wxt 0.21 strict tsconfig (`verbatimModuleSyntax`, `noImplicitOverride`); hardened index access in detection keyword lookups.

### Fixed
- Fixed the `pendingByUrl` race condition — concurrent same-URL downloads are now tracked independently (#672).
- Removed the unused `tabs` permission from the manifest (least privilege).

## [1.5.9] - 2026-06-10

### Summary
Consolidated low-risk fixes from reviewed draft PRs and repository hygiene.

### Changed
- Merged the consolidated safe draft-PR fix sets (#605, #606) and repo path/hygiene cleanups.

## [1.5.8] - 2026-05-26

### Summary
Accessibility and performance: popup controls fully labeled and DOM traversal optimized.

### Added
- Added explicit accessibility labels to popup controls (#558) and share-panel accessibility linkage (#557).

### Changed
- Optimized DOM traversal with combined CSS selectors (#539) — fewer passes over busy Classroom pages.

## [1.5.7] - 2026-04-04

### Summary
Security hardening of the debug surface and a toolchain upgrade.

### Fixed
- Hardened debug panel rendering against XSS: runtime values are escaped before HTML injection.

### Changed
- Upgraded the workspace toolchain and test stack.

## [1.5.6] - 2026-03-20

### Summary
Cryptography, accessibility and test coverage for Student Work resolution.

### Changed
- Replaced `Math.random` identifiers with Web Crypto (`crypto.randomUUID`) for secure IDs.
- Updated all workspace dependencies to latest.

### Fixed
- Added missing aria-labels and synced titles for icon-only buttons.

### Added
- Added student-work test coverage: runtime relay flow, channel timeout cleanup, cryptographic nonce format, and trust-boundary documentation.

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
