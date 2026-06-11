## Vex: Update shell-quote to resolve critical vulnerability
**Issue:** `pnpm audit` identifies a critical vulnerability in `shell-quote` (>=1.1.0 <=1.8.3) where `quote()` does not escape newlines in object `.op` values (GHSA-w7jw-789q-3m8p).
**Impact:** It affects the `extension` via `wxt > web-ext-run > fx-runner > shell-quote`.
**Required Action:** The `pnpm-lock.yaml` file must be updated to force `shell-quote` to version `>=1.8.4` using `pnpm update` or `pnpm.overrides` in `package.json`.
