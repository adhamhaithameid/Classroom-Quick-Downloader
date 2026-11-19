# Review fixes, auth, round 4 (2026-11-19)

Branch feat/v3-base-engine. Nothing committed by this session. Files: `extension/src/engines/v3/api/token-source.ts`, `config.ts`, `docs/adr/0010-cross-browser-oauth-web-auth-flow.md`, tests listed at the end.

## 1. Launch gate never released (REAL BUG)
- Verdict: real. Old code released `launchOpen` only in `launched.then(release, release)`; a never-settling launch kept every later `runFlow` at `if (this.launchOpen) return null;`.
- Red: new test "a never-settling launch frees the gate at the ceiling" and "a click may open a window once a SILENT launch timed out" failed (suite: 7 failed in hardening file, 9 in total before the fix).
- Fix: injectable `launchGateCeilingMs` (default 120000) timer releases the gate; a launch id stops a late settle of an old launch from reopening a newer gate; a click passes once a SILENT launch hit its window timeout (silent windows are invisible by contract). Silent callers stay gated; the earlier no-second-window rule holds up to the ceiling.
- Green: both tests pass; the "fast flow leaves no live timer" test still passes (gate timer cleared on settle).

## 2. client_secret on the token POST (REAL, ADR was wrong)
- Verdict: real. Source read through ctx7 (Context7 mirror of Google pages; live pages are script-rendered).
- Quote, installed-app page (native-app): "`client_secret` | **Optional** The client secret obtained from the Cloud Console Clients page."
- Quote, Web Server page (web-server): "`client_secret` | The client secret that you obtain from the Cloud Console Clients page" (no "Optional").
- The ADR cited the Web Server page for "Optional". Wrong page. A Web application client must send its secret. PKCE-only exchange is documented for installed-app clients.
- Red: test "the code exchange goes to an injected exchange URL" failed (option absent).
- Fix: `exchangeUrl` dep, default `https://oauth2.googleapis.com/token`; no secret in the extension. ADR decision, options, flow, owner prerequisites, rollout, security and verification log rewritten: owner picks (a) a PKCE-only client type (redirect-URI fit UNVERIFIED) or (b) a Web client plus a Worker exchange proxy.
- Green: custom-URL test and default-URL test pass.

## 3. State mismatch threw (REAL)
- Verdict: real. Old line: `throw new Error('[CQD Classroom] WebAuthFlow state mismatch ...')` against `Promise<string | null>` and a "never throws" header.
- Red: "a state mismatch resolves null, logs one fixed line, no exchange" failed, plus 3 updated old tests.
- Fix: log the fixed line once, return null. No state or redirect value in the line. The forged redirect is still refused (no exchange; test asserts `fetchImpl` not called).
- Green: all pass. Updated tests: v3-webauthflow-token-source (2), v3-token-source-hardening (1), v3-mutation-killers-2 (1, name and expectation).

## 4. Wall clock jumps (REAL)
- Verdict: real. Cache check `expiresAt > now()` and cooldown `now() - last < cooldown` both mishandle a backward step.
- Red: "a backward clock jump expires the cached token" and "... does not keep the silent cooldown" failed.
- Fix: the cache records `issuedAt`; `now() < issuedAt` is expired. For the cooldown, `elapsed < 0` clears the stamp. The injectable `now` is kept, so no test API change.
- Green: both pass. Limit: a forward jump still shortens the cooldown (unavoidable without a monotonic source; Date.now stays the default).

## 5. Redirect prefix check (NIT, real)
- Verdict: real but low risk. `redirect.startsWith(redirectUri)` accepted any extra path.
- Red: "a different path on the same origin resolves null" failed. The foreign-host-suffix test passed already (prefix with trailing slash); kept as a guard.
- Fix: parse both, compare `origin` and `pathname`, all inside the existing try.
- Green: pass.

## 6. Empty or missing brands (flag ON, REAL)
- Verdict: real. Old `userAgentDataAbsent()` was false for `{brands: []}` and `{}`, so the plain-Chrome UA fallback was skipped.
- Red: "treats empty or missing brands like no userAgentData (flag ON)" failed. The old test that expected false for `{brands: []}` was replaced by this one.
- Fix: `userAgentBrandsUnavailable()` (no object, no array, or empty). Flag OFF code untouched; parity test and a new flag-OFF empty-brands test pass. capability.ts needed no change.
- Green: v3-api-config 43 passed.

## Verification
- Targeted: token-source-hardening, webauthflow-token-source, api-config, identity-capability, identity-capability-hardening, mutation-killers, -2, -3, -4: 9 files, 208 tests passed.
- `pnpm exec tsc --noEmit -p .` exit 0.

## Blast radius
WebAuthFlowTokenSource has no caller (flag OFF, `NON_CHROME_TOKEN_SOURCE_WIRED` false), so shipped behavior is unchanged. `isApiConfigured` changes only with `engineBase` v3. Rollback: revert these files; no data or manifest change.

## Files
token-source.ts, config.ts, ADR 0010, v3-token-source-hardening.test.ts, v3-webauthflow-token-source.test.ts, v3-api-config.test.ts, v3-mutation-killers-2.test.ts, this log.
