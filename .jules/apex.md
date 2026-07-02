
## 2026-07-02 — [Planned Layer 0 Token Fetching with Mutex]
**Issue Filed:** Apex: delegate v3 OAuth token fetching to background service worker with mutex protection
**V3 State Assessment:** EngineV3 is a stub that delegates to EngineV2. The API integration `correlateWithApi` is not implemented. `ChromeIdentityTokenProvider` incorrectly attempts to use `chrome.identity.getAuthToken` directly from the content script, which is blocked in Manifest V3. The background service worker lacks the message handler and mutex protection required for safe token fetching.
**Next Logical Step:** Implement `EngineV3.correlateWithApi()` now that Layer 0 (token fetching) is addressed, so the API data can actually be compared with V2's DOM-discovered files and integrated into the result set.
**Blockers Noticed:** None at this stage. The token fetching issue must be resolved before proceeding with the remaining API client and discovery service work.
