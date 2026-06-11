## 2026-06-11 — Migration Tracking and Proxy Rate Limiting
**Issues Filed:**
- Oracle: add database migration version tracking to schema initialization
- Oracle: Caddyfile missing rate limiting directives for proxy-level DoS protection
**Rationale:**
For a low-check-in, single-maintainer system, survivability is key. Modifying production databases without explicit version tracking risks corruption that requires manual intervention. Similarly, lacking rate limiting at the proxy layer forces the application to handle and shed all malicious traffic, which can exhaust resources. Both issues introduce critical defense-in-depth measures to protect the backend.
**Areas for Next Run:**
- Add idempotency key support to the `store_batch` handler to prevent duplicate analytics on retry.
- Improve `health` endpoint to perform a deep health check of PostgreSQL connectivity, not just SQLite.
- Paginate the unbounded query in the `pipeline` handler which could degrade performance.
