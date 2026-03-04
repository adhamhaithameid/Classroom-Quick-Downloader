/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. */
export const EXTENSION_MANUAL_CHANGELOG = {
  "schemaVersion": "1",
  "ok": true,
  "source": "manual",
  "entries": [
    {
      "id": "manual-1.3.9-1",
      "version": "1.3.9",
      "date": "2026-03-04T06:33:00.438Z",
      "summary": "Current stable manual-changelog release.",
      "changes": [
        "Summary: Current stable manual-changelog release.",
        "Added: Manual changelog source flow and generated artifacts for deterministic releases.",
        "Changed: Strengthened website snapshot freshness behavior and changelog rendering stability.",
        "Fixed: Fixed stale website/session snapshot behavior that could show old numbers."
      ],
      "added": [
        "Manual changelog source flow and generated artifacts for deterministic releases."
      ],
      "changed": [
        "Strengthened website snapshot freshness behavior and changelog rendering stability."
      ],
      "fixed": [
        "Fixed stale website/session snapshot behavior that could show old numbers."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.3.8-2",
      "version": "1.3.8",
      "date": "2026-03-03T06:33:00.438Z",
      "summary": "Revision-aware changelog update.",
      "changes": [
        "Summary: Revision-aware changelog update.",
        "Added: Changelog revision checks for same-version republish scenarios.",
        "Changed: Update detection now compares version and content revision semantics.",
        "Fixed: Fixed missed changelog notifications when content changed without version increment."
      ],
      "added": [
        "Changelog revision checks for same-version republish scenarios."
      ],
      "changed": [
        "Update detection now compares version and content revision semantics."
      ],
      "fixed": [
        "Fixed missed changelog notifications when content changed without version increment."
      ],
      "isImportant": true
    },
    {
      "id": "manual-1.3.7-3",
      "version": "1.3.7",
      "date": "2026-03-02T06:33:00.438Z",
      "summary": "Changelog and UX polish release.",
      "changes": [
        "Summary: Changelog and UX polish release.",
        "Added: Website changelog integration from extension changelog actions.",
        "Changed: Improved popup changelog footer/action layout.",
        "Fixed: Fixed close-button position and hover issues."
      ],
      "added": [
        "Website changelog integration from extension changelog actions."
      ],
      "changed": [
        "Improved popup changelog footer/action layout."
      ],
      "fixed": [
        "Fixed close-button position and hover issues."
      ],
      "isImportant": true
    },
    {
      "id": "manual-1.3.6-4",
      "version": "1.3.6",
      "date": "2026-03-01T06:33:00.438Z",
      "summary": "Dependency compatibility maintenance release.",
      "changes": [
        "Summary: Dependency compatibility maintenance release.",
        "Added: Compatibility guardrails for extension dev/runtime tooling.",
        "Changed: Updated dependency wiring for browser dev flow.",
        "Fixed: Fixed `minimatch`/ESM export runtime failures during dev startup."
      ],
      "added": [
        "Compatibility guardrails for extension dev/runtime tooling."
      ],
      "changed": [
        "Updated dependency wiring for browser dev flow."
      ],
      "fixed": [
        "Fixed `minimatch`/ESM export runtime failures during dev startup."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.3.0-5",
      "version": "1.3.0",
      "date": "2026-02-28T06:33:00.438Z",
      "summary": "Major hardening and reliability release.",
      "changes": [
        "Summary: Major hardening and reliability release.",
        "Added: Stronger analytics resilience and security-oriented runtime checks.",
        "Changed: Improved analytics transport, buffering, and retry behavior.",
        "Fixed: Fixed cancellation accounting and flush edge-case inconsistencies."
      ],
      "added": [
        "Stronger analytics resilience and security-oriented runtime checks."
      ],
      "changed": [
        "Improved analytics transport, buffering, and retry behavior."
      ],
      "fixed": [
        "Fixed cancellation accounting and flush edge-case inconsistencies."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.2.7-6",
      "version": "1.2.7",
      "date": "2026-02-27T06:33:00.438Z",
      "summary": "Operations maturity and integration expansion release.",
      "changes": [
        "Summary: Operations maturity and integration expansion release.",
        "Added: Broader extension-to-dashboard and telemetry integrations.",
        "Changed: Improved ingestion and retry behavior across services.",
        "Fixed: Fixed auth/telemetry integration regressions found in production-like flows."
      ],
      "added": [
        "Broader extension-to-dashboard and telemetry integrations."
      ],
      "changed": [
        "Improved ingestion and retry behavior across services."
      ],
      "fixed": [
        "Fixed auth/telemetry integration regressions found in production-like flows."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.2.3-7",
      "version": "1.2.3",
      "date": "2026-02-26T06:33:00.438Z",
      "summary": "Usability and telemetry consistency release.",
      "changes": [
        "Summary: Usability and telemetry consistency release.",
        "Added: Better feedback/uninstall data capture integrations.",
        "Changed: Improved extension schema alignment with backend endpoints.",
        "Fixed: Fixed inconsistent telemetry fields in specific event paths."
      ],
      "added": [
        "Better feedback/uninstall data capture integrations."
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
      "id": "manual-1.2.2-8",
      "version": "1.2.2",
      "date": "2026-02-25T06:33:00.438Z",
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
      "id": "manual-1.2.1-9",
      "version": "1.2.1",
      "date": "2026-02-24T06:33:00.438Z",
      "summary": "Unified cancel system iteration release.",
      "changes": [
        "Summary: Unified cancel system iteration release.",
        "Added: Unified cancel-system handling for active operations.",
        "Changed: Refined cancel/retry UX behavior.",
        "Fixed: Fixed slow cancel-state reflection edge cases."
      ],
      "added": [
        "Unified cancel-system handling for active operations."
      ],
      "changed": [
        "Refined cancel/retry UX behavior."
      ],
      "fixed": [
        "Fixed slow cancel-state reflection edge cases."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.2.0-10",
      "version": "1.2.0",
      "date": "2026-02-23T06:33:00.438Z",
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
      "id": "manual-1.1.10-11",
      "version": "1.1.10",
      "date": "2026-02-22T06:33:00.438Z",
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
      "id": "manual-1.1.5-12",
      "version": "1.1.5",
      "date": "2026-02-21T06:33:00.438Z",
      "summary": "Mid 1.1 quality and compatibility release.",
      "changes": [
        "Summary: Mid 1.1 quality and compatibility release.",
        "Added: Expanded compatibility checks for supported browsers.",
        "Changed: Improved popup/runtime consistency.",
        "Fixed: Fixed minor behavior mismatches in repeated task flows."
      ],
      "added": [
        "Expanded compatibility checks for supported browsers."
      ],
      "changed": [
        "Improved popup/runtime consistency."
      ],
      "fixed": [
        "Fixed minor behavior mismatches in repeated task flows."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.1.1-13",
      "version": "1.1.1",
      "date": "2026-02-20T06:33:00.438Z",
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
      "id": "manual-1.1.0-14",
      "version": "1.1.0",
      "date": "2026-02-19T06:33:00.438Z",
      "summary": "Feature and packaging expansion release.",
      "changes": [
        "Summary: Feature and packaging expansion release.",
        "Added: Broader multi-browser support improvements.",
        "Changed: Updated setup/runtime behavior for wider compatibility.",
        "Fixed: Fixed packaging/config mismatches."
      ],
      "added": [
        "Broader multi-browser support improvements."
      ],
      "changed": [
        "Updated setup/runtime behavior for wider compatibility."
      ],
      "fixed": [
        "Fixed packaging/config mismatches."
      ],
      "isImportant": false
    },
    {
      "id": "manual-1.0.1-15",
      "version": "1.0.1",
      "date": "2026-02-18T06:33:00.438Z",
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
      "id": "manual-1.0.0-16",
      "version": "1.0.0",
      "date": "2026-02-17T06:33:00.438Z",
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
    },
    {
      "id": "manual-0.0.0-17",
      "version": "0.0.0",
      "date": "2026-02-16T06:33:00.438Z",
      "summary": "Initial project bootstrap baseline.",
      "changes": [
        "Summary: Initial project bootstrap baseline.",
        "Added: Initial extension scaffolding and project foundations.",
        "Changed: Set initial repository and extension structure.",
        "Fixed: N/A"
      ],
      "added": [
        "Initial extension scaffolding and project foundations."
      ],
      "changed": [
        "Set initial repository and extension structure."
      ],
      "fixed": [
        "N/A"
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
    "lastUpdated": 1772605980439
  },
  "meta": {
    "applyMode": "manual",
    "liveUpdatedAt": 1772605980439,
    "contentChecksum": "manual-1772605980439"
  }
} as const;
