/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. */
export const EXTENSION_MANUAL_CHANGELOG = {
  "schemaVersion": "1",
  "ok": true,
  "source": "manual",
  "entries": [
    {
      "id": "manual-1.6.19-1",
      "version": "1.6.19",
      "date": "2026-09-17T01:38:01.135Z",
      "summary": "A major download-engine overhaul: zero-window downloads with multi-account fallback, honest failure reporting for every error class, and the new Engine Mode switch. Every download now either succeeds or tells you exactly what to do next.",
      "changes": [
        "Summary: A major download-engine overhaul: zero-window downloads with multi-account fallback, honest failure reporting for every error class, and the new Engine Mode switch. Every download now either succeeds or tells you exactly what to do next.",
        "Added: Added invisible multi-account fallback: when the active Google account cannot access a file, the extension now quietly tries your other signed-in accounts instead of failing.",
        "Added: Added the Engine Mode switch in popup settings (Legacy / New) with one-click rollback — switching applies live, no page reload.",
        "Added: Added a 150-second download deadline: a stalled download now reports \"This download timed out. Try again.\" instead of hanging forever.",
        "Added: Added automatic retry (with a short backoff) for temporary network and server failures.",
        "Added: Added specific, actionable failure messages: disk full, file unavailable, browser blocked the download, sign-in required, and more.",
        "Changed: Downloads now target Google's modern byte-serving endpoint directly — faster downloads with no interstitial hop.",
        "Changed: Downloads are now completely window-free: no new tabs or windows are ever opened, on any browser.",
        "Changed: Firefox downloads now report success only when the browser confirms the file finished — no more phantom successes.",
        "Changed: Student Work pages and form links no longer receive download buttons that could never work.",
        "Changed: Hardened download URL validation: the allowlist now covers all legitimate Google attachment shapes while external look-alike links stay blocked.",
        "Fixed: Fixed the \"Download All always hangs\" family: a group with a broken file now settles correctly (success, partial, or error) instead of sticking on the running state.",
        "Fixed: Fixed downloads silently disappearing after the browser already reported success (Firefox).",
        "Fixed: Fixed Drive error and quota pages being saved as fake \".html\" downloads — these are now detected and handled as access errors.",
        "Fixed: Fixed the visible \"403 Access Forbidden\" window that could appear and never close.",
        "Fixed: Fixed Sheets attachment downloads being rejected as invalid URLs."
      ],
      "added": [
        "Added invisible multi-account fallback: when the active Google account cannot access a file, the extension now quietly tries your other signed-in accounts instead of failing.",
        "Added the Engine Mode switch in popup settings (Legacy / New) with one-click rollback — switching applies live, no page reload.",
        "Added a 150-second download deadline: a stalled download now reports \"This download timed out. Try again.\" instead of hanging forever.",
        "Added automatic retry (with a short backoff) for temporary network and server failures.",
        "Added specific, actionable failure messages: disk full, file unavailable, browser blocked the download, sign-in required, and more."
      ],
      "changed": [
        "Downloads now target Google's modern byte-serving endpoint directly — faster downloads with no interstitial hop.",
        "Downloads are now completely window-free: no new tabs or windows are ever opened, on any browser.",
        "Firefox downloads now report success only when the browser confirms the file finished — no more phantom successes.",
        "Student Work pages and form links no longer receive download buttons that could never work.",
        "Hardened download URL validation: the allowlist now covers all legitimate Google attachment shapes while external look-alike links stay blocked."
      ],
      "fixed": [
        "Fixed the \"Download All always hangs\" family: a group with a broken file now settles correctly (success, partial, or error) instead of sticking on the running state.",
        "Fixed downloads silently disappearing after the browser already reported success (Firefox).",
        "Fixed Drive error and quota pages being saved as fake \".html\" downloads — these are now detected and handled as access errors.",
        "Fixed the visible \"403 Access Forbidden\" window that could appear and never close.",
        "Fixed Sheets attachment downloads being rejected as invalid URLs."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.6.15-2",
      "version": "1.6.15",
      "date": "2026-09-16T01:38:01.135Z",
      "summary": "A stabilization release that finished the Download All overhaul: groups always settle, background tabs stay live, and automated QA coverage reached the full manual runbook.",
      "changes": [
        "Summary: A stabilization release that finished the Download All overhaul: groups always settle, background tabs stay live, and automated QA coverage reached the full manual runbook.",
        "Changed: Extended the automated manual-check suite to cover every runbook flow (submissions rows, popup analytics, back-navigation, error states), with real download verification.",
        "Fixed: Fixed Download All groups that could stay stuck on \"Downloading…\" forever — the root cause of the long-running hang reports.",
        "Fixed: Fixed Download All progress not updating when the Classroom tab was open in the background."
      ],
      "added": [],
      "changed": [
        "Extended the automated manual-check suite to cover every runbook flow (submissions rows, popup analytics, back-navigation, error states), with real download verification."
      ],
      "fixed": [
        "Fixed Download All groups that could stay stuck on \"Downloading…\" forever — the root cause of the long-running hang reports.",
        "Fixed Download All progress not updating when the Classroom tab was open in the background."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.6.10-3",
      "version": "1.6.10",
      "date": "2026-09-15T01:38:01.135Z",
      "summary": "Download reliability milestone: invisible multi-account fallback, completely window-free downloads through Google's direct file endpoint, and the new Engine Mode switch.",
      "changes": [
        "Summary: Download reliability milestone: invisible multi-account fallback, completely window-free downloads through Google's direct file endpoint, and the new Engine Mode switch.",
        "Added: Added invisible multi-account fallback: files the active account cannot access now try the other signed-in accounts quietly.",
        "Added: Added the Engine Mode switch in popup settings (Legacy / New) with one-click rollback and live switching.",
        "Added: Added an event-bus architecture connecting page detection to the download engine through one typed bridge.",
        "Changed: Downloads now use Google's modern byte-serving endpoint directly — one hop, faster, no interstitial pages.",
        "Changed: Downloads are now window-free on every browser: the old background-tab workaround was removed entirely.",
        "Fixed: Fixed the visible \"403 Access Forbidden\" window that could appear and never close.",
        "Fixed: Fixed \"Download All always fails\" reports where one broken file left the group hanging.",
        "Fixed: Fixed Google Sheets attachments not getting download buttons."
      ],
      "added": [
        "Added invisible multi-account fallback: files the active account cannot access now try the other signed-in accounts quietly.",
        "Added the Engine Mode switch in popup settings (Legacy / New) with one-click rollback and live switching.",
        "Added an event-bus architecture connecting page detection to the download engine through one typed bridge."
      ],
      "changed": [
        "Downloads now use Google's modern byte-serving endpoint directly — one hop, faster, no interstitial pages.",
        "Downloads are now window-free on every browser: the old background-tab workaround was removed entirely."
      ],
      "fixed": [
        "Fixed the visible \"403 Access Forbidden\" window that could appear and never close.",
        "Fixed \"Download All always fails\" reports where one broken file left the group hanging.",
        "Fixed Google Sheets attachments not getting download buttons."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.6.5-4",
      "version": "1.6.5",
      "date": "2026-09-14T01:38:01.135Z",
      "summary": "An accuracy blitz: fifteen detection and naming defects fixed, each locked in by an automated regression corpus, plus a fully automated QA pipeline that replays the manual test runbook in real browsers.",
      "changes": [
        "Summary: An accuracy blitz: fifteen detection and naming defects fixed, each locked in by an automated regression corpus, plus a fully automated QA pipeline that replays the manual test runbook in real browsers.",
        "Added: Added a locale-aware filename cleanup registry so download names stay clean in every language (Hungarian, Arabic, Russian, Japanese, Chinese, French, German, Spanish and more).",
        "Added: Added the automated Manual-QA Replay pipeline: real-browser journeys covering buttons, Download All, flags, popup, navigation and real downloads, plus a gated live-Classroom canary.",
        "Fixed: Fixed comment-count false positives from dates and digits in complex Classroom layouts.",
        "Fixed: Fixed edited/comment verdicts being lost when page markup drifted.",
        "Fixed: Fixed download state races where concurrent downloads of the same file could cross wires.",
        "Fixed: Fixed localized type labels (like \"Tömörített archívum\") leaking into downloaded filenames.",
        "Fixed: Fixed substring false positives in keyword and exclusion matching across scripts (Arabic tashkeel, Armenian, word-numerals)."
      ],
      "added": [
        "Added a locale-aware filename cleanup registry so download names stay clean in every language (Hungarian, Arabic, Russian, Japanese, Chinese, French, German, Spanish and more).",
        "Added the automated Manual-QA Replay pipeline: real-browser journeys covering buttons, Download All, flags, popup, navigation and real downloads, plus a gated live-Classroom canary."
      ],
      "changed": [],
      "fixed": [
        "Fixed comment-count false positives from dates and digits in complex Classroom layouts.",
        "Fixed edited/comment verdicts being lost when page markup drifted.",
        "Fixed download state races where concurrent downloads of the same file could cross wires.",
        "Fixed localized type labels (like \"Tömörített archívum\") leaking into downloaded filenames.",
        "Fixed substring false positives in keyword and exclusion matching across scripts (Arabic tashkeel, Armenian, word-numerals)."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.6.0-5",
      "version": "1.6.0",
      "date": "2026-09-13T01:38:01.135Z",
      "summary": "The Engine V4 foundation: a measurable accuracy standard for the detection engine, a pure download state machine, and hardened release gates. Everything after this version is measured against a fixed corpus.",
      "changes": [
        "Summary: The Engine V4 foundation: a measurable accuracy standard for the detection engine, a pure download state machine, and hardened release gates. Everything after this version is measured against a fixed corpus.",
        "Added: Added the accuracy corpus and gates: detection decisions are held to labeled expectations across locales, with floors that may only move up.",
        "Added: Added typed contracts, an event bus, and a pure acquisition state machine with bounded account rotation and forced deadlines.",
        "Added: Added hardened e2e, accuracy and release gates to CI.",
        "Changed: Extracted the detection core into pure modules: normalization, word-numerals, action-button exclusions, and count ceilings."
      ],
      "added": [
        "Added the accuracy corpus and gates: detection decisions are held to labeled expectations across locales, with floors that may only move up.",
        "Added typed contracts, an event bus, and a pure acquisition state machine with bounded account rotation and forced deadlines.",
        "Added hardened e2e, accuracy and release gates to CI."
      ],
      "changed": [
        "Extracted the detection core into pure modules: normalization, word-numerals, action-button exclusions, and count ceilings."
      ],
      "fixed": [],
      "isImportant": false
    },
    {
      "id": "manual-1.5.5-6",
      "version": "1.5.5",
      "date": "2026-09-12T01:38:01.135Z",
      "summary": "A leaner packaging release focused on reducing extension size while preserving the same classroom behavior.",
      "changes": [
        "Summary: A leaner packaging release focused on reducing extension size while preserving the same classroom behavior.",
        "Added: Added tighter packaging checks for Student Work and core download modules.",
        "Changed: Reduced bundled payload by trimming unused runtime paths and release artifacts.",
        "Fixed: Fixed extension package bloat that increased install and update cost on slower networks."
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
      "isImportant": false
    },
    {
      "id": "manual-1.5.4-7",
      "version": "1.5.4",
      "date": "2026-09-11T01:38:01.135Z",
      "summary": "A performance-focused release with two measurable speed upgrades in scan and download orchestration paths.",
      "changes": [
        "Summary: A performance-focused release with two measurable speed upgrades in scan and download orchestration paths.",
        "Added: Added lightweight scan throttling safeguards for busy Student Work pages.",
        "Changed: Improved scan scheduling throughput for large submission boards.",
        "Changed: Improved download state propagation throughput to reduce UI lag during multi-file runs.",
        "Fixed: Fixed repeated heavy-pass work that could slow down larger Classroom pages."
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
      "isImportant": false
    },
    {
      "id": "manual-1.5.3-8",
      "version": "1.5.3",
      "date": "2026-09-10T01:38:01.135Z",
      "summary": "Introduced a new detection layer for flags and files to keep ownership mapping stable across complex Classroom layouts.",
      "changes": [
        "Summary: Introduced a new detection layer for flags and files to keep ownership mapping stable across complex Classroom layouts.",
        "Added: Added a dedicated layer that correlates file cards and flag ownership with stricter DOM boundaries.",
        "Changed: Updated detection order so file identity and flag identity resolve from the same scoped card context.",
        "Fixed: Fixed edge cases where shared wrappers could cause mis-scoped file or flag decisions."
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
      "isImportant": false
    },
    {
      "id": "manual-1.5.2-9",
      "version": "1.5.2",
      "date": "2026-09-09T01:38:01.135Z",
      "summary": "A focused stabilization release delivering bug fixes and stronger security hardening for production classrooms.",
      "changes": [
        "Summary: A focused stabilization release delivering bug fixes and stronger security hardening for production classrooms.",
        "Added: Added stricter URL validation and safer resolver guardrails for indirect Student Work links.",
        "Changed: Improved defensive checks around download state transitions and message-bridge handling.",
        "Fixed: Fixed download-state and mapping regressions that could impact reliability under mixed attachment sets."
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
      "isImportant": false
    },
    {
      "id": "manual-1.5.1-10",
      "version": "1.5.1",
      "date": "2026-09-08T01:38:01.135Z",
      "summary": "Expanded real-world support for the Student Work tap so teachers can download attached files and media directly from submissions.",
      "changes": [
        "Summary: Expanded real-world support for the Student Work tap so teachers can download attached files and media directly from submissions.",
        "Added: Introduced support for Student Work tap downloads based on real user needs — big thanks to @Ahmed for the valuable feedback 🙌",
        "Changed: Aligned Student Work button rendering and Download All wiring with the stable classroom download flow.",
        "Fixed: Fixed early Student Work gaps where some submissions were not reachable through the normal download UX."
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
      "isImportant": false
    },
    {
      "id": "manual-1.5.0-11",
      "version": "1.5.0",
      "date": "2026-09-07T01:38:01.135Z",
      "summary": "This is the best and most reliable state the extension has reached so far. Download buttons, flag placement, and post detection are now much more accurate in real Google Classroom usage.",
      "changes": [
        "Summary: This is the best and most reliable state the extension has reached so far. Download buttons, flag placement, and post detection are now much more accurate in real Google Classroom usage.",
        "Added: Better internal engine foundations for safer future upgrades.",
        "Added: Stronger protection against bad detections and unstable page structures.",
        "Changed: Download buttons are now much more careful about where they appear.",
        "Changed: The engine roadmap now keeps `1.5.0` as the stable DOM-first milestone and `1.6.0` as the later API-assisted step.",
        "Fixed: Fixed random buttons appearing on Google Forms and Google Sheets links.",
        "Fixed: Fixed missing buttons on real Classroom attachment cards after stricter filtering.",
        "Fixed: Fixed duplicate or nested flag borders on some posts.",
        "Fixed: Fixed download states that could stay stuck even after the browser finished the file."
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
      "isImportant": false
    },
    {
      "id": "manual-1.4.0-12",
      "version": "1.4.0",
      "date": "2026-09-06T01:38:01.135Z",
      "summary": "A major under-the-hood release that introduced the V2 engine foundation. It made the extension safer to improve without breaking the stable experience you already rely on.",
      "changes": [
        "Summary: A major under-the-hood release that introduced the V2 engine foundation. It made the extension safer to improve without breaking the stable experience you already rely on.",
        "Added: A new V2 engine foundation for smarter discovery, placement, and flag logic.",
        "Added: Better internal tooling for testing and catching regressions.",
        "Changed: The extension architecture is now much more structured and ready for future upgrades.",
        "Fixed: Fixed several fragile internal paths by giving the extension clearer runtime boundaries."
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
      "isImportant": false
    },
    {
      "id": "manual-1.3.9-13",
      "version": "1.3.9",
      "date": "2026-09-05T01:38:01.135Z",
      "summary": "Improved release consistency and user-facing clarity across the website and extension experiences.",
      "changes": [
        "Summary: Improved release consistency and user-facing clarity across the website and extension experiences.",
        "Added: Added clearer user-facing release communication for the current update cycle.",
        "Added: Added stronger coverage for changelog publishing and display paths.",
        "Changed: Updated changelog delivery flow so website and extension updates are more predictable.",
        "Changed: Refined release-note formatting consistency for easier reading.",
        "Fixed: Fixed issues where changelog visibility could be inconsistent across surfaces.",
        "Fixed: Fixed multiple reliability edge cases in update-state handling."
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
      "isImportant": false
    },
    {
      "id": "manual-1.3.8-14",
      "version": "1.3.8",
      "date": "2026-09-04T01:38:01.135Z",
      "summary": "Improved changelog reliability so users always receive updates, even when the version number stays the same.",
      "changes": [
        "Summary: Improved changelog reliability so users always receive updates, even when the version number stays the same.",
        "Added: Revision-aware changelog tracking that detects content changes during same-version publishes.",
        "Added: Stronger integration coverage for changelog synchronization.",
        "Changed: Update detection now compares version plus changelog revision instead of version alone.",
        "Changed: Popup changelog flow now force-refreshes before marking an update as seen.",
        "Fixed: Fixed same-version publish cases where users could miss new changelog updates.",
        "Fixed: Fixed stale version-pill and changelog content after changelog updates."
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
      "isImportant": true
    },
    {
      "id": "manual-1.3.7-15",
      "version": "1.3.7",
      "date": "2026-09-03T01:38:01.135Z",
      "summary": "Improved daily reliability and clearer release communication for normal users.",
      "changes": [
        "Summary: Improved daily reliability and clearer release communication for normal users.",
        "Added: Cleaner user-facing release-note wording in extension update channels.",
        "Added: Better in-product guidance around install and update flow.",
        "Changed: Refined runtime status handling for smoother transitions.",
        "Changed: Improved behavior during heavy multi-file class sessions.",
        "Fixed: Fixed cancelled-download accounting edge cases.",
        "Fixed: Fixed intermittent long-run progress-state inconsistencies."
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
      "isImportant": true
    },
    {
      "id": "manual-1.3.6-16",
      "version": "1.3.6",
      "date": "2026-09-02T01:38:01.135Z",
      "summary": "Focused on stability and compatibility hardening for heavy classroom workloads.",
      "changes": [
        "Summary: Focused on stability and compatibility hardening for heavy classroom workloads.",
        "Added: Extra runtime safety checks for extension processing.",
        "Added: Expanded internal coverage for changelog and analytics behavior.",
        "Changed: Improved handling of mixed and large file batches.",
        "Changed: Improved recovery after temporary tab sleep or network interruptions.",
        "Fixed: Fixed stuck-progress scenarios during long runs.",
        "Fixed: Fixed dependency-path compatibility friction."
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
      "isImportant": false
    },
    {
      "id": "manual-1.3.0-17",
      "version": "1.3.0",
      "date": "2026-09-01T01:38:01.135Z",
      "summary": "Delivered major reliability, remote-config, and analytics improvements.",
      "changes": [
        "Summary: Delivered major reliability, remote-config, and analytics improvements.",
        "Added: UTC-based scheduling and timestamp handling for extension analytics.",
        "Added: Stronger metadata handling for accepted, duplicate, and invalid events.",
        "Changed: Improved payload validation and safer queue processing.",
        "Changed: Improved retry behavior with stricter retry-limit handling.",
        "Fixed: Fixed remote-config application issues on key limits and timing.",
        "Fixed: Fixed queue integrity mismatch handling to avoid data drops."
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
      "isImportant": false
    },
    {
      "id": "manual-1.2.7-18",
      "version": "1.2.7",
      "date": "2026-08-31T01:38:01.135Z",
      "summary": "Broad security and reliability hardening across extension behavior.",
      "changes": [
        "Summary: Broad security and reliability hardening across extension behavior.",
        "Added: Stronger extension-side protections and validation coverage.",
        "Added: Expanded runtime and security-oriented extension tests.",
        "Changed: Improved resilience during high-volume mixed workloads.",
        "Changed: Improved consistency in security-sensitive paths.",
        "Fixed: Fixed multiple reliability edge cases found during hardening.",
        "Fixed: Fixed several production stability regressions."
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
      "isImportant": false
    },
    {
      "id": "manual-1.2.3-19",
      "version": "1.2.3",
      "date": "2026-08-30T01:38:01.135Z",
      "summary": "Usability and telemetry consistency release.",
      "changes": [
        "Summary: Usability and telemetry consistency release.",
        "Added: Better feedback and uninstall data-capture integrations.",
        "Changed: Improved extension schema alignment with backend endpoints.",
        "Fixed: Fixed inconsistent telemetry fields in specific event paths."
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
      "isImportant": false
    },
    {
      "id": "manual-1.2.2-20",
      "version": "1.2.2",
      "date": "2026-08-29T01:38:01.135Z",
      "summary": "Cancel-flow polish release.",
      "changes": [
        "Summary: Cancel-flow polish release.",
        "Added: Extra cancellation behavior coverage and safety checks.",
        "Changed: Improved cancel interaction responsiveness.",
        "Fixed: Fixed inconsistent cleanup after cancellation."
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
      "isImportant": false
    },
    {
      "id": "manual-1.2.1-21",
      "version": "1.2.1",
      "date": "2026-08-28T01:38:01.135Z",
      "summary": "Unified cancel-system iteration release.",
      "changes": [
        "Summary: Unified cancel-system iteration release.",
        "Added: Unified cancel-system handling for active operations.",
        "Changed: Refined cancel and retry behavior.",
        "Fixed: Fixed slow cancel-state reflection edge cases."
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
      "isImportant": false
    },
    {
      "id": "manual-1.2.0-22",
      "version": "1.2.0",
      "date": "2026-08-27T01:38:01.135Z",
      "summary": "Cancel feature baseline release.",
      "changes": [
        "Summary: Cancel feature baseline release.",
        "Added: Core cancel-download functionality for in-progress operations.",
        "Changed: Updated operation lifecycle to support cancellation.",
        "Fixed: Fixed flow limitations where in-flight operations could not be interrupted."
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
      "isImportant": false
    },
    {
      "id": "manual-1.1.10-23",
      "version": "1.1.10",
      "date": "2026-08-26T01:38:01.135Z",
      "summary": "Late 1.1 line reliability release.",
      "changes": [
        "Summary: Late 1.1 line reliability release.",
        "Added: Additional stability checks for repeated classroom workflows.",
        "Changed: Tuned runtime defaults for safer long-session operation.",
        "Fixed: Fixed regressions discovered across prolonged usage sessions."
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
      "isImportant": false
    },
    {
      "id": "manual-1.1.5-24",
      "version": "1.1.5",
      "date": "2026-08-25T01:38:01.135Z",
      "summary": "Mid 1.1 quality and compatibility release.",
      "changes": [
        "Summary: Mid 1.1 quality and compatibility release.",
        "Added: Expanded compatibility checks for supported browsers.",
        "Changed: Improved popup and runtime consistency.",
        "Fixed: Fixed minor behavior mismatches in repeated task flows."
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
      "isImportant": false
    },
    {
      "id": "manual-1.1.1-25",
      "version": "1.1.1",
      "date": "2026-08-24T01:38:01.135Z",
      "summary": "Post-1.1 stabilization release.",
      "changes": [
        "Summary: Post-1.1 stabilization release.",
        "Added: Additional background-flow instrumentation coverage.",
        "Changed: Improved queue and error-handling defaults.",
        "Fixed: Fixed early 1.1 edge-case runtime failures."
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
      "isImportant": false
    },
    {
      "id": "manual-1.1.0-26",
      "version": "1.1.0",
      "date": "2026-08-23T01:38:01.135Z",
      "summary": "Feature and packaging expansion release.",
      "changes": [
        "Summary: Feature and packaging expansion release.",
        "Added: Broader multi-browser support improvements.",
        "Changed: Updated setup and runtime behavior for wider compatibility.",
        "Fixed: Fixed packaging and configuration mismatches."
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
      "isImportant": false
    },
    {
      "id": "manual-1.0.1-27",
      "version": "1.0.1",
      "date": "2026-08-22T01:38:01.135Z",
      "summary": "Post-launch stabilization release.",
      "changes": [
        "Summary: Post-launch stabilization release.",
        "Added: Better diagnostics for analytics and sync.",
        "Changed: Improved compatibility in repeat-use scenarios.",
        "Fixed: Fixed first-wave regressions after 1.0.0 rollout."
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
      "isImportant": false
    },
    {
      "id": "manual-1.0.0-28",
      "version": "1.0.0",
      "date": "2026-08-21T01:38:01.135Z",
      "summary": "First stable production release.",
      "changes": [
        "Summary: First stable production release.",
        "Added: Core one-click Classroom download experience.",
        "Changed: Established baseline extension data contracts.",
        "Fixed: Fixed pre-stable blockers before public release."
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
      "isImportant": false
    }
  ],
  "config": {
    "rules": [
      {
        "id": "manual-pill-v137",
        "target": "1.3.7",
        "priority": "major",
        "effect": "pulse",
        "color": "red"
      },
      {
        "id": "manual-pill-v138",
        "target": "1.3.8",
        "priority": "major",
        "effect": "pulse",
        "color": "red"
      },
      {
        "id": "manual-pill-default",
        "target": "all",
        "priority": "normal",
        "effect": "none",
        "color": "default"
      }
    ],
    "lastUpdated": 1789609081138
  },
  "meta": {
    "applyMode": "manual",
    "liveUpdatedAt": 1789609081138,
    "contentChecksum": "manual-1789609081138"
  }
} as const;
