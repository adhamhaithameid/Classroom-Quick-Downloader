# ADR-0010: A launchWebAuthFlow token path for browsers without getAuthToken

- **Status:** proposed (DRAFT — owner decision + OAuth web client required before build)
- **Date:** 2026-11-18
- **Deciders:** none yet
- **Scope:** DOC ONLY. Nothing in this ADR is implemented. `isApiConfigured()`
  keeps returning false on these browsers, so the V1+V2 shadow fallback keeps
  serving them exactly as today.

## Context

The v3 API assist runs on `chrome.identity.getAuthToken`. That call only works
on Google Chrome:

- **Firefox** has no `getAuthToken` at all (gecko `browser.identity` exposes
  only `launchWebAuthFlow` / `getRedirectURL`).
- **Edge, Brave, Opera** ship the `identity` permission surface, but
  `getAuthToken` never answers there (Chromium brands without Google's
  sign-in implementation) — pinned by `isGoogleChromeBrand()` in
  `extension/src/engines/v3/api/config.ts`.

Today those users get the V1+V2 DOM-scraping engines, which work. The API
assist (course-wide enumeration, corroboration badges) is silently absent.
The audit of 2026-11-18 asked whether a cross-browser path is worth
designing. The 2026-11-15 bead 6s65 finding stands: Mozilla has no MV2
phase-out, so the store stays MV2 and there is no Firefox-user deadline
forcing this work.

## Decision

WHEN the owner provides an OAuth **Web application** client_id (a second
Google Cloud OAuth client, separate from the current installed-extension
client), we add a token provider built on `identity.launchWebAuthFlow`:

1. **Client type.** The current client is the "Chrome Extension / installed
   app" type that `getAuthToken` requires. `launchWebAuthFlow` needs a Web
   application client whose *Authorized redirect URIs* contain the exact
   extension redirect URL. Owner prerequisite: create that client in the
   same Google Cloud project (same org, same consent screen), enable only
   the Classroom API.

2. **Flow.** Authorization Code with PKCE (S256). A client secret cannot
   live in an extension, so PKCE is mandatory, not optional.
   - `state`: random per-flow value, compared on return (CSRF).
   - `redirect_uri`: `chrome.identity.getRedirectURL()` output, allowlisted
     exactly in the Google Cloud console (no wildcards — Google rejects
     them for web clients).
   - Scopes: the same three read-only scopes the manifest already declares
     (`classroom.coursework.me.readonly`,
     `classroom.coursework.students.readonly`,
     `classroom.courseworkmaterials.readonly`) plus `openid` so token
     revocation stays simple. No write scopes, ever.
   - Token exchange: one `fetch` to `https://oauth2.googleapis.com/token`
     from the background service worker.
   - Refresh token stored in `chrome.storage.local`, never synced
     (`storage.local`, not `storage.sync`), cleared on
     `identity.onAuthFlowExit`-equivalent sign-out and on token-revocation
     401s (the new `ClassroomApiAuthError` surfaces these).

3. **Wiring.** The provider implements the existing
   `ClassroomApiTokenProvider` interface and is selected per browser: the
   relay path (ADR: csaa.7, `CQD_API_TOKEN` → background `getAuthToken`)
   stays for Chrome; the web-flow provider activates where
   `isGoogleChromeBrand()` is false but `launchWebAuthFlow` exists. The
   background half of the relay (`entrypoints/background/api-token.ts`)
   gains a fallback: when `getAuthToken` is unavailable, it serves the
   web-flow provider — the content-script contract is unchanged.

4. **Gate.** `isApiConfigured()` grows one branch: brand lacks working
   `getAuthToken` AND `launchWebAuthFlow` exists AND the web client_id is
   configured AND a stored refresh token exists (or the user opts in).
   Until every clause holds, the gate stays false and nothing changes.

5. **Firefox packaging note.** AMO review: the flow is user-initiated
   (button click), the redirect stays inside the extension, and no
   telemetry leaves the flow — the privacy model of
   `docs/engine/api-assist-setup.md` carries over.

## Consequences

- Firefox/Edge/Brave/Opera users could get the API assist (faster, more
  accurate enumeration) without weakening the consent model.
- The owner carries a second OAuth client forever: consent-screen
  maintenance, verification renewals, and a redirect-URI allowlist that
  must be updated if the extension ID ever changes (new ID = new redirect
  URI = re-verification).
- Refresh-token lifecycle is now ours: expiry handling, revocation on 401,
  storage hygiene. `getAuthToken` gave Chrome's token cache for free; this
  path does not.
- AMO/Edge store review risk: `launchWebAuthFlow` usage draws scrutiny;
  the ADR keeps scopes read-only and user-initiated to stay defensible.
- Cost is real and the deadline is absent (no MV2 phase-out). Chrome users
  — the large majority of installs — already have the assist. This is why
  the ADR stays a draft: the owner should weigh the second-client
  maintenance against actual Firefox-user demand before any build starts.

## Alternatives Considered

- **Do nothing (status quo).** Firefox/Edge/Brave/Opera keep V1+V2 only.
  Zero cost, zero risk. This is the default if the owner declines the
  second OAuth client. Revisit only if Firefox telemetry (AMO average
  daily users, ~109 as of 2026-10) grows materially.
- **Ship a client secret in the extension.** Rejected: extractable from
  the package; an OAuth client secret in a public extension is a
  credential leak waiting for the next store scrape.
- **Ask users to paste a token from a script.** Rejected: phishing-shaped
  UX, no expiry handling, and it trains users to approve token requests
  outside the browser's consent surface.
- **Hosted proxy OAuth (website handles the flow).** Rejected for now: it
  moves token custody to the Worker and turns a local-only feature into a
  server-dependent one, contradicting the severance posture of ADR-0009's
  world (local gates, no required backend). Reconsider only with the
  Pro-tier licensing work (0h4d phase 2), which already needs server
  token custody.
