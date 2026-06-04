## 2026-03-19 — V3 Foundation: OAuth Token Lifecycle
**Issue Filed:** Apex: Implement v3 Engine OAuth Token Refresh with Mutex (apex-issue-1.md)
**V3 State Assessment:** V3 is currently a stub that delegates completely to V2. The Layer 0 Foundation (OAuth token fetching) has basic `chrome.identity.getAuthToken` but lacks any refresh logic, token invalidation, or protection against concurrent token requests (refresh storms). The API client does not catch 401 Unauthorized errors to trigger a retry. Discovery service and route context are partially mapped but incomplete.
**Next Logical Step:** Implement `AbortController` timeouts for all `GoogleClassroomApiClient` requests. Currently, API calls can hang indefinitely, which would block the V3 discovery process.
**Blockers Noticed:** We must build Layer 0 (Token and HTTP resilience) before we can build out Layer 1 (API Client full mapping) and Layer 2 (Discovery Pagination & Parsing).
