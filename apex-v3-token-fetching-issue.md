---
title: "Apex: delegate v3 OAuth token fetching to background service worker with mutex protection"
---
## 🔺 Apex — v3 Engine Implementation
**Agent:** Apex | **Day:** Thursday | **Date:** 2026-07-02

---

### 🗺️ V3 Implementation Context
The v3 engine aims to augment DOM-based file discovery with Google Classroom API data. Currently, the v3 engine (`EngineV3`) is a stub that delegates completely to `EngineV2`. Its API integration (via `correlateWithApi`) is not implemented. More fundamentally, while the API client layer (`classroom-api-client.ts`, `token-provider.ts`) is sketched out, it has a fatal flaw: `ChromeIdentityTokenProvider` attempts to call `chrome.identity.getAuthToken` directly from the content script. In Manifest V3, this API is unavailable in content scripts and must be delegated to the background service worker.

### 🔺 This Issue: Delegate OAuth Token Fetching to Background Worker

### 🔍 Current State
`extension/src/engines/v3/api/token-provider.ts` implements `ChromeIdentityTokenProvider` which calls `chrome.identity.getAuthToken` directly. Since the v3 engine runs in the content script, this will fail or return `null` due to MV3 restrictions. There is currently no background message handler for token fetching.

### 💡 Proposed Implementation
Implement a runtime bridge for token fetching by delegating it to the background service worker:
- **Content Script (`token-provider.ts`):** Modify `ChromeIdentityTokenProvider` to use `chrome.runtime.sendMessage` to request an OAuth token from the background script instead of calling `chrome.identity` directly.
- **Background Worker (`extension/entrypoints/background/`):** Add a message listener that calls `chrome.identity.getAuthToken`.
- **Mutex Protection:** Implement a mutex in the background worker so that if multiple content scripts request a token simultaneously, only one `chrome.identity.getAuthToken` call is made. Waiters should queue and share the resulting token to prevent concurrent refresh storms or rate limiting.
- **Timeout:** Ensure the background message handler and the content script caller implement proper timeouts using an internal `AbortController` alongside a caller-provided `AbortSignal`.

### 🎯 Why This Is the Next Step
This addresses the very bottom of the dependency graph (Layer 0). Without a working token provider that correctly executes via the background worker, no API calls can be authenticated. Fixing this unblocks the rest of the API client and discovery service work.

### 📐 Acceptance Criteria
- [ ] Token fetching is delegated to the background service worker via message passing.
- [ ] Mutex logic in the background ensures concurrent token requests share a single `chrome.identity.getAuthToken` resolution.
- [ ] Timeouts are implemented using an internal `AbortController` alongside a caller-provided `AbortSignal`, explicitly checking `if (signal.aborted)` to avoid masking standard `AbortError`s.
- [ ] Error handling: If token fetching fails or times out, it gracefully returns `null` so v3 can fall back.
- [ ] Fallback: v3 correctly falls back to v2 if token fetching fails (no token = empty API snapshot, V2 DOM logic handles the rest).
- [ ] Test: Unit tests added/updated covering the message passing interface and timeout behaviors.
- [ ] Integration: EngineV3 does not crash when requesting a token in the content script environment.

### 🔧 Technical Context
- Modify `extension/src/engines/v3/api/token-provider.ts` to use message passing.
- Create or update background message handlers in `extension/entrypoints/background/`.
- Ensure async message handlers explicitly `return true` to keep the channel open for the async response.
- Note: Avoid top-level `setTimeout` or `setInterval` in the SW; use standard Promise-based mutex queues for in-memory orchestration of active requests.

### ⚠️ Key Risks and Constraints
- **OAuth Token Lifecycle:** Must avoid concurrent refresh storms. The mutex must gracefully release on failure.
- **MV3 SW Termination:** The mutex only needs to survive for the duration of the token fetch (a few seconds). If the SW terminates, the mutex is cleared, which is fine since pending messages will drop and fail safely.
- **Single-Maintainer Context:** Keep the mutex implementation simple and well-documented.

### 📊 Estimated Complexity
Medium (3–5 days). Requires careful cross-context message passing, Promise coordination for the mutex, and timeout synchronization.

### 🔗 Related
- `EXTENSION_GOLDEN_BEHAVIOR_MATRIX.md` (Authentication guidelines)
- Layer 0 prerequisite in `PLAN.md` (implied by API authentication needs).