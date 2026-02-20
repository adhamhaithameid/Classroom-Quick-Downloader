/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. */
export const WEBSITE_MANUAL_CHANGELOG = {
  "generatedAt": 1789611843976,
  "source": "manual",
  "entries": [
    {
      "id": "manual-1.8.0-1",
      "version": "1.8.0",
      "title": "Release 1.8.0",
      "summary": "The no-dead-ends release: every download either succeeds or tells you exactly what to do next — with automatic retries, honest timeouts, and an adversarial test program proving it.",
      "highlights": [
        "Added automatic retry with backoff for temporary network and server failures.",
        "Added a 150-second download deadline: stalled downloads report \"This download timed out. Try again.\" instead of hanging forever.",
        "Added specific failure messages for every error class: disk full, file unavailable, browser blocked, sign-in required, virus-blocked, and more.",
        "Downloads now verify what actually landed — Drive error and quota pages are detected and handled, never saved as fake files.",
        "Fixed Sheets attachment downloads being rejected as invalid URLs."
      ],
      "added": [
        "Added automatic retry with backoff for temporary network and server failures.",
        "Added a 150-second download deadline: stalled downloads report \"This download timed out. Try again.\" instead of hanging forever.",
        "Added specific failure messages for every error class: disk full, file unavailable, browser blocked, sign-in required, virus-blocked, and more."
      ],
      "changed": [
        "Downloads now verify what actually landed — Drive error and quota pages are detected and handled, never saved as fake files."
      ],
      "fixed": [
        "Fixed Sheets attachment downloads being rejected as invalid URLs."
      ],
      "releasedAtUtc": 1789611843974
    },
    {
      "id": "manual-1.7.9-2",
      "version": "1.7.9",
      "title": "Release 1.7.9",
      "summary": "Firefox download reporting is now fully honest: success is only reported when the browser confirms the file finished.",
      "highlights": [
        "Firefox downloads report success only on actual completion — no more phantom successes that later vanish."
      ],
      "added": [],
      "changed": [
        "Firefox downloads report success only on actual completion — no more phantom successes that later vanish."
      ],
      "fixed": [],
      "releasedAtUtc": 1789525443974
    },
    {
      "id": "manual-1.7.8-3",
      "version": "1.7.8",
      "title": "Release 1.7.8",
      "summary": "Stalled downloads now resolve honestly, and sign-in/error pages are never saved as fake downloads.",
      "highlights": [
        "Added a hard timeout: a stalled download cancels itself and reports \"This download timed out. Try again.\" instead of hanging.",
        "Fixed sign-in and error pages being saved as fake download files — they are now detected and reported as sign-in errors."
      ],
      "added": [
        "Added a hard timeout: a stalled download cancels itself and reports \"This download timed out. Try again.\" instead of hanging."
      ],
      "changed": [],
      "fixed": [
        "Fixed sign-in and error pages being saved as fake download files — they are now detected and reported as sign-in errors."
      ],
      "releasedAtUtc": 1789439043974
    },
    {
      "id": "manual-1.7.7-4",
      "version": "1.7.7",
      "title": "Release 1.7.7",
      "summary": "Every download failure now has a classified, actionable outcome.",
      "highlights": [
        "Added automatic retry for temporary network and server failures.",
        "Added specific messages for permanent failures: disk full, file unavailable, browser crashed, file blocked, and more.",
        "Fixed cancellations made from the browser's own download panel showing as errors — they now correctly show as cancelled."
      ],
      "added": [
        "Added automatic retry for temporary network and server failures.",
        "Added specific messages for permanent failures: disk full, file unavailable, browser crashed, file blocked, and more."
      ],
      "changed": [],
      "fixed": [
        "Fixed cancellations made from the browser's own download panel showing as errors — they now correctly show as cancelled."
      ],
      "releasedAtUtc": 1789352643974
    },
    {
      "id": "manual-1.7.6-5",
      "version": "1.7.6",
      "title": "Release 1.7.6",
      "summary": "Internal hardening: a corpus of eleven real-world download failure scenarios now runs against both the engine's brain and its implementation, and they must agree on every outcome.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1789266243974
    },
    {
      "id": "manual-1.7.5-6",
      "version": "1.7.5",
      "title": "Release 1.7.5",
      "summary": "The test simulator learned six new real-world failure shapes — server errors, sign-in redirects, mid-download connection drops, slow streams, empty files and quota pages — so the engine can be verified against them.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1789179843974
    },
    {
      "id": "manual-1.7.4-7",
      "version": "1.7.4",
      "title": "Release 1.7.4",
      "summary": "Rendering groundwork for the next engine generation: all page observation now flows through one shared, throttled observer.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1789093443974
    },
    {
      "id": "manual-1.7.3-8",
      "version": "1.7.3",
      "title": "Release 1.7.3",
      "summary": "Download All is now fully stabilized and the automated QA suite covers the entire manual runbook.",
      "highlights": [
        "Fixed the root cause of Download All groups hanging on \"Downloading…\" forever.",
        "Fixed Download All progress not updating when the Classroom tab was in the background."
      ],
      "added": [],
      "changed": [],
      "fixed": [
        "Fixed the root cause of Download All groups hanging on \"Downloading…\" forever.",
        "Fixed Download All progress not updating when the Classroom tab was in the background."
      ],
      "releasedAtUtc": 1789007043974
    },
    {
      "id": "manual-1.7.2-9",
      "version": "1.7.2",
      "title": "Release 1.7.2",
      "summary": "The Engine Mode switch shipped in popup settings (Legacy / New) with live switching and one-click rollback, and page detection is now wired to the download engine through one typed bridge.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1788920643974
    },
    {
      "id": "manual-1.7.1-10",
      "version": "1.7.1",
      "title": "Release 1.7.1",
      "summary": "The engine's internals now communicate through a typed event bus — the architectural groundwork that lets every later change be measured and rolled back independently.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1788834243974
    },
    {
      "id": "manual-1.7.0-11",
      "version": "1.7.0",
      "title": "Release 1.7.0",
      "summary": "Zero-window downloads verified end-to-end: the old background-tab workaround is fully removed, and a locked test file proves the invisible account fallback completes real downloads.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1788747843974
    },
    {
      "id": "manual-1.6.9-12",
      "version": "1.6.9",
      "title": "Release 1.6.9",
      "summary": "The fix for the most-reported download bug: files that start but fail now quietly try your other signed-in accounts, and downloads go straight through Google's direct file endpoint.",
      "highlights": [
        "Fixed \"files start but fail\" reports on Firefox-family browsers (zen) and Brave.",
        "Fixed Download All groups with one broken file hanging instead of settling."
      ],
      "added": [],
      "changed": [],
      "fixed": [
        "Fixed \"files start but fail\" reports on Firefox-family browsers (zen) and Brave.",
        "Fixed Download All groups with one broken file hanging instead of settling."
      ],
      "releasedAtUtc": 1788661443974
    },
    {
      "id": "manual-1.6.8-13",
      "version": "1.6.8",
      "title": "Release 1.6.8",
      "summary": "The automated QA pipeline now replays the entire manual test runbook in real browsers — including real downloads verified byte-for-byte.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1788575043974
    },
    {
      "id": "manual-1.6.7-14",
      "version": "1.6.7",
      "title": "Release 1.6.7",
      "summary": "Foundation for the automated QA program: a local, deterministic Google Classroom simulator that serves real downloadable files under the real Classroom origins.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1788488643974
    },
    {
      "id": "manual-1.6.6-15",
      "version": "1.6.6",
      "title": "Release 1.6.6",
      "summary": "Detection and naming hardening: localized type labels no longer leak into filenames, download state races are fixed, and Sheets attachments get their buttons back.",
      "highlights": [
        "Fixed localized type labels (like \"Tömörített archívum\") leaking into downloaded filenames.",
        "Fixed download state races where concurrent downloads of the same file could cross wires.",
        "Fixed Google Sheets attachments not getting download buttons."
      ],
      "added": [],
      "changed": [],
      "fixed": [
        "Fixed localized type labels (like \"Tömörített archívum\") leaking into downloaded filenames.",
        "Fixed download state races where concurrent downloads of the same file could cross wires.",
        "Fixed Google Sheets attachments not getting download buttons."
      ],
      "releasedAtUtc": 1788402243974
    },
    {
      "id": "manual-1.6.5-16",
      "version": "1.6.5",
      "title": "Release 1.6.5",
      "summary": "More detection accuracy fixes: comment counts survive markup drift, exclusions match whole tokens, and localized dates parse correctly.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1788315843974
    },
    {
      "id": "manual-1.6.4-17",
      "version": "1.6.4",
      "title": "Release 1.6.4",
      "summary": "Exclusion matching now operates on whole words, eliminating a family of false-positive detections.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1788229443974
    },
    {
      "id": "manual-1.6.3-18",
      "version": "1.6.3",
      "title": "Release 1.6.3",
      "summary": "Detection defenses: number extraction now sanity-checks the page before trusting it.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1788143043974
    },
    {
      "id": "manual-1.6.2-19",
      "version": "1.6.2",
      "title": "Release 1.6.2",
      "summary": "Detection accuracy across scripts: Armenian keywords, exact word-number matching, and Arabic diacritic folding fixed.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1788056643974
    },
    {
      "id": "manual-1.6.1-20",
      "version": "1.6.1",
      "title": "Release 1.6.1",
      "summary": "The Engine V4 foundation: a measurable accuracy standard for the detection engine, a pure download state machine, and hardened release gates. Everything after this version is measured against a fixed corpus.",
      "highlights": [
        "Added the accuracy corpus and gates: detection decisions are held to labeled expectations across locales, with floors that may only move up.",
        "Added typed contracts, an event bus, and a pure acquisition state machine with bounded account rotation and forced deadlines."
      ],
      "added": [
        "Added the accuracy corpus and gates: detection decisions are held to labeled expectations across locales, with floors that may only move up.",
        "Added typed contracts, an event bus, and a pure acquisition state machine with bounded account rotation and forced deadlines."
      ],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1787970243974
    },
    {
      "id": "manual-1.6.0-21",
      "version": "1.6.0",
      "title": "Release 1.6.0",
      "summary": "The Engine V4 foundation: a measurable accuracy standard for the detection engine, a pure download state machine, and hardened release gates — plus the security-audit roll-up that closed the 1.5 line. Everything after this version is measured against a fixed corpus.",
      "highlights": [
        "Added the accuracy corpus and gates: detection decisions are held to labeled expectations across locales, with floors that may only move up.",
        "Added typed contracts, an event bus, and a pure acquisition state machine with bounded account rotation and forced deadlines.",
        "Added cryptographically secure download identifiers and hardened release gates.",
        "Fixed a race condition where concurrent downloads of the same file could cross wires.",
        "Removed an unused browser permission (least privilege)."
      ],
      "added": [
        "Added the accuracy corpus and gates: detection decisions are held to labeled expectations across locales, with floors that may only move up.",
        "Added typed contracts, an event bus, and a pure acquisition state machine with bounded account rotation and forced deadlines.",
        "Added cryptographically secure download identifiers and hardened release gates."
      ],
      "changed": [],
      "fixed": [
        "Fixed a race condition where concurrent downloads of the same file could cross wires.",
        "Removed an unused browser permission (least privilege)."
      ],
      "releasedAtUtc": 1787883843974
    },
    {
      "id": "manual-1.5.9-22",
      "version": "1.5.9",
      "title": "Release 1.5.9",
      "summary": "A batch of reviewed, low-risk fixes and cleanups rolled into one stable release.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1787797443974
    },
    {
      "id": "manual-1.5.8-23",
      "version": "1.5.8",
      "title": "Release 1.5.8",
      "summary": "Faster page scanning and a fully accessible popup.",
      "highlights": [
        "Optimized DOM traversal with combined CSS selectors for faster scans on busy pages."
      ],
      "added": [],
      "changed": [
        "Optimized DOM traversal with combined CSS selectors for faster scans on busy pages."
      ],
      "fixed": [],
      "releasedAtUtc": 1787711043974
    },
    {
      "id": "manual-1.5.7-24",
      "version": "1.5.7",
      "title": "Release 1.5.7",
      "summary": "A security-hardening release: the developer debug surface now escapes all runtime values before rendering.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1787624643974
    },
    {
      "id": "manual-1.5.6-25",
      "version": "1.5.6",
      "title": "Release 1.5.6",
      "summary": "A security-and-accessibility release: cryptographically secure download identifiers, fully labeled controls, and deeper Student Work test coverage.",
      "highlights": [],
      "added": [],
      "changed": [],
      "fixed": [],
      "releasedAtUtc": 1787538243974
    },
    {
      "id": "manual-1.5.5-26",
      "version": "1.5.5",
      "title": "Release 1.5.5",
      "summary": "A leaner packaging release focused on reducing extension size while preserving the same classroom behavior.",
      "highlights": [
        "Added tighter packaging checks for Student Work and core download modules.",
        "Reduced bundled payload by trimming unused runtime paths and release artifacts.",
        "Fixed extension package bloat that increased install and update cost on slower networks."
      ],
      "added": [
        "Added tighter packaging checks for Student Work and core download modules."
      ],
      "changed": [
        "Reduced bundled payload by trimming unused runtime paths and release artifacts."
      ],
      "fixed": [
        "Fixed extension package bloat that increased install and update cost on slower networks."
      ],
      "releasedAtUtc": 1787451843974
    },
    {
      "id": "manual-1.5.4-27",
      "version": "1.5.4",
      "title": "Release 1.5.4",
      "summary": "A performance-focused release with two measurable speed upgrades in scan and download orchestration paths.",
      "highlights": [
        "Added lightweight scan throttling safeguards for busy Student Work pages.",
        "Improved scan scheduling throughput for large submission boards.",
        "Improved download state propagation throughput to reduce UI lag during multi-file runs.",
        "Fixed repeated heavy-pass work that could slow down larger Classroom pages."
      ],
      "added": [
        "Added lightweight scan throttling safeguards for busy Student Work pages."
      ],
      "changed": [
        "Improved scan scheduling throughput for large submission boards.",
        "Improved download state propagation throughput to reduce UI lag during multi-file runs."
      ],
      "fixed": [
        "Fixed repeated heavy-pass work that could slow down larger Classroom pages."
      ],
      "releasedAtUtc": 1787365443974
    },
    {
      "id": "manual-1.5.3-28",
      "version": "1.5.3",
      "title": "Release 1.5.3",
      "summary": "Introduced a new detection layer for flags and files to keep ownership mapping stable across complex Classroom layouts.",
      "highlights": [
        "Added a dedicated layer that correlates file cards and flag ownership with stricter DOM boundaries.",
        "Updated detection order so file identity and flag identity resolve from the same scoped card context.",
        "Fixed edge cases where shared wrappers could cause mis-scoped file or flag decisions."
      ],
      "added": [
        "Added a dedicated layer that correlates file cards and flag ownership with stricter DOM boundaries."
      ],
      "changed": [
        "Updated detection order so file identity and flag identity resolve from the same scoped card context."
      ],
      "fixed": [
        "Fixed edge cases where shared wrappers could cause mis-scoped file or flag decisions."
      ],
      "releasedAtUtc": 1787279043974
    },
    {
      "id": "manual-1.5.2-29",
      "version": "1.5.2",
      "title": "Release 1.5.2",
      "summary": "A focused stabilization release delivering bug fixes and stronger security hardening for production classrooms.",
      "highlights": [
        "Added stricter URL validation and safer resolver guardrails for indirect Student Work links.",
        "Improved defensive checks around download state transitions and message-bridge handling.",
        "Fixed download-state and mapping regressions that could impact reliability under mixed attachment sets."
      ],
      "added": [
        "Added stricter URL validation and safer resolver guardrails for indirect Student Work links."
      ],
      "changed": [
        "Improved defensive checks around download state transitions and message-bridge handling."
      ],
      "fixed": [
        "Fixed download-state and mapping regressions that could impact reliability under mixed attachment sets."
      ],
      "releasedAtUtc": 1787192643974
    },
    {
      "id": "manual-1.5.1-30",
      "version": "1.5.1",
      "title": "Release 1.5.1",
      "summary": "Expanded real-world support for the Student Work tap so teachers can download attached files and media directly from submissions.",
      "highlights": [
        "Introduced support for Student Work tap downloads based on real user needs — big thanks to @Ahmed for the valuable feedback 🙌",
        "Aligned Student Work button rendering and Download All wiring with the stable classroom download flow.",
        "Fixed early Student Work gaps where some submissions were not reachable through the normal download UX."
      ],
      "added": [
        "Introduced support for Student Work tap downloads based on real user needs — big thanks to @Ahmed for the valuable feedback 🙌"
      ],
      "changed": [
        "Aligned Student Work button rendering and Download All wiring with the stable classroom download flow."
      ],
      "fixed": [
        "Fixed early Student Work gaps where some submissions were not reachable through the normal download UX."
      ],
      "releasedAtUtc": 1787106243974
    },
    {
      "id": "manual-1.5.0-31",
      "version": "1.5.0",
      "title": "Release 1.5.0",
      "summary": "This is the best and most reliable state the extension has reached so far. Download buttons, flag placement, and post detection are now much more accurate in real Google Classroom usage.",
      "highlights": [
        "Better internal engine foundations for safer future upgrades.",
        "Stronger protection against bad detections and unstable page structures.",
        "Download buttons are now much more careful about where they appear.",
        "The engine roadmap now keeps `1.5.0` as the stable DOM-first milestone and `1.6.0` as the later API-assisted step.",
        "Fixed random buttons appearing on Google Forms and Google Sheets links.",
        "Fixed missing buttons on real Classroom attachment cards after stricter filtering.",
        "Fixed duplicate or nested flag borders on some posts.",
        "Fixed download states that could stay stuck even after the browser finished the file."
      ],
      "added": [
        "Better internal engine foundations for safer future upgrades.",
        "Stronger protection against bad detections and unstable page structures."
      ],
      "changed": [
        "Download buttons are now much more careful about where they appear.",
        "The engine roadmap now keeps `1.5.0` as the stable DOM-first milestone and `1.6.0` as the later API-assisted step."
      ],
      "fixed": [
        "Fixed random buttons appearing on Google Forms and Google Sheets links.",
        "Fixed missing buttons on real Classroom attachment cards after stricter filtering.",
        "Fixed duplicate or nested flag borders on some posts.",
        "Fixed download states that could stay stuck even after the browser finished the file."
      ],
      "releasedAtUtc": 1787019843974
    },
    {
      "id": "manual-1.4.0-32",
      "version": "1.4.0",
      "title": "Release 1.4.0",
      "summary": "A major under-the-hood release that introduced the V2 engine foundation. It made the extension safer to improve without breaking the stable experience you already rely on.",
      "highlights": [
        "A new V2 engine foundation for smarter discovery, placement, and flag logic.",
        "Better internal tooling for testing and catching regressions.",
        "The extension architecture is now much more structured and ready for future upgrades.",
        "Fixed several fragile internal paths by giving the extension clearer runtime boundaries."
      ],
      "added": [
        "A new V2 engine foundation for smarter discovery, placement, and flag logic.",
        "Better internal tooling for testing and catching regressions."
      ],
      "changed": [
        "The extension architecture is now much more structured and ready for future upgrades."
      ],
      "fixed": [
        "Fixed several fragile internal paths by giving the extension clearer runtime boundaries."
      ],
      "releasedAtUtc": 1786933443974
    },
    {
      "id": "manual-1.3.9-33",
      "version": "1.3.9",
      "title": "Release 1.3.9",
      "summary": "Improved release consistency and user-facing clarity across the website and extension experiences.",
      "highlights": [
        "Added clearer user-facing release communication for the current update cycle.",
        "Added stronger coverage for changelog publishing and display paths.",
        "Updated changelog delivery flow so website and extension updates are more predictable.",
        "Refined release-note formatting consistency for easier reading.",
        "Fixed issues where changelog visibility could be inconsistent across surfaces.",
        "Fixed multiple reliability edge cases in update-state handling."
      ],
      "added": [
        "Added clearer user-facing release communication for the current update cycle.",
        "Added stronger coverage for changelog publishing and display paths."
      ],
      "changed": [
        "Updated changelog delivery flow so website and extension updates are more predictable.",
        "Refined release-note formatting consistency for easier reading."
      ],
      "fixed": [
        "Fixed issues where changelog visibility could be inconsistent across surfaces.",
        "Fixed multiple reliability edge cases in update-state handling."
      ],
      "releasedAtUtc": 1786847043974
    },
    {
      "id": "manual-1.3.8-34",
      "version": "1.3.8",
      "title": "Release 1.3.8",
      "summary": "Improved changelog reliability so users always receive updates, even when the version number stays the same.",
      "highlights": [
        "Revision-aware changelog tracking that detects content changes during same-version publishes.",
        "Stronger integration coverage for changelog synchronization.",
        "Update detection now compares version plus changelog revision instead of version alone.",
        "Popup changelog flow now force-refreshes before marking an update as seen.",
        "Fixed same-version publish cases where users could miss new changelog updates.",
        "Fixed stale version-pill and changelog content after changelog updates."
      ],
      "added": [
        "Revision-aware changelog tracking that detects content changes during same-version publishes.",
        "Stronger integration coverage for changelog synchronization."
      ],
      "changed": [
        "Update detection now compares version plus changelog revision instead of version alone.",
        "Popup changelog flow now force-refreshes before marking an update as seen."
      ],
      "fixed": [
        "Fixed same-version publish cases where users could miss new changelog updates.",
        "Fixed stale version-pill and changelog content after changelog updates."
      ],
      "releasedAtUtc": 1786760643974
    },
    {
      "id": "manual-1.3.7-35",
      "version": "1.3.7",
      "title": "Release 1.3.7",
      "summary": "Improved daily reliability and clearer release communication for normal users.",
      "highlights": [
        "Cleaner user-facing release-note wording in extension update channels.",
        "Better in-product guidance around install and update flow.",
        "Refined runtime status handling for smoother transitions.",
        "Improved behavior during heavy multi-file class sessions.",
        "Fixed cancelled-download accounting edge cases.",
        "Fixed intermittent long-run progress-state inconsistencies."
      ],
      "added": [
        "Cleaner user-facing release-note wording in extension update channels.",
        "Better in-product guidance around install and update flow."
      ],
      "changed": [
        "Refined runtime status handling for smoother transitions.",
        "Improved behavior during heavy multi-file class sessions."
      ],
      "fixed": [
        "Fixed cancelled-download accounting edge cases.",
        "Fixed intermittent long-run progress-state inconsistencies."
      ],
      "releasedAtUtc": 1786674243974
    },
    {
      "id": "manual-1.3.6-36",
      "version": "1.3.6",
      "title": "Release 1.3.6",
      "summary": "Focused on stability and compatibility hardening for heavy classroom workloads.",
      "highlights": [
        "Extra runtime safety checks for extension processing.",
        "Expanded internal coverage for changelog and analytics behavior.",
        "Improved handling of mixed and large file batches.",
        "Improved recovery after temporary tab sleep or network interruptions.",
        "Fixed stuck-progress scenarios during long runs.",
        "Fixed dependency-path compatibility friction."
      ],
      "added": [
        "Extra runtime safety checks for extension processing.",
        "Expanded internal coverage for changelog and analytics behavior."
      ],
      "changed": [
        "Improved handling of mixed and large file batches.",
        "Improved recovery after temporary tab sleep or network interruptions."
      ],
      "fixed": [
        "Fixed stuck-progress scenarios during long runs.",
        "Fixed dependency-path compatibility friction."
      ],
      "releasedAtUtc": 1786587843974
    },
    {
      "id": "manual-1.3.0-37",
      "version": "1.3.0",
      "title": "Release 1.3.0",
      "summary": "Delivered major reliability, remote-config, and analytics improvements.",
      "highlights": [
        "UTC-based scheduling and timestamp handling for extension analytics.",
        "Stronger metadata handling for accepted, duplicate, and invalid events.",
        "Improved payload validation and safer queue processing.",
        "Improved retry behavior with stricter retry-limit handling.",
        "Fixed remote-config application issues on key limits and timing.",
        "Fixed queue integrity mismatch handling to avoid data drops."
      ],
      "added": [
        "UTC-based scheduling and timestamp handling for extension analytics.",
        "Stronger metadata handling for accepted, duplicate, and invalid events."
      ],
      "changed": [
        "Improved payload validation and safer queue processing.",
        "Improved retry behavior with stricter retry-limit handling."
      ],
      "fixed": [
        "Fixed remote-config application issues on key limits and timing.",
        "Fixed queue integrity mismatch handling to avoid data drops."
      ],
      "releasedAtUtc": 1786501443974
    },
    {
      "id": "manual-1.2.7-38",
      "version": "1.2.7",
      "title": "Release 1.2.7",
      "summary": "Broad security and reliability hardening across extension behavior.",
      "highlights": [
        "Stronger extension-side protections and validation coverage.",
        "Expanded runtime and security-oriented extension tests.",
        "Improved resilience during high-volume mixed workloads.",
        "Improved consistency in security-sensitive paths.",
        "Fixed multiple reliability edge cases found during hardening.",
        "Fixed several production stability regressions."
      ],
      "added": [
        "Stronger extension-side protections and validation coverage.",
        "Expanded runtime and security-oriented extension tests."
      ],
      "changed": [
        "Improved resilience during high-volume mixed workloads.",
        "Improved consistency in security-sensitive paths."
      ],
      "fixed": [
        "Fixed multiple reliability edge cases found during hardening.",
        "Fixed several production stability regressions."
      ],
      "releasedAtUtc": 1786415043974
    },
    {
      "id": "manual-1.2.3-39",
      "version": "1.2.3",
      "title": "Release 1.2.3",
      "summary": "Usability and telemetry consistency release.",
      "highlights": [
        "Better feedback and uninstall data-capture integrations.",
        "Improved extension schema alignment with backend endpoints.",
        "Fixed inconsistent telemetry fields in specific event paths."
      ],
      "added": [
        "Better feedback and uninstall data-capture integrations."
      ],
      "changed": [
        "Improved extension schema alignment with backend endpoints."
      ],
      "fixed": [
        "Fixed inconsistent telemetry fields in specific event paths."
      ],
      "releasedAtUtc": 1786328643974
    },
    {
      "id": "manual-1.2.2-40",
      "version": "1.2.2",
      "title": "Release 1.2.2",
      "summary": "Cancel-flow polish release.",
      "highlights": [
        "Extra cancellation behavior coverage and safety checks.",
        "Improved cancel interaction responsiveness.",
        "Fixed inconsistent cleanup after cancellation."
      ],
      "added": [
        "Extra cancellation behavior coverage and safety checks."
      ],
      "changed": [
        "Improved cancel interaction responsiveness."
      ],
      "fixed": [
        "Fixed inconsistent cleanup after cancellation."
      ],
      "releasedAtUtc": 1786242243974
    },
    {
      "id": "manual-1.2.1-41",
      "version": "1.2.1",
      "title": "Release 1.2.1",
      "summary": "Unified cancel-system iteration release.",
      "highlights": [
        "Unified cancel-system handling for active operations.",
        "Refined cancel and retry behavior.",
        "Fixed slow cancel-state reflection edge cases."
      ],
      "added": [
        "Unified cancel-system handling for active operations."
      ],
      "changed": [
        "Refined cancel and retry behavior."
      ],
      "fixed": [
        "Fixed slow cancel-state reflection edge cases."
      ],
      "releasedAtUtc": 1786155843974
    },
    {
      "id": "manual-1.2.0-42",
      "version": "1.2.0",
      "title": "Release 1.2.0",
      "summary": "Cancel feature baseline release.",
      "highlights": [
        "Core cancel-download functionality for in-progress operations.",
        "Updated operation lifecycle to support cancellation.",
        "Fixed flow limitations where in-flight operations could not be interrupted."
      ],
      "added": [
        "Core cancel-download functionality for in-progress operations."
      ],
      "changed": [
        "Updated operation lifecycle to support cancellation."
      ],
      "fixed": [
        "Fixed flow limitations where in-flight operations could not be interrupted."
      ],
      "releasedAtUtc": 1786069443974
    },
    {
      "id": "manual-1.1.10-43",
      "version": "1.1.10",
      "title": "Release 1.1.10",
      "summary": "Late 1.1 line reliability release.",
      "highlights": [
        "Additional stability checks for repeated classroom workflows.",
        "Tuned runtime defaults for safer long-session operation.",
        "Fixed regressions discovered across prolonged usage sessions."
      ],
      "added": [
        "Additional stability checks for repeated classroom workflows."
      ],
      "changed": [
        "Tuned runtime defaults for safer long-session operation."
      ],
      "fixed": [
        "Fixed regressions discovered across prolonged usage sessions."
      ],
      "releasedAtUtc": 1785983043974
    },
    {
      "id": "manual-1.1.5-44",
      "version": "1.1.5",
      "title": "Release 1.1.5",
      "summary": "Mid 1.1 quality and compatibility release.",
      "highlights": [
        "Expanded compatibility checks for supported browsers.",
        "Improved popup and runtime consistency.",
        "Fixed minor behavior mismatches in repeated task flows."
      ],
      "added": [
        "Expanded compatibility checks for supported browsers."
      ],
      "changed": [
        "Improved popup and runtime consistency."
      ],
      "fixed": [
        "Fixed minor behavior mismatches in repeated task flows."
      ],
      "releasedAtUtc": 1785896643974
    },
    {
      "id": "manual-1.1.1-45",
      "version": "1.1.1",
      "title": "Release 1.1.1",
      "summary": "Post-1.1 stabilization release.",
      "highlights": [
        "Additional background-flow instrumentation coverage.",
        "Improved queue and error-handling defaults.",
        "Fixed early 1.1 edge-case runtime failures."
      ],
      "added": [
        "Additional background-flow instrumentation coverage."
      ],
      "changed": [
        "Improved queue and error-handling defaults."
      ],
      "fixed": [
        "Fixed early 1.1 edge-case runtime failures."
      ],
      "releasedAtUtc": 1785810243974
    },
    {
      "id": "manual-1.1.0-46",
      "version": "1.1.0",
      "title": "Release 1.1.0",
      "summary": "Feature and packaging expansion release.",
      "highlights": [
        "Broader multi-browser support improvements.",
        "Updated setup and runtime behavior for wider compatibility.",
        "Fixed packaging and configuration mismatches."
      ],
      "added": [
        "Broader multi-browser support improvements."
      ],
      "changed": [
        "Updated setup and runtime behavior for wider compatibility."
      ],
      "fixed": [
        "Fixed packaging and configuration mismatches."
      ],
      "releasedAtUtc": 1785723843974
    },
    {
      "id": "manual-1.0.1-47",
      "version": "1.0.1",
      "title": "Release 1.0.1",
      "summary": "Post-launch stabilization release.",
      "highlights": [
        "Better diagnostics for analytics and sync.",
        "Improved compatibility in repeat-use scenarios.",
        "Fixed first-wave regressions after 1.0.0 rollout."
      ],
      "added": [
        "Better diagnostics for analytics and sync."
      ],
      "changed": [
        "Improved compatibility in repeat-use scenarios."
      ],
      "fixed": [
        "Fixed first-wave regressions after 1.0.0 rollout."
      ],
      "releasedAtUtc": 1785637443974
    },
    {
      "id": "manual-1.0.0-48",
      "version": "1.0.0",
      "title": "Release 1.0.0",
      "summary": "First stable production release.",
      "highlights": [
        "Core one-click Classroom download experience.",
        "Established baseline extension data contracts.",
        "Fixed pre-stable blockers before public release."
      ],
      "added": [
        "Core one-click Classroom download experience."
      ],
      "changed": [
        "Established baseline extension data contracts."
      ],
      "fixed": [
        "Fixed pre-stable blockers before public release."
      ],
      "releasedAtUtc": 1785551043974
    }
  ]
} as const;
