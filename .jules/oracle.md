## 2026-06-18 — Schema migrations and Caddy rate limiting
**Issues Filed:**
- Oracle: add database migration version tracking — no way to know current schema version
- Oracle: Caddyfile missing rate limiting directives — DoS protection at proxy level
**Rationale:** For a single-maintainer backend, survivability is key. Without schema tracking, resolving deployment issues related to DB mismatch is very difficult. Without rate limiting at the proxy layer, the server is vulnerable to volumetric attacks that could take down the entire instance.
**Areas for Next Run:**
- Deep health check endpoint (currently `/health` only checks basic connectivity, not query execution).
- Prometheus `/metrics` endpoint for observability.
