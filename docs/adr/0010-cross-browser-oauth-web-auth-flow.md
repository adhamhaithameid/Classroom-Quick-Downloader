# ADR-0010: Serve the API assist on non-Chrome browsers through launchWebAuthFlow with PKCE

- **Status:** proposed (owner decision + OAuth web client required before the flag can turn ON)
- **Date:** 2026-11-18. Rewritten 2026-11-19 (chat adr-browsers) with per-browser facts verified against official docs.
- **Deciders:** none yet
- **Scope:** the token source for the v3 API stack outside Google Chrome. The
  code scaffold (TokenSource, WebAuthFlowTokenSource, capability probe) landed
  behind the engineBase flag OFF in the same worktree; nothing ships changed.

## Decision

We will add a `browser.identity.launchWebAuthFlow` token source (Authorization
Code + PKCE S256, no client secret, token in memory only) behind the existing
`engineBase` flag, so Edge, Brave, Opera, and Firefox users can get the same
API assist as Chrome, while Safari and non-extension hosts stay on the V2 DOM
engine with no error shown.

## Context

The v3 API assist runs on `chrome.identity.getAuthToken`. That call works on
Google Chrome only:

- **Firefox** documents `browser.identity` with exactly two functions,
  `getRedirectURL` and `launchWebAuthFlow`; no `getAuthToken` exists there.
  Source: MDN, "identity API" page lists only the two functions and says
  "This API is based on Chromium's chrome.identity API" — with no
  `getAuthToken` anywhere on the page.
- **Microsoft Edge** documents `identity.getAuthToken` under "Unsupported
  APIs": "As an alternate, you can use `identity.launchWebAuthFlow` to fetch
  an OAuth2 token to authenticate users."
  Source: learn.microsoft.com "Supported APIs for Microsoft Edge extensions",
  identity row and Unsupported APIs table (MV2, MV3; Windows, Linux, Mac,
  Android).
- **Brave**: "any extension found in the Chrome Web Store will also work in
  Brave" (brave.com/learn). Brave publishes no identity-API statement; its
  `getAuthToken` behavior is UNVERIFIED.
- **Opera**: MDN browser-compat-data pins `identity.launchWebAuthFlow` at
  Opera 60. Opera publishes no reachable identity statement (dev.opera.com
  timed out during verification); its `getAuthToken` behavior is UNVERIFIED.
- **Safari (macOS and iOS)**: MDN browser-compat-data lists
  `identity.launchWebAuthFlow` and `identity.getRedirectURL` as
  `safari: false` (iOS mirrors desktop). The identity API is not available;
  Apple's own page is script-rendered and could not be quoted.
- **Chrome on Android** is not an extension host. Google states no official
  line we could quote; third-party reports agree the stable browser cannot
  install extensions. UNVERIFIED as an official statement. Contrast: Edge
  officially lists Android as a platform for its identity API, so an
  Android-Chromium fork may appear later — the capability probe already
  covers that case.

Chrome users keep the current path: `getAuthToken` "Gets an OAuth2 access
token using the client ID and scopes specified in the `oauth2` section of
manifest.json" (developer.chrome.com), with Chrome's own token cache. The
2026-11-15 bead 6s65 finding stands: Mozilla has no MV2 phase-out, so no
Firefox-user deadline forces this work — cost, not urgency, decides.

## Options considered

1. **launchWebAuthFlow + a Web application OAuth client (chosen).** One
   extra owner-maintained client; PKCE covers the missing secret. Works on
   every Chromium fork plus Firefox per the facts above.
2. **getAuthToken everywhere.** Rejected: Edge documents it unsupported;
   Firefox does not implement it; Chromium forks without Google sign-in
   cannot answer it. The current `isGoogleChromeBrand()` gate stays correct.
3. **Worker-side OAuth proxy.** Rejected: it moves token custody to the
   Worker and makes a local-only feature server-dependent, against the
   severed-backend posture (ADR-0009 world). Revisit only with Pro-tier
   licensing, which already needs server token custody.
4. **No-auth DOM-only fallback (status quo).** Kept as the live default and
   as the landing state whenever the capability probe answers `'none'`.
   This is the decision if the owner declines the second client.

## Flow (chosen option)

- Client type: a Google Cloud **Web application** OAuth client, separate
  from the current Chrome-extension client. `getRedirectURL()` output feeds
  its *Authorized redirect URIs* — no wildcards.
- Authorization Code + PKCE S256. PKCE is mandatory, not optional: "A client
  secret cannot live in an extension. Google lists `client_secret` as
  "Optional" in the token request, which makes a secret-less exchange
  possible." Source: developers.google.com "OAuth 2.0 for Web Server
  Applications", token-request parameter table.
- `state`: random per flow, compared on return; a mismatch rejects the flow.
- Token exchange: one `fetch` to `https://oauth2.googleapis.com/token` with
  `code`, `client_id`, `redirect_uri`, `grant_type=authorization_code`,
  `code_verifier` (same source as above).
- Scopes: the three read-only classroom scopes the manifest already declares
  plus `openid`. No write scopes, ever.
- Token lifetime: access token in memory with its expiry; ONE silent
  re-auth (`interactive: false`) when expired; interactive consent only on a
  user action. No refresh token is requested, stored, or synced.
- Wiring: the new `WebAuthFlowTokenSource` implements the same `TokenSource`
  seam as the Chrome relay. `isApiConfigured()` answers configured on a
  non-Chrome browser ONLY when a web client id is present AND the `engineBase`
  flag is ON. Default stays false everywhere; flag OFF is byte-identical.

## Per-browser support table

| Browser | Identity API available | Redirect URL form | Token storage | Refresh path | Store policy risk |
|---|---|---|---|---|---|
| Chrome | `getAuthToken` (existing relay) | `https://<app-id>.chromiumapp.org/*` (chrome.dev docs) | Chrome's token cache | Chrome-managed | none — unchanged path |
| Edge (desktop `Edg/`, Android `EdgA/`) | `launchWebAuthFlow` (`getAuthToken` unsupported — MS docs) | `https://<id>.chromiumapp.org/` | memory only (scaffold) | none — one silent re-auth | low — documented alternate API |
| Brave | Chromium surface; specifics UNVERIFIED | `https://<id>.chromiumapp.org/` | memory only (scaffold) | none — one silent re-auth | UNVERIFIED review posture |
| Opera | `launchWebAuthFlow` since 60 (MDN BCD) | `https://<id>.chromiumapp.org/` | memory only (scaffold) | none — one silent re-auth | low |
| Firefox | `launchWebAuthFlow` + `getRedirectURL` only (MDN) | `getRedirectURL()` output — "fixed domain ... derived from the add-on's ID" (MDN); literal `https://<app-id>.extensions.allizom.org/` pattern UNVERIFIED | memory only (scaffold) | none — one silent re-auth | medium — AMO review scrutiny; keep flow user-initiated and telemetry-free |
| Safari (macOS) | none — identity API `false` (MDN BCD) | n/a | n/a | n/a | none — feature absent by probe |
| Safari (iOS) | none — mirrors desktop `false` | n/a | n/a | n/a | none — feature absent by probe |
| Edge (iOS, `EdgiOS/`) | none — WebKit shell, no extension host (decision, review round 2 finding 6) | n/a | n/a | n/a | none — feature absent by probe |
| Chrome on Android | not an extension host (UNVERIFIED official line) | n/a | n/a | n/a | none — feature absent |

Firefox notes: since Firefox 75 the redirect must be the `getRedirectURL()`
output; since Firefox 86 the loopback form
`http://127.0.0.1/mozoauth2/<subdomain>` is also allowed (MDN). Set the
add-on ID explicitly (`browser_specific_settings`) or every temporary
install gets a new redirect URL (MDN). The silent re-auth window may need
`interactive: true` on user action in Firefox — MDN: with `interactive`
omitted or false "the flow is forced to conclude silently ... if the service
provider needs to interact with the user, the flow will just fail."

## What the OWNER must provide

1. An OAuth **Web application** client_id (second client, same Google Cloud
   project, same consent screen; Classroom API enabled).
2. Authorized redirect URIs per browser: the exact `getRedirectURL()` output
   for every shipped build (Chrome id, Edge id, Firefox AMO id + QA-companion
   id). A new extension id = new redirect URI = re-verification.
3. The Google OAuth verification status for the three classroom scopes:
   Google says "If your public application uses scopes that permit access to
   certain user data, it must complete a verification process" and sensitive
   scopes carry an indicator on the consent-screen page. Whether the
   classroom coursework scopes are classed sensitive or restricted is
   UNVERIFIED — read the consent-screen indicator before filing.
4. A privacy policy URL (the consent screen and all three stores require one
   for this data).

`NEEDS-OWNER: manifest change — a web client id config key (e.g.
`oauth2.web_client_id`) read by the token source; no real value in-repo.`

## Security

- PKCE S256 always; the verifier is 43–128 base64url characters and the
  challenge is `BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))` (RFC 7636;
  test vectors pinned from its Appendix B).
- `state` random per flow; mismatch rejects before any token use.
- No client secret in the package, ever. Nothing secret ships in-repo.
- The access token lives in memory for the session; `storage.local` and
  `storage.sync` never receive tokens (test-pinned). No refresh token exists.
- Least scope: three classroom read-only scopes + `openid`. Revocation
  stays a user side action; a revoked token fails as any 401 does today
  (`ClassroomApiAuthError`), and the user repeats consent on the next click.
- No telemetry leaves the flow; the consent model (#398) is unchanged —
  API fetches run only after the user picks 'API (beta)'.

## Rollout plan

- **Step 0 (this worktree, flag OFF):** scaffold landed — `TokenSource`
  seam, `WebAuthFlowTokenSource`, capability probe, `isApiConfigured()` web
  branch. Zero shipped behavior change anywhere.
- **Step 1 (owner):** mint the web client, register redirect URIs, confirm
  scope verification status, publish the privacy policy.
- **Step 2 (owner PR):** add the web-client-id config to the manifest
  (NEEDS-OWNER above). Gate still false until the flag flips.
- **Step 3 (flag ON canary):** Firefox + Edge builds with `engineBase`
  flipped; QA companion installs first; real login HITL pass.
- **Step 4 (stores):** submit AMO + Edge + Opera updates. Chrome can adopt
  the same source later for a single code path; not required.
- **Gate (review fix #4):** `isApiConfigured()` returns false on non-Chrome
  until `NON_CHROME_TOKEN_SOURCE_WIRED` (v3/api/config.ts) is flipped to
  `true`. Flip it in the PR that wires `WebAuthFlowTokenSource` into
  engine-v3 and the background relay; its pinning test flips with it.
- **Checklist (review fix #9):** every JS context (background, content
  scripts, popup, options) must read the same persisted `engineBase` value
  from chrome.storage before the flag is enabled. `engine-base.ts` is
  per-context module state today and nothing sets it.
- **Google Chrome brand rule (review fixes #1-#3):** `getAuthToken` is chosen
  only on an explicit `'Google Chrome'` entry in `navigator.userAgentData`
  brands, through one shared function (`isGoogleChromeBrand`, capability.ts).
  Tradeoff: a real Chrome without `userAgentData` (Chrome older than 90, or
  an insecure context) is classed webAuthFlow, not getAuthToken. That is the
  safe direction: it never calls a function Brave, Edge or a fork cannot
  answer. Edge tokens match `Edg(?:A)?/` (desktop, Android); `EdgiOS/` is answered
  `'none'` explicitly before the Edge branch.
- **No-userAgentData fallback (review round 2, finding 7):** `isApiConfigured()`
  keeps the explicit-brand rule. Only a context with NO `navigator.userAgentData`
  object (Chrome older than 90, an insecure context) falls back to a plain
  Chrome UA (`isPlainChromeUserAgent`: `Chrome/` and no Edg, OPR, Opera, Brave,
  Chromium, Firefox, HeadlessChrome, SamsungBrowser, YaBrowser or Whale marker),
  so real Google Chrome keeps its pre-ADR answer there. Brave sends no UA token:
  without `userAgentData` brands it cannot be told apart from Chrome, so the
  fallback exists only for contexts with no `userAgentData` object at all (all
  Chromium forks that ship brands are told apart by the explicit brand rule). Present-but-empty or present-without-Google-Chrome brands stay false.
  MDN: "`WorkerNavigator.userAgentData` ... only available in Web Workers" and
  in secure contexts, so the MV3 background normally has brands; that the
  extension service worker specifically exposes them is UNVERIFIED by an explicit
  Chrome statement.
- **Flag OFF is unchanged (review round 3, finding 1):** with `engineBase`
  `'v2'` (the default) `isApiConfigured()` returns EXACTLY what the base
  (origin/fix/api-engine-token-relay) returned: true whenever
  `chrome.identity.getAuthToken` exists and a client id is set; in a content
  script, identity permission + client id + explicit `'Google Chrome'` brand. A
  parity test compares flag OFF for Chrome, Edge, Brave, Opera and contexts with
  no `userAgentData`.
- **Behavior change for Brave, Edge, Opera (flag ON, `engineBase` `'v3'` only):**
  these brands expose `getAuthToken` but cannot answer it, so with the flag ON
  `isApiConfigured()` is false on the getAuthToken path there (unless the web
  client id path applies) and the registry falls back to the V2 DOM engine
  instead of an engine that can never fetch. Google Chrome is unchanged.
- **Token source behavior (review rounds 2 and 3):** an interactive request
  (user click) bypasses the silent-retry cooldown and always opens the auth
  window, also after expiry; a silent flow in flight does not swallow the click
  (the click runs after it). Every failed silent attempt, the first included,
  starts the cooldown. The auth window is raced against a timeout (10 s silent,
  5 min interactive; the silent value is short because a queued click waits for
  the silent flow: worst case 10 s launch + 15 s exchange). `launchWebAuthFlow`
  has no cancel, so a launch gate stays closed until the underlying launch
  settles; while it is closed a new flow resolves null (no second window). The
  token exchange is raced against a timer (a fetch that ignores its abort signal
  cannot hang the flow; late results are not cached). An error redirect resolves
  null even without `state`; a state mismatch on a success redirect still
  rejects. The cached token is keyed by client id.
- **Rollback:** flip the flag default back to `'v2'` and remove the config
  key — the V2 DOM path is byte-identical to today.

## Verification log (2026-11-19)

- developer.chrome.com/docs/extensions/reference/api/identity — getAuthToken,
  launchWebAuthFlow, `https://<app-id>.chromiumapp.org/*`, interactive flags.
- MDN identity, launchWebAuthFlow, getRedirectURL pages — Firefox surface,
  FF75/FF86 notes, interactive semantics.
- learn.microsoft.com/.../extensions/developer-guide/api-support — Edge
  identity row + Unsupported APIs table, quoted above.
- brave.com/learn/using-chrome-extensions-in-brave — Web Store compatibility,
  quoted above.
- MDN browser-compat-data `webextensions/api/identity.json` — opera 60,
  safari false, safari_ios mirror.
- rfc-editor.org/rfc/rfc7636 — verifier rules + Appendix B vectors.
- developers.google.com/identity/protocols/oauth2/web-server — token
  endpoint, parameters, `client_secret` "Optional".
- developers.google.com/identity/protocols/oauth2/scopes — verification
  statement. Classroom scope classification: UNVERIFIED.
- dev.opera.com — unreachable during verification (connect timeout).
