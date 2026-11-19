# Session log — adr-browsers 2026-11-18 (chat 6)

Worktree: /Users/adhamhaithameid/Desktop/code/CQD-wt-v3base (branch
feat/v3-base-engine, BASE 9167c190 + chat 5's uncommitted work — untouched).
Uncommitted by contract — the owner commits. SDD ledger:
.superpowers/sdd/chat6-adr-browsers/progress.md (rulings, evidence).

## Result

Part A: ADR 0010 rewritten as a complete decision record (186 lines < 200) —
Context, Decision, four Options, flow, per-browser support table, owner
prerequisites, security, rollout, verification log. Every browser fact cites
an official source line; facts without one carry UNVERIFIED inline.

Part B: the non-Chrome auth path scaffolded behind the existing engineBase
flag, OFF by default — `TokenSource` seam + `WebAuthFlowTokenSource`
(Authorization Code + PKCE S256, state check, injected fetch, token in
memory), `probeIdentityCapability`, and the `isApiConfigured()` web branch.
All new tests red-then-green; coverage gate exit 0 (4758/4758 both profiles,
all-file 100/100/100/100). Zero shipped behavior change anywhere.

## Files changed

- REWRITTEN docs/adr/0010-cross-browser-oauth-web-auth-flow.md (186 lines).
- NEW extension/src/engines/v3/api/token-source.ts — `TokenSource`
  (getToken(interactive)), `ChromeRelayTokenSource` (delegates to the
  existing csaa.7 relay provider), `computePkceChallenge`/`createPkcePair`
  (RFC 7636 S256), `WebAuthFlowTokenSource` (PKCE, state reject, cancel →
  null, one silent re-auth on expiry, missing client id → null + one log
  line, no storage writes, no secret).
- NEW extension/src/engines/v3/api/capability.ts — pure
  `probeIdentityCapability({userAgent, apis, brands?, relayAvailable?}) →
  {identity: 'getAuthToken'|'webAuthFlow'|'none'}`.
- extension/src/engines/v3/api/config.ts — `oauth2.web_client_id` manifest
  type + non-Chrome branch: configured ONLY when web client id present AND
  `getEngineBase() === 'v3'` AND probe !== 'none'. Chrome path byte-identical
  (line 110 getAuthToken branch unchanged). Header comment updated (the
  module now imports the pure engine-base flag + pure probe only).
- NEW tests: extension/tests/v3-webauthflow-token-source.test.ts (14),
  extension/tests/v3-identity-capability.test.ts (10),
  extension/tests/v3-api-config.test.ts (+8 cases).
- NEW .superpowers/sdd/chat6-adr-browsers/progress.md.

## TDD evidence (exact quotes)

RED (before any implementation):

- `Error: Failed to resolve import "../src/engines/v3/api/token-source" from
  "tests/v3-webauthflow-token-source.test.ts". Does the file exist?`
- `Error: Failed to resolve import "../src/engines/v3/api/capability" from
  "tests/v3-identity-capability.test.ts". Does the file exist?`
- `AssertionError: expected false to be true` (config: Edge + Firefox with
  web client id + flag ON — the missing ADR-0010 branch).

GREEN (after implementation):

- `Test Files  3 passed (3)` / `Tests  44 passed (44)` for the three files.
- One mid-green fix was in a TEST, not the code: the "no relay" case stubbed
  `identity.launchWebAuthFlow` while claiming no source reachable; rewritten
  as a true no-source content-script stub. No production behavior changed.

Pinned behaviors: RFC 7636 Appendix B vector
(`dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` →
`E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`); state mismatch REJECTS
(`/state/i`); cancel/denial/exchange-failure → null; missing client id →
null + exactly one log line; expired token → exactly ONE silent re-auth
(`interactive: false`, no escalation loop); `storage.local`/`storage.session`
set never called; relay delegation passes interactive through.

## Verification (controller-run, fresh)

- `scripts/check extension` → `ok extension:typecheck`, `ok extension:test`,
  CHECK_EXIT=0 (after the implementation step).
- `pnpm -C extension test:coverage:all` → critical profile
  `Tests  4758 passed (4758)` + `All files | 100 | 100 | 100 | 100`;
  runtime profile `Tests  4758 passed (4758)` + `All files |
  100 | 100 | 100 | 100`; `COVERAGE_EXIT=0`. (4724 → 4758 = +34 new tests.)
- No exclusions added; no fixture or config tweaks.

## ADR facts — verified sources (quoted inside the ADR)

- developer.chrome.com identity page: getAuthToken oauth2-manifest contract;
  `getRedirectURL` → `https://<app-id>.chromiumapp.org/*`; launchWebAuthFlow
  + interactive semantics.
- MDN identity pages: Firefox exposes ONLY getRedirectURL +
  launchWebAuthFlow (no getAuthToken); FF75+ redirect rule; FF86 loopback;
  interactive-silent rule.
- learn.microsoft.com "Supported APIs for Microsoft Edge extensions":
  identity row + Unsupported APIs table — getAuthToken NOT supported,
  "As an alternate, you can use identity.launchWebAuthFlow..."; identity
  listed MV2/MV3 on Windows/Linux/Mac/Android.
- brave.com/learn: "any extension found in the Chrome Web Store will also
  work in Brave".
- MDN browser-compat-data webextensions/api/identity.json: launchWebAuthFlow
  chrome 29 / firefox 53 / opera 60 / safari FALSE (iOS mirror).
- rfc-editor.org/rfc/rfc7636: verifier 43–128 base64url chars; S256 = 
  BASE64URL-ENCODE(SHA256(ASCII(verifier))); Appendix B vectors.
- developers.google.com web-server OAuth page: token endpoint
  `https://oauth2.googleapis.com/token`; parameters; `client_secret`
  listed "Optional".
- developers.google.com scopes page: "If your public application uses scopes
  that permit access to certain user data, it must complete a verification
  process."

### UNVERIFIED items (listed per the brief)

1. The literal Firefox redirect pattern `https://<app-id>.extensions.allizom.org/`
   — MDN says only "a fixed domain name and a subdomain derived from the
   add-on's ID"; the literal domain string is not on the fetched pages.
2. Brave's `getAuthToken`/`launchWebAuthFlow` behavior — Brave publishes
   Chrome-Web-Store compatibility only; no identity-API statement found.
3. Opera's `getAuthToken` behavior — BCD pins launchWebAuthFlow ≥ 60;
   dev.opera.com was unreachable (connect timeout) for an official line.
4. Whether the three classroom scopes are classed "sensitive" or "restricted"
   — the scopes page does not label them in fetched text; the owner must
   read the consent-screen indicator.
5. An official Google statement that Chrome on Android hosts no extensions —
   third-party sources agree; no first-party quote found.
6. Apple's own Safari API list — the developer.apple.com page is
   script-rendered; Safari facts rest on MDN BCD (safari: false).

## What could break

- The scaffold is flag OFF and config-gated OFF (no web_client_id in the
  manifest) — the only risk path is code that imports config.ts, and the
  coverage gate proves both profiles green (4758/4758, 100%).
- If a future Edge build exposes `chrome.identity.getAuthToken` as a
  function, config line 110 (pre-existing branch) would report configured
  and tokens would fail silently to null → DOM verbatim (fallback matrix,
  no error). Same limitation as before this chat; now documented in the ADR.
- The web branch needs the `identity` permission in non-Chrome manifests —
  Firefox/Edge packaging manifests are owner-side rollout steps, not code.
- jsdom lacks SubtleCrypto: the token-source test stubs Node webcrypto
  (test-only); the production bundle uses the platform crypto.

## Rollback

Owner-run (never run by the agent), scoped to this chat's files:

    git checkout -- extension/src/engines/v3/api/config.ts \
      extension/tests/v3-api-config.test.ts
    rm -f extension/src/engines/v3/api/token-source.ts \
      extension/src/engines/v3/api/capability.ts \
      extension/tests/v3-webauthflow-token-source.test.ts \
      extension/tests/v3-identity-capability.test.ts
    git checkout -- docs/adr/0010-cross-browser-oauth-web-auth-flow.md

(chat 5's files are NOT in this list.)

## NEEDS-OWNER (no manifest/values touched in-lane)

1. `NEEDS-OWNER: manifest change — add oauth2.web_client_id (the Web
   application OAuth client id) when minted; no real value in-repo.`
2. Mint the web client; register per-browser redirect URIs (Chrome/Edge/
   Firefox ids incl. the QA companion); confirm scope verification status
   on the consent screen; publish the privacy policy URL (ADR §Owner).
3. Background relay fallback (serve WebAuthFlowTokenSource when
   getAuthToken is unavailable) — rollout step 2, outside this lane.

## Proposed beads (text only — no bd writes)

1. ADR-0010 rollout step 2: background token-source selection (relay →
   webAuthFlow fallback) + manifest web_client_id key.
2. ADR-0010 rollout step 3/4: Firefox/Edge canary flag flip + HITL login +
   store submissions.
3. storage.session token mirror decision (SW-restart consent frequency) —
   fold into bead 1's review.

## Rulings (full list in the SDD ledger)

0. In-session execution — subagent budget is DEAD until 2026-11-23
   (overnight-sweep memory); reviews replaced by quoted red-green evidence +
   the repo's mechanical gates. Cost: no independent reviewer pass.
1. Probe wired into the config gate only (background wiring is out of lane;
   NEEDS-OWNER). Cost: rollout PR must re-read the probe contract (pinned
   by standalone tests).
2. `relayAvailable` inside the probe lets Firefox content scripts report
   webAuthFlow when the background relay is reachable (csaa.7 stand-in
   precedent). Cost: over-reporting configured degrades silently to DOM
   verbatim — safe by construction.
3. Token storage is MEMORY ONLY in the scaffold; the ADR table says
   "memory only (scaffold)" and a storage.session mirror is a rollout
   decision. Cost: SW restarts drop the token; user repeats consent.
4. One RED→GREEN cycle fixed a self-contradictory TEST (no production
   change): the no-relay case must stub no identity surface at all.

## Open items

= NEEDS-OWNER 1-3 + proposed beads 1-3 above; ADR acceptance is the owner's
call (Status: proposed).
