## 2024-05-18 — Removed "accounts.google.com" from host_permissions
**Finding:** Found `https://accounts.google.com/*` in `host_permissions` in `wxt.config.ts`, but the extension did not use it or the `identity` permission.
**Action:** Removed it from `host_permissions` in `extension/wxt.config.ts` to reduce attack surface and adhere to least privilege.
**Learning:** `accounts.google.com` was previously present in the manifest likely as a leftover or speculative addition, but was completely unused by the source code since all authentication is handled via `chrome.identity.getAuthToken` which relies strictly on Manifest OAuth2 client configuration instead of manual requests.
