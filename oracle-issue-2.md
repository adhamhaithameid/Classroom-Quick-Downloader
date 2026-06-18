---
title: "Oracle: Caddyfile missing rate limiting directives — DoS protection at proxy level"
---

## 🔮 Oracle — Backend Suggestion
**Agent:** Oracle | **Day:** Thursday | **Date:** 2026-06-18

---

### 🔧 Improvement Type
Operational / Security Hardening

### 🔍 Current State
The reverse proxy configuration in `oracle-backend/Caddyfile` currently proxies all traffic to the backend (`reverse_proxy oracle-backend:8080`) with zstd/gzip encoding. However, it lacks any rate-limiting directives. While the backend implements some application-level rate limits (e.g. `auth_rate_limits`), there is no proxy-level defense against volumetric attacks or misbehaving clients before the requests hit the Go application layer.

### 💡 Proposed Improvement
Add rate limiting at the Caddy reverse proxy layer.
- Update the `Caddyfile` to use the `rate_limit` directive (this may require ensuring Caddy is built with the `caddy-rate-limit` plugin, or using Caddy's built-in rudimentary limits if applicable).
- Configure a sensible global rate limit per IP for the main API endpoints (e.g., 100 requests per second per IP).
- Apply more stringent rate limits for specific sensitive or heavy endpoints, like authentication or heavy analytics queries if possible.

### 🎯 Why This Matters
For a single-maintainer service, sudden spikes in traffic (whether malicious or accidental) can easily overwhelm a single instance running both the application and the database. By dropping excessive requests at the proxy layer, we protect the Go application's connection pool, CPU, and the database from exhaustion. This directly contributes to survivability; if the maintainer is asleep, the system should naturally shed load rather than falling over.

### 📐 Acceptance Criteria
- [ ] Rate limiting directives are added to the `oracle-backend/Caddyfile`.
- [ ] Traffic exceeding the defined limit per IP is rejected with an HTTP 429 status code before reaching the backend.
- [ ] Legitimate traffic volumes are unaffected.
- [ ] Configuration is verified to be syntactically valid by Caddy.

### 🔧 Technical Context
- Modifying `oracle-backend/Caddyfile` to include rate limiting rules.
- If the default `caddy:2-alpine` image doesn't support the required rate limiting module, it might require a custom Dockerfile for Caddy (using `xcaddy`) to include the `github.com/mholt/caddy-ratelimit` plugin. This should be verified.

### 📊 Estimated Complexity
Small (1-2 days) — mostly involves modifying the `Caddyfile`. If a custom Caddy build is needed, it adds slight complexity to the `docker-compose.yml` and deployment process, but is still well within a small effort boundary.

### ⚠️ Risks and Considerations
The main risk is tuning the rate limit too aggressively and breaking legitimate use cases (e.g., bursts of telemetry ingestion from Cloudflare). The limits should be generous enough for normal operation but strict enough to prevent resource exhaustion. We should ensure the `rate_limit` module is available in the Caddy image being used.

### 🔗 Related
- `oracle-backend/Caddyfile`
- `oracle-backend/docker-compose.yml`
