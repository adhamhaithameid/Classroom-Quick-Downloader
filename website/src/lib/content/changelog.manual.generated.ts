/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. */
export const WEBSITE_MANUAL_CHANGELOG = {
  "generatedAt": 1773730545440,
  "source": "manual",
  "entries": [
    {
      "id": "manual-1.5.5-1",
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
      "releasedAtUtc": 1773730545435
    },
    {
      "id": "manual-1.5.4-2",
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
      "releasedAtUtc": 1773644145435
    },
    {
      "id": "manual-1.5.3-3",
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
      "releasedAtUtc": 1773557745435
    },
    {
      "id": "manual-1.5.2-4",
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
      "releasedAtUtc": 1773471345435
    },
    {
      "id": "manual-1.5.1-5",
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
      "releasedAtUtc": 1773384945435
    },
    {
      "id": "manual-1.5.0-6",
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
      "releasedAtUtc": 1773298545435
    },
    {
      "id": "manual-1.4.0-7",
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
      "releasedAtUtc": 1773212145435
    },
    {
      "id": "manual-1.3.9-8",
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
      "releasedAtUtc": 1773125745435
    },
    {
      "id": "manual-1.3.8-9",
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
      "releasedAtUtc": 1773039345435
    },
    {
      "id": "manual-1.3.7-10",
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
      "releasedAtUtc": 1772952945435
    },
    {
      "id": "manual-1.3.6-11",
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
      "releasedAtUtc": 1772866545435
    },
    {
      "id": "manual-1.3.0-12",
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
      "releasedAtUtc": 1772780145435
    },
    {
      "id": "manual-1.2.7-13",
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
      "releasedAtUtc": 1772693745435
    },
    {
      "id": "manual-1.2.3-14",
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
      "releasedAtUtc": 1772607345435
    },
    {
      "id": "manual-1.2.2-15",
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
      "releasedAtUtc": 1772520945435
    },
    {
      "id": "manual-1.2.1-16",
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
      "releasedAtUtc": 1772434545435
    },
    {
      "id": "manual-1.2.0-17",
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
      "releasedAtUtc": 1772348145435
    },
    {
      "id": "manual-1.1.10-18",
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
      "releasedAtUtc": 1772261745435
    },
    {
      "id": "manual-1.1.5-19",
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
      "releasedAtUtc": 1772175345435
    },
    {
      "id": "manual-1.1.1-20",
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
      "releasedAtUtc": 1772088945435
    },
    {
      "id": "manual-1.1.0-21",
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
      "releasedAtUtc": 1772002545435
    },
    {
      "id": "manual-1.0.1-22",
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
      "releasedAtUtc": 1771916145435
    },
    {
      "id": "manual-1.0.0-23",
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
      "releasedAtUtc": 1771829745435
    }
  ]
} as const;
