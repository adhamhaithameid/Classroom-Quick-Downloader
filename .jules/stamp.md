## 2026-06-10 — Found oracleBackend mismatch in data/changelog/release-version.manual.json and website/src/lib/content/release-version.manual.generated.json
**Extension Version (canonical):** 1.5.5
**Files Checked:** extension/package.json, data/changelog/release-version.manual.json, website/src/lib/content/release-version.manual.generated.json, website/src/lib/content/release-version.manual.generated.ts, extension/wxt.config.ts, data/changelog/extension-changelog.manual.md, oracle-backend/package.json, cloudflare-worker/package.json, website/package.json
**Discrepancies Found:**
- `data/changelog/release-version.manual.json` has oracleBackend `5.0.0`, but `oracle-backend/package.json` is `6.0.0`.
- `website/src/lib/content/release-version.manual.generated.json` and `.ts` have oracleBackend `5.0.0` but should be `6.0.0`.
**Action Taken:** Will fix
**Learning:** Found version mismatch in cross-component generated files for oracle-backend.
