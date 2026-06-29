
## 2026-06-29 — Parallelized sequential awaits for Website Console snapshot data
**Finding:** Sequential `await` calls were used to fetch `doStatus` and read `cachedRaw`/`kvRaw` from snapshot cache, blocking the event loop longer than necessary in the admin website console summary and snapshot endpoints.
**Action:** Replaced sequential awaits with `Promise.all()` in `cloudflare-worker/src/index.ts` to fetch DO status and KV snapshot in parallel.
**Learning:** Always look for independent async calls (like separate storage layer calls or external API calls) and run them concurrently using `Promise.all()` to improve edge latency.
