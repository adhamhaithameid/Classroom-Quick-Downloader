## 🔺 Apex — v3 Engine Implementation
**Agent:** Apex | **Day:** Thursday | **Date:** 2026-06-11

---

### 🗺️ V3 Implementation Context
The v3 engine is designed to extend the existing v2 engine by querying the Google Classroom API directly for assignments and attachments. Currently, v3 delegates all its functionality to the v2 engine and stubs out its API functionality (`extension/src/engines/v3/engine-v3.ts`). Some API discovery logic is stubbed out, but relies on `ChromeIdentityTokenProvider` inside `extension/src/engines/v3/api/token-provider.ts` to get a token using `chrome.identity.getAuthToken`. However, because v3 runs in a content script where `chrome.identity` is unavailable, fetching a token silently fails (returns `null`), blocking all further API functionality.

### 🔺 This Issue: Implement v3 engine OAuth token retrieval and refresh with background service worker bridge and mutex

### 🔍 Current State
Currently, `extension/src/engines/v3/api/token-provider.ts` attempts to call `chrome.identity.getAuthToken` directly from the content script. Since `chrome.identity` is unavailable in content scripts, it immediately returns `null` around line 5:
`if (typeof chrome === 'undefined' || !chrome.identity?.getAuthToken) return null;`
There is no background service worker bridge to actually retrieve the token on behalf of the content script, and there is no mutex logic to prevent concurrent token refresh storms when multiple API requests are made simultaneously from different content scripts.

### 💡 Proposed Implementation
Implement a messaging bridge to allow the v3 engine running in the content script to request an OAuth token from the background service worker:
- **Background Worker (`extension/entrypoints/background/index.ts` & `token-bridge.ts`):**
  - Implement a message listener that responds to a new message type (e.g., `CQD_GET_AUTH_TOKEN`).
  - Upon receiving the message, the background worker will call `chrome.identity.getAuthToken({ interactive: false })`.
  - Implement a mutex or promise cache in the background worker to ensure that if multiple content scripts request a token simultaneously (especially during token expiration/refresh), only one `chrome.identity` API call is active at a time, and all pending requests resolve with the same token result.
- **Content Script (`extension/src/engines/v3/api/token-provider.ts`):**
  - Refactor `ChromeIdentityTokenProvider.getAccessToken` to send the `CQD_GET_AUTH_TOKEN` message via `chrome.runtime.sendMessage` instead of trying to access `chrome.identity` directly.
  - Implement a callback with `chrome.runtime.lastError` checking to avoid unhandled promise rejections if the background worker is unavailable.
- **Scope Boundary:** This issue focuses solely on obtaining and refreshing the OAuth token safely. It does not implement API calling, caching of API responses, or discovery layer logic.

### 🎯 Why This Is the Next Step
OAuth token retrieval is **Layer 0** in the v3 implementation dependency graph. No Google Classroom API calls can be made until the content script can reliably obtain an OAuth token. Fixing the token provider unblocks the entire API Client (`classroom-api-client.ts`) and Discovery Service (`discovery-service.ts`) layers.

### 📐 Acceptance Criteria
- [ ] Background worker successfully intercepts the token request message and retrieves an OAuth token using `chrome.identity`.
- [ ] Mutex logic guarantees that multiple concurrent token requests from content scripts result in only one active `chrome.identity` call, avoiding a refresh storm.
- [ ] `token-provider.ts` successfully retrieves the token via messaging.
- [ ] Error handling: If `chrome.identity` fails, the background worker is unavailable, or a timeout occurs, the token provider cleanly returns `null`.
- [ ] Fallback: Since token retrieval returns `null` on failure, v3 will correctly fall back to v2 (handled by existing engine orchestration logic).
- [ ] Test: Unit tests added for `token-provider.ts` verifying the messaging bridge and `chrome.runtime.lastError` handling. Background worker tests verify the mutex prevents concurrent refresh calls.
- [ ] Integration: Message handlers explicitly return `true` for async responses to adhere to background worker task conventions.

### 🔧 Technical Context
- **Files to modify:**
  - `extension/src/engines/v3/api/token-provider.ts` (Refactor to use messaging bridge)
  - `extension/entrypoints/background/index.ts` (Register the new message handler)
  - `extension/entrypoints/background/` (Create a new `token-bridge.ts` or similar for the token fetch and mutex logic)
- **Tests to update/create:**
  - `extension/tests/v3-api-token-provider.test.ts`
  - Relevant background service worker test files.

### ⚠️ Key Risks and Constraints
- **OAuth token lifecycle risks:** `chrome.identity.getAuthToken` handles its own caching, but if a token is manually revoked or expired, the background script needs to handle the refresh correctly without hammering the API (hence the mutex).
- **Background unavailability:** The background service worker may go dormant. Content scripts using `chrome.runtime.sendMessage` must gracefully handle failure if the background worker doesn't wake up or errors out.
- **Single-maintainer context:** The token bridge must be well-documented and the mutex logic must be straightforward to debug so a developer can diagnose token issues easily.

### 📊 Estimated Complexity
Medium (3–5 days). Writing a message listener is simple, but ensuring robust Promise-based mutex caching across an ephemeral service worker requires careful state management and testing.

### 🔗 Related
None. This is the first foundational step to unblock the API client.
