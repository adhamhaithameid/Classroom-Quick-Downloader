## 2026-06-21 — Added timeout and try/catch to fetch calls in classroom-api-client.ts
**Finding:** classroom API client lacked a timeout on fetch requests, which could cause requests to hang indefinitely. It also called `response.json()` without a try/catch, meaning malformed responses could crash the engine.
**Action:** Added an `AbortController` with a 15-second timeout to the `fetch` call and wrapped `response.json()` in a try/catch. Also added error handling for 401, 403, and 429 status codes to throw appropriate errors.
**Learning:** The classroom API is prone to timeouts and malformed responses. All fetch calls must include an `AbortController` timeout and proper try/catch wrapping around json parsing.
