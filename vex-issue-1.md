## Vex: Security Issue in Dependencies

### Issue Description
A critical vulnerability has been detected by `pnpm audit` in the `shell-quote` package, which is a transient dependency of `wxt`.
`shell-quote` `quote()` does not escape newlines in object `.op` values (CVE-2024-XXXX, GHSA-w7jw-789q-3m8p).

### Affected Paths
`extension>wxt>web-ext-run>fx-runner>shell-quote`

### Recommended Action
Update `shell-quote` to version `>=1.8.4` or wait for `wxt` to update its dependencies. Since Vex should not attempt to fix vulnerabilities in dependency versions directly, this issue is filed for tracking.
