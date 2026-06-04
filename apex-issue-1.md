## 🔺 Apex — v3 Engine Implementation
**Agent:** Apex | **Day:** Thursday | **Date:** 2026-03-19

---

### 🗺️ V3 Implementation Context
The v3 engine is the future API-enhanced engine for the extension, intended to augment the V2 DOM-scraped data with reliable data from the Google Classroom API. Currently, v3 is minimally stubbed out:
- `EngineV3` delegates almost everything to `EngineV2` and throws "not yet implemented" or simply returns null/empty arrays for API integrations.
- The `ChromeIdentityTokenProvider` has a basic implementation of `chrome.identity.getAuthToken` but lacks robust error handling, token caching, expiration management, and refresh logic.
- The `GoogleClassroomApiClient` can make basic fetch requests to the API but does not gracefully handle 401s (token expiry) or 429s (rate limiting).
- Route context and discovery service are partially structured but incomplete.

### 🔺 This Issue: Implement v3 Engine OAuth Token Refresh with Mutex

### 🔍 Current State
In `extension/src/engines/v3/api/token-provider.ts`, the `ChromeIdentityTokenProvider` class has a basic `getAccessToken(interactive = false)` method. It requests a token via `chrome.identity.getAuthToken`. However, it does not implement any logic to handle invalid or expired tokens (e.g., calling `chrome.identity.removeCachedAuthToken`), nor does it handle concurrent token requests. If multiple API calls fail with a 401 simultaneously, they will all attempt to refresh the token at the same time, potentially causing a refresh storm and hitting API rate limits.

Additionally, the `GoogleClassroomApiClient` in `extension/src/engines/v3/api/classroom-api-client.ts` does not attempt to refresh the token and retry the request when a 401 Unauthorized response is received.

### 💡 Proposed Implementation
Implement robust token management and refresh logic for the Classroom API client:

1. **Mutex for Token Refresh:** Update `ChromeIdentityTokenProvider` to include a mutex or shared promise for token fetching/refreshing. If a token request is already in flight, subsequent calls should await the same promise rather than initiating new `chrome.identity.getAuthToken` calls.
2. **Invalidate Token Method:** Add a method (e.g., `invalidateToken(token: string)`) to `ClassroomApiTokenProvider` and implement it in `ChromeIdentityTokenProvider` using `chrome.identity.removeCachedAuthToken`.
3. **Automatic Retry on 401:** Update `GoogleClassroomApiClient.fetchStudentSubmissions` (and any future API methods) to catch 401 Unauthorized responses. On 401, it should call `invalidateToken`, then request a new token, and retry the fetch request exactly once.
4. **Scope Boundary:** Do NOT implement rate limit backoff (429 handling) or full API pagination/caching in this issue. Focus strictly on the OAuth token lifecycle.

### 🎯 Why This Is the Next Step
This is a **Layer 0 Foundation** requirement. Before the v3 API client can reliably fetch data or the discovery service can function, the extension must be able to maintain a valid OAuth token. Without robust refresh logic and concurrent refresh protection, the engine will fail randomly when tokens expire, degrading the user experience and violating the requirement that v3 must be reliable. This unblocks all further API client work (Layer 1).

### 📐 Acceptance Criteria
- [ ] `ChromeIdentityTokenProvider` uses a shared promise/mutex to ensure only one `chrome.identity.getAuthToken` call is active at a time.
- [ ] `ClassroomApiTokenProvider` interface includes a method to invalidate a token, implemented via `removeCachedAuthToken`.
- [ ] `GoogleClassroomApiClient` catches 401 responses, invalidates the bad token, and retries the request with a fresh token (max 1 retry).
- [ ] **Fallback:** If the token cannot be obtained or the retry fails, the API client returns an empty array/null, allowing v3 to gracefully fall back to v2 DOM scanning.
- [ ] **Test:** Add unit tests for `ChromeIdentityTokenProvider` verifying the mutex prevents duplicate calls, and for `GoogleClassroomApiClient` verifying the 401 retry behavior.
- [ ] **Integration:** Tokens must never be logged or exposed in errors.

### 🔧 Technical Context
- **Files to modify:**
  - `extension/src/engines/v3/api/types.ts` (update `ClassroomApiTokenProvider` interface)
  - `extension/src/engines/v3/api/token-provider.ts` (implement mutex and invalidation)
  - `extension/src/engines/v3/api/classroom-api-client.ts` (add 401 retry logic)
- **Tests to add:**
  - Create `extension/tests/v3-api-token-provider.test.ts`
  - Create `extension/tests/v3-api-classroom-client.test.ts`

### ⚠️ Key Risks and Constraints
- **OAuth token lifecycle risks:** Chrome's identity API can be finicky. The mutex must gracefully release on both success and error to prevent permanent deadlocks.
- **Security:** Tokens must be treated as secrets. Do not log them.
- **Single-maintainer context:** The token logic must be clearly documented so a maintainer returning after weeks can easily understand the retry flow.
- **Fallback correctness risks:** If the token flow fails permanently (e.g., user revokes access), it must silently fail and let v2 handle the page.

### 📊 Estimated Complexity
**Small (1–2 days)** — The required Chrome APIs are well-understood. The mutex pattern in JS is straightforward using promises. The main work is wiring the retry logic safely and writing robust unit tests with mocked Chrome APIs.

### 🔗 Related
- `extension/docs/student-work-api-plan.md`
- No previous Apex Issues. This is the first step in the v3 implementation roadmap.
