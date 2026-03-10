/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. */
export const EXTENSION_MANUAL_CHANGELOG = {
  "schemaVersion": "1",
  "ok": true,
  "source": "manual",
  "entries": [
    {
      "id": "manual-1.5.0-1",
      "version": "1.5.0",
      "date": "2026-03-10T03:21:38.909Z",
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
      "id": "manual-1.4.0-2",
      "version": "1.4.0",
      "date": "2026-03-09T03:21:38.909Z",
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
      "id": "manual-1.3.9-3",
      "version": "1.3.9",
      "date": "2026-03-08T03:21:38.909Z",
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
      "id": "manual-1.3.8-4",
      "version": "1.3.8",
      "date": "2026-03-07T03:21:38.909Z",
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
      "id": "manual-1.3.7-5",
      "version": "1.3.7",
      "date": "2026-03-06T03:21:38.909Z",
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
      "id": "manual-1.3.6-6",
      "version": "1.3.6",
      "date": "2026-03-05T03:21:38.909Z",
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
      "id": "manual-1.3.0-7",
      "version": "1.3.0",
      "date": "2026-03-04T03:21:38.909Z",
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
      "id": "manual-1.2.7-8",
      "version": "1.2.7",
      "date": "2026-03-03T03:21:38.909Z",
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
      "id": "manual-1.2.3-9",
      "version": "1.2.3",
      "date": "2026-03-02T03:21:38.909Z",
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
      "id": "manual-1.2.2-10",
      "version": "1.2.2",
      "date": "2026-03-01T03:21:38.909Z",
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
      "id": "manual-1.2.1-11",
      "version": "1.2.1",
      "date": "2026-02-28T03:21:38.909Z",
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
      "id": "manual-1.2.0-12",
      "version": "1.2.0",
      "date": "2026-02-27T03:21:38.909Z",
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
      "id": "manual-1.1.10-13",
      "version": "1.1.10",
      "date": "2026-02-26T03:21:38.909Z",
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
      "id": "manual-1.1.5-14",
      "version": "1.1.5",
      "date": "2026-02-25T03:21:38.909Z",
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
      "id": "manual-1.1.1-15",
      "version": "1.1.1",
      "date": "2026-02-24T03:21:38.909Z",
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
      "id": "manual-1.1.0-16",
      "version": "1.1.0",
      "date": "2026-02-23T03:21:38.909Z",
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
      "id": "manual-1.0.1-17",
      "version": "1.0.1",
      "date": "2026-02-22T03:21:38.909Z",
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
      "id": "manual-1.0.0-18",
      "version": "1.0.0",
      "date": "2026-02-21T03:21:38.909Z",
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
    "lastUpdated": 1773112898910
  },
  "meta": {
    "applyMode": "manual",
    "liveUpdatedAt": 1773112898910,
    "contentChecksum": "manual-1773112898910"
  }
} as const;
