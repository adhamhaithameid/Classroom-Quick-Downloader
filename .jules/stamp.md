
## 2025-03-05 — Synced oracleBackend version across components
**Extension Version (canonical):** 1.5.5
**Files Checked:** data/changelog/release-version.manual.json, website/src/lib/content/release-version.manual.generated.json, website/src/lib/content/release-version.manual.generated.ts, oracle-backend/package.json
**Discrepancies Found:** `oracleBackend` version was `5.0.0` in `data/changelog/release-version.manual.json` and generated website files, but `6.0.0` in `oracle-backend/package.json`.
**Action Taken:** PR created. Updated `oracleBackend` to `6.0.0` in `data/changelog/release-version.manual.json`, `website/src/lib/content/release-version.manual.generated.json`, and `website/src/lib/content/release-version.manual.generated.ts`.
**Learning:** Manual JSON files referencing cross-component versions might drift when backend or worker components undergo separate version bumps, especially when not auto-syncing on release.
