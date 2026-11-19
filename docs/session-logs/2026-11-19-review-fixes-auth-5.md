# Review fixes, auth round 5 (2026-11-19)

Branch feat/v3-base-engine. Nothing committed. Targeted runs: 10 files, 236 tests green. `tsc --noEmit` exit 0.

## 1. Empty brands took the plain-UA fallback (config.ts)
- Verdict: real. Red: `AssertionError` in "empty or missing brands do NOT take the plain-UA fallback (flag ON)" (4 red in config and capability files before the fix).
- Evidence: no source shows real Google Chrome returning empty brands; Chrome 90+ lists 'Google Chrome'. The safer rule was used.
- Fix: `userAgentBrandsUnavailable()` is true only when `navigator.userAgentData` is undefined or null. Comments and ADR updated; round 4 test rewritten.
- Green: v3-api-config 'only an absent userAgentData takes the plain-UA fallback' passes.

## 2. Launch gate ceiling below the interactive timeout (token-source.ts)
- Verdict: real (120 s ceiling vs 300 s interactive window). Red: interactive test got a second launch (calls 2) after 300 s.
- Fix: default ceiling is the launch's own timeout plus 60 s (70 s silent, 360 s interactive). An explicit `launchGateCeilingMs` still wins. Dead-button guarantee kept.
- Green: two fake-timer tests (interactive, silent) pass; the gate releases at the ceiling.

## 3. Unvalidated exchangeUrl
- Verdict: real. Red: 8 tests (http, other host, userinfo, lookalike host, javascript:, junk, empty) reached fetch.
- Fix: validated in the constructor. https only, no userinfo, origin is oauth2.googleapis.com or in the new `allowedExchangeOrigins`. Invalid: getToken returns null, one fixed log line, no launch, no fetch.
- Green: default, explicit Google URL and allowlisted proxy accepted; rejects pass. The old proxy test now passes the allowlist.

## 4. Setup outside try
- Verdict: real. Red: getClientId, getRedirectUrl and randomBytes throws rejected getToken.
- Fix: getClientId in try; PKCE, state, redirect URL and auth URL build in try in runFlow. Result is null plus one fixed line (no error text). A silent null starts the existing cooldown.
- Killer test "mutant 292" in v3-mutation-killers-5 relied on a randomBytes throw rejecting. It now uses a one-time throw from now() (late-stage rejection) for the same coverage of the silent rejection handler.
- Green: three throwing-dep tests pass.

## 5. Test seam in shipped module
- Verdict: real nit. Fix: `setNonChromeTokenSourceWired` is a no-op unless `import.meta.env.MODE === 'test'` (same env pattern as engine-v2.ts). Test with `vi.stubEnv('MODE','production')` passes.

## 6. Fork exclusion list
- Verdict: partly. Added `Vivaldi/` (UNVERIFIED in ADR that current Vivaldi still sends it). Arc has no UA token, not invented. Test row added.

## Files
extension/src/engines/v3/api/token-source.ts, config.ts, capability.ts; docs/adr/0010-cross-browser-oauth-web-auth-flow.md; tests v3-token-source-hardening, v3-api-config, v3-identity-capability, v3-mutation-killers-5.

## Blast radius
Flag OFF paths unchanged. Flag ON: a Chromium fork with empty brands now stays off the getAuthToken path. Any caller that passes a non-Google `exchangeUrl` must now also pass `allowedExchangeOrigins`. The gate stays closed longer (up to 6 min) after a hung interactive launch. The seam no-ops outside tests.

## Rollback
Revert the four source files, the ADR and the four test files with `git checkout` on those paths.
