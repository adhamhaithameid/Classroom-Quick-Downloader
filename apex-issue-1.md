---
title: "Apex: implement v3 background service worker message relay for Chrome Identity API"
---

## 🔺 Apex — v3 Engine Implementation
**Agent:** Apex | **Day:** Thursday | **Date:** 2026-03-19

---

### 🗺️ V3 Implementation Context
The v3 engine is the future API-based download engine designed to handle the Google Classroom API. Currently, it has a basic structure in `extension/src/engines/v3/` with stubs for its API discovery service, an engine class (`engine-v3.ts`), a token provider (`token-provider.ts`), a route context parser, and a cache.

The foundational issue lies in the OAuth token provider (`ChromeIdentityTokenProvider` in `extension/src/engines/v3/api/token-provider.ts`). It currently tries to call `chrome.identity.getAuthToken` directly from the context where the engine runs (which is the content script). However, the `chrome.identity` API is **not available in content scripts**; it can only be accessed from the background service worker. This means that, as currently implemented, Layer 0 of the dependency graph (OAuth token provider) is fundamentally broken and cannot successfully obtain a token when running in its normal environment.

### 🔺 This Issue: Implement v3 background service worker message relay for Chrome Identity API

### 🔍 Current State
In `extension/src/engines/v3/api/token-provider.ts`, the `getAccessToken` method relies on `chrome.identity.getAuthToken`. Because `engine-v3` executes in the content script context alongside the V2 engine (as controlled by the orchestrator and `engine-registry.ts`), `chrome.identity` is undefined, causing the method to immediately return `null`:
```typescript
if (typeof chrome === 'undefined' || !chrome.identity?.getAuthToken) return null;
```

### 💡 Proposed Implementation
1. **Background Service Worker Handler**: Add a message listener in the background script (e.g., in `extension/entrypoints/background/auth-utils.ts` or a new handler) to intercept a new message type like `CQD_V3_GET_AUTH_TOKEN`.
   - The handler must call `chrome.identity.getAuthToken` and return the resulting token (or null on failure).
   - The handler must gracefully handle concurrent requests (though a mutex logic to prevent refresh storms should be part of a separate issue or integrated here if simple enough, start with basic relaying).
2. **Content Script Token Provider Update**: Update `ChromeIdentityTokenProvider` in `extension/src/engines/v3/api/token-provider.ts` to use `chrome.runtime.sendMessage` to ask the background script for the token, rather than accessing `chrome.identity` directly.
   - It should expect an asynchronous response containing the token.
   - It must implement an `AbortController` timeout for the message request (e.g., 10 seconds) so that a hanging background script doesn't block the v3 engine initialization.

### 🎯 Why This Is the Next Step
This is Layer 0 in the v3 implementation dependency graph. Before `classroom-api-client.ts` can make authenticated requests to `classroom.googleapis.com`, it needs a valid OAuth token. Right now, it's impossible for it to get one because it attempts to use an unavailable API from the content script. Fixing this bridge unblocks the API client and subsequent discovery services.

### 📐 Acceptance Criteria
- [ ] The background service worker successfully listens for the new auth message and calls `chrome.identity.getAuthToken`.
- [ ] `ChromeIdentityTokenProvider` in the content script uses `chrome.runtime.sendMessage` to request the token and correctly awaits the response.
- [ ] The message request in the content script includes a timeout (e.g., 10s) to prevent hanging if the background worker fails to respond.
- [ ] Error handling: If the message fails, times out, or `chrome.identity` returns an error, the token provider safely returns `null`.
- [ ] Fallback: The v3 engine correctly proceeds with initialization but gracefully falls back to v2 (or does not attempt API integration) if the token is `null`.
- [ ] Test: A unit test is added/updated for `ChromeIdentityTokenProvider` mocking `chrome.runtime.sendMessage` and verifying the happy path and timeout/error paths.

### 🔧 Technical Context
- **Files to Modify**:
  - `extension/src/engines/v3/api/token-provider.ts`
  - `extension/entrypoints/background/auth-utils.ts` (or relevant background message handler)
  - `extension/src/engines/types.ts` (to define the new message type)
- **Key Functions**: `ChromeIdentityTokenProvider.getAccessToken`
- **Tests**: `extension/tests/v3-api-token-provider.test.ts` (create or update)

### ⚠️ Key Risks and Constraints
- **Content Script Isolation**: We must strictly adhere to Chrome extension architecture; UI/DOM logic stays in content scripts, sensitive/privileged APIs (like `chrome.identity`) stay in the background.
- **Background Worker Lifecycle**: Service workers can go to sleep. The message passing must correctly wake the worker.
- **Timeout Risk**: A hanging request to the background worker could stall the engine orchestrator. The timeout on the `sendMessage` call is critical.
- **Token Security**: Tokens are secrets and must not be logged or leaked into the DOM.

### 📊 Estimated Complexity
Small (1-2 days). The message passing pattern is already well-established in the repository. Implementing the timeout and ensuring tests cover the async messaging is the primary work.

### 🔗 Related
- Follows the v3 API plan outlined in `extension/docs/student-work-api-plan.md`.
- Unblocks future work on `classroom-api-client.ts` rate limiting and pagination.
