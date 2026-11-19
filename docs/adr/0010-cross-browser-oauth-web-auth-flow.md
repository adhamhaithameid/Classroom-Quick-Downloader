# ADR-0010: Serve the API assist on non-Chrome browsers through launchWebAuthFlow with PKCE

- **Status:** proposed (owner decision + OAuth web client required before the flag can turn ON)
- **Date:** 2026-11-18. Rewritten 2026-11-19 (chat adr-browsers) with per-browser facts verified against official docs.
- **Deciders:** none yet
- **Scope:** the token source for the v3 API stack outside Google Chrome. The
  code scaffold (TokenSource, WebAuthFlowTokenSource, capability probe) landed
  behind the engineBase flag OFF in the same worktree; nothing ships changed.

## Decision

We will add a `browser.identity.launchWebAuthFlow` token source (Authorization
Code + PKCE S256, no client secret in the extension, token in memory only)
behind the existing
`engineBase` flag, so Edge, Brave, Opera, and Firefox users can get the same
API assist as Chrome, while Safari and non-extension hosts stay on the V2 DOM
engine with no error shown. The code exchange needs a secret-free path, which
Google documents only for installed-app clients (see Flow); until the owner
picks one, the exchange endpoint is injectable and nothing ships ON.

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

1. **launchWebAuthFlow with a secret-free exchange (chosen).** One extra
   owner-maintained client. The exchange runs in one of two ways, the owner
   decides: (a) a client type that Google lets exchange a code with PKCE alone
   (installed-app family; the redirect-URI fit for the `chromiumapp.org` and
   Firefox redirects is UNVERIFIED), or (b) a Web application client with a
   Worker-side exchange proxy that holds the secret (see option 3). The
   extension calls whichever endpoint `exchangeUrl` names. Works on every
   Chromium fork plus Firefox per the facts above.
2. **getAuthToken everywhere.** Rejected: Edge documents it unsupported;
   Firefox does not implement it; Chromium forks without Google sign-in
   cannot answer it. The current `isGoogleChromeBrand()` gate stays correct.
3. **Worker-side exchange proxy.** Review round 4 reopened this: a Web
   application client REQUIRES its secret at the token endpoint (see Flow),
   and a secret cannot live in an extension. A proxy that only forwards the
   code exchange (`exchangeUrl`) keeps the secret in the Worker and the access
   token in extension memory; the Worker never stores it. Cost: the feature
   depends on the Worker for sign-in, against the severed-backend posture
   (ADR-0009 world). Taken only if option 1(a) is not possible.
4. **No-auth DOM-only fallback (status quo).** Kept as the live default and
   as the landing state whenever the capability probe answers `'none'`.
   This is the decision if the owner declines the second client.

## Flow (chosen option)

- Client type: a Google Cloud OAuth client separate from the current
  Chrome-extension client. `getRedirectURL()` output feeds its *Authorized
  redirect URIs* — no wildcards. Which client type: see the secret finding.
- **Secret finding (review round 4, VERIFIED 2026-11-19, correcting an earlier
  wrong citation).** The earlier text cited the Web Server page for
  `client_secret` being "Optional". That is wrong. The "Optional" line is on
  the installed-app page, "OAuth 2.0 for iOS & Desktop Apps"
  (developers.google.com/identity/protocols/oauth2/native-app), token request
  table: "`client_secret` | **Optional** The client secret obtained from the
  Cloud Console Clients page." The Web Server page
  (developers.google.com/identity/protocols/oauth2/web-server) lists the same
  field without "Optional": "`client_secret` | The client secret that you
  obtain from the Cloud Console Clients page". So a Web application client
  must send its secret, and a PKCE-only exchange is documented for
  installed-app clients only. The code scaffold sends no secret; against a Web
  client Google would reject the exchange. Source read through the Context7
  mirror of the Google pages (the live pages are script-rendered).
- Authorization Code + PKCE S256, always. Exchange endpoint: `exchangeUrl`,
  default `https://oauth2.googleapis.com/token`. With a PKCE-only client type
  the default works as is. With a Web client the owner points `exchangeUrl`
  at a Worker proxy that adds the secret and forwards the request.
- `state`: random per flow, compared on return; a mismatch refuses the flow
  and `getToken` resolves null (it never throws) with one fixed log line.
- Token exchange: one `fetch` to `exchangeUrl` (default Google's token
  endpoint) with `code`, `client_id`, `redirect_uri`,
  `grant_type=authorization_code`, `code_verifier`. A proxy must forward the
  same fields, add the secret, and return Google's JSON unchanged.
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

1. A second OAuth client in the same Google Cloud project (same consent
   screen; Classroom API enabled), in ONE of two forms: (a) a client type that
   accepts a PKCE-only exchange, or (b) a **Web application** client plus a
   Worker exchange proxy that holds the secret. Pick (a) if Google accepts the
   `chromiumapp.org` and Firefox redirect URIs for that type (UNVERIFIED),
   else (b). If neither is acceptable, the decision is option 4 (DOM only).
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
- `state` random per flow; a mismatch resolves null before any token use.
- No client secret in the package, ever. Nothing secret ships in-repo. With a
  Web client the secret lives only in the Worker proxy's secret store.
- The returned redirect must equal the redirect URI by origin and path
  (parsed with `URL`), not by string prefix.
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
- **Step 1 (owner):** choose (a) or (b) above, mint the client (and deploy the proxy for (b)), register redirect URIs, confirm
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
  Chromium forks that ship brands are told apart by the explicit brand rule). Round 5 (finding 1, supersedes round 4's empty-brands rule, flag ON only):
  the fallback applies ONLY when `navigator.userAgentData` is undefined. An
  object with empty or missing `brands` stays false, because a non-Google Chromium
  fork could answer that way with a plain Chrome UA; no source shows real Google
  Chrome returning empty brands (Chrome 90+ lists `'Google Chrome'`). The fallback
  list also rejects `Vivaldi/` (UNVERIFIED that current Vivaldi builds still send
  it; older ones did). Arc sends no UA token, so it cannot be named. Flag OFF logic is unchanged.
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
  settles, capped at a ceiling (`launchGateCeilingMs`; default: that launch's own timeout
  plus 60 s, so 70 s silent and 6 min interactive, always above the window timeout
  and never reopening beside a window that may still be open) so a launch that
  never settles cannot disable sign-in for good; while it is closed a new flow
  resolves null (no second window), except that a click may open a window once
  a silent launch timed out. Cooldown and cache expiry survive a backward clock
  step (now before the stamp drops the cooldown and expires the cache). The
  token exchange is raced against a timer (a fetch that ignores its abort signal
  cannot hang the flow; late results are not cached). An error redirect resolves
  null even without `state`; a state mismatch on a success redirect resolves
  null too (logged once, no value in the line). The cached token is keyed by client id.
- **Exchange URL and setup (review round 5):** `exchangeUrl` must be https, carry
  no userinfo and use Google's token origin or an origin passed in
  `allowedExchangeOrigins` (a Worker proxy, explicit). The code, PKCE verifier,
  client id and redirect URI are POSTed there, so anything else makes `getToken`
  resolve null with one fixed log line and no launch. Client id, PKCE, redirect
  URL and auth URL setup run inside try: a throw is null plus one fixed line, never
  a rejection; a silent null starts the normal cooldown. `setNonChromeTokenSourceWired`
  is test-only and a no-op unless `import.meta.env.MODE` is `'test'`.
- **Rollback:** flip the flag default back to `'v2'`, remove the config key and any `exchangeUrl` wiring — the V2 DOM path is byte-identical to today.

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
  request: `client_secret` listed without "Optional" (required for Web clients).
- developers.google.com/identity/protocols/oauth2/native-app — token request:
  `client_secret` marked "Optional" (installed-app clients only). Both read
  through the Context7 mirror 2026-11-19.
- developers.google.com/identity/protocols/oauth2/scopes — verification
  statement. Classroom scope classification: UNVERIFIED.
- dev.opera.com — unreachable during verification (connect timeout).
