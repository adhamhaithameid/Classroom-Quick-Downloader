## 🛡️ Vex — Security Issue Report
**Agent:** Vex
**Date:** $(date +%Y-%m-%d)

### 🚨 Issue: Vulnerable dependency in `pnpm audit`
The `pnpm audit` tool reported a critical vulnerability in the `shell-quote` package, which is a dependency of `web-ext-run` (used by `wxt` in the `extension` package). The vulnerable versions are `>=1.1.0 <=1.8.3`. A patched version (`>=1.8.4`) is available.

**Context:** The `shell-quote` package contains a vulnerability (GHSA-w7jw-789q-3m8p) where `quote()` does not escape newlines in object `.op` values.

**Recommendation:** Update the `pnpm` overrides in `package.json` to enforce `shell-quote` version `^1.8.4` or higher, or update the `web-ext-run` package to a newer version that relies on the patched `shell-quote` dependency.

Since I am strictly operating as Vex for manifest/permissions tasks, I cannot modify dependency versions or `pnpm-lock.yaml`. This issue requires attention to pass the CI checks and resolve the vulnerability.
