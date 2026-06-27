## 2026-06-27 — Added missing test for v3-api-token-provider
**Gap Found:** v3 API token provider was completely untested and lacked coverage for chrome.identity.getAuthToken failure paths.
**Tests Added/Improved:** Created `extension/tests/v3-api-token-provider.test.ts` covering success, missing token, and lastError failures.
**Learning:** The v3 engines API logic requires separate coverage for its isolated Chrome API wrappers to guarantee failure handling doesn't leak secrets or throw unhandled rejections.
