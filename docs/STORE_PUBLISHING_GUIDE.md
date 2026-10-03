# Store publishing guide — one-command three-store publish

This guide gives you a hands-free publish to AMO (Firefox), Chrome Web Store, and Edge Add-ons. You do it once to set up, then every release is one command.

## 1. What is already done

The workflow `.github/workflows/extension-stores.yml` (merged as PR #816) builds all three packages and publishes them through the store APIs. Repository secrets today:

| Store | Secrets | State |
|---|---|---|
| Firefox (AMO) | `AMO_JWT_ISSUER`, `AMO_JWT_SECRET` | Working |
| Edge | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_CLIENT_SECRET` | Working (configured 2026-10-03, not yet exercised end-to-end) |
| Chrome (CWS) | `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET` | Set — but the publish leg needs one more secret |

The missing piece: `CWS_REFRESH_TOKEN`. You mint it once with a Google consent screen. Sections 2-4 walk through it. Do them in Chrome, signed in to the Google account that owns the Chrome Web Store publisher account (`oemoongiefmpmomjikcjmkkkhffcbdid`).

## 2. Mint the Chrome refresh token (one-time, about 5 minutes)

1. Open https://developers.google.com/oauthplayground in Chrome.
2. Click the gear icon (OAuth 2.0 configuration, top right).
3. Select "Use your own OAuth credentials".
4. Paste the Client ID and Client secret of the **Web application** OAuth client you created on 2026-10-03 in Google Cloud Console (project `1002516920728`). If you lost the secret: Cloud Console → APIs and Services → Credentials → the web client → reset the secret there. Never paste the secret into chat, tickets, or this file.
5. In "Step 1 - Select and authorize APIs", type this scope in the input box and click "Authorize APIs":
   `https://www.googleapis.com/auth/chromewebstore`
6. Choose the Google account that owns the CWS publisher account. Google shows an unverified-app warning (the client is yours, unverified): click "Advanced" → "Go to (app name) (unsafe)" → "Continue". This is your own client; the warning is expected.
7. In "Step 2 - Exchange authorization code for tokens", click "Exchange authorization code for tokens".
8. Copy the `refresh_token` value from the JSON response (not the access token).

## 3. Store the token as a GitHub secret

Warnings first: the refresh token grants publish access to your CWS item. Do not paste it into chat, commits, or issues. To revoke it later: https://myaccount.google.com/permissions → remove the app, then mint a new one.

Run this and paste the token when prompted (the prompt keeps it out of shell history):

```
gh secret set CWS_REFRESH_TOKEN -R adhamhaithameid/Classroom-Quick-Downloader
```

## 4. Publish to all three stores

```
gh workflow run extension-stores.yml -R adhamhaithameid/Classroom-Quick-Downloader -f ref=main
```

Use `-f ref=v1.8.9` to publish a tag instead of main. The UI path: GitHub → Actions → "Extension Stores — Automated Publish (all three)" → "Run workflow" → pick the ref → Run.

Watch the run:

```
gh run list -R adhamhaithameid/Classroom-Quick-Downloader -w "Extension Stores — Automated Publish (all three)" --limit 1
gh run watch <run-id> -R adhamhaithameid/Classroom-Quick-Downloader
```

## 5. Verify each store published

| Store | Where to look | What you should see |
|---|---|---|
| AMO | `gh run watch` output + https://addons.mozilla.org/firefox/addon/classroom-quick-downloader/ | New version listed; the job polls AMO until indexing completes (10 min timeout) |
| Chrome | https://chrome.google.com/webstore/detail/oemoongiefmpmomjikcjmkkkhffcbdid + CWS Developer Dashboard | New version live; the workflow uploads and publishes (no draft step) |
| Edge | https://partner.microsoft.com/dashboard/microsoftedge/overview | New submission processed; Edge review then completes on Microsoft's side |

Artifacts (`cqd-chrome-zip`, `cqd-edge-zip`, `dist-firefox`) stay on the run for 14 days if you need to inspect a build.

## 6. Common errors and fixes

| Error | Cause | Fix |
|---|---|---|
| CWS leg skipped with a notice | `CWS_REFRESH_TOKEN` not set | Do sections 2-3 |
| `invalid_grant` on token refresh | Token revoked or expired (Google may expire unused tokens after ~6 months; revocation at myaccount.google.com) | Redo section 2, re-set the secret |
| CWS 401 / publisher error | Refresh token minted with a different Google account than the publisher | Redo section 2 signed in as the publisher account |
| AMO "Version already exists" | AMO versions are immutable; a version was published before (this is the most common store error in this repo's history) | Bump the extension version, commit, push, publish the new ref |
| Edge "Invalid client" | `EDGE_CLIENT_ID` / `EDGE_CLIENT_SECRET` mismatch with Partner Center | Regenerate the API key in Partner Center → publish API, re-set both secrets |
| Run green but store shows old version | Store review/index lag | AMO can lag minutes; CWS/Edge review is asynchronous — check again later |

## 7. Notes

- `publish: true` on the CWS leg means the upload goes straight to the published item, not to a draft. Make sure the version in `extension/manifest.json` is the one you want live.
- Edge secrets are set but the Edge leg has never run end-to-end. Treat the first dispatch as its test: if it fails, the error appears in the Actions log, not in any store.
- CWS 1.8.7 was already submitted for review by hand on 2026-10-03. A duplicate API publish of the same version will fail with "already exists" — publish the next version instead.
