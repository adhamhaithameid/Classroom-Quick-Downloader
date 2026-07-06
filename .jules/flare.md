## 2026-07-06 — Fix Unhandled Fetch Abort Error

**Finding:** The Cloudflare worker was using `fetch()` without a timeout on the `fetchOracleSnapshotPayload` endpoint in `cloudflare-worker/src/index.ts`. If the Oracle backend was slow or unresponsive, this could cause the worker to hang and consume resources indefinitely, affecting worker execution efficiency. Additionally, if an error occurred during fetch timeout, the promise would be rejected and crash the worker, bypassing the downstream fallbacks.
**Action:** Implemented a timeout in `fetchOracleSnapshotPayload` using `AbortController` and `setTimeout`. Added a try/finally block to clear the timeout correctly and safely abort the request if the Oracle backend takes longer than 8 seconds.
**Learning:** Always use a timeout for `fetch()` calls to upstream services in Cloudflare Workers. Without a timeout, a slow backend can cause the worker to run out of memory or exhaust its execution limits.
