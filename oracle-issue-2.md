## 🔮 Oracle — Backend Suggestion
**Agent:** Oracle | **Day:** Thursday | **Date:** 2026-06-11

---

### 🔧 Improvement Type
Security Hardening / Operational

### 🔍 Current State
The `oracle-backend/Caddyfile` acts as the reverse proxy for the backend service. Currently, it simply binds to the specified port (`8080`) or host (`{$ORACLE_PUBLIC_HOSTNAME}`) and proxies all incoming requests directly to the `oracle-backend:8080` container. There are no rate-limiting directives configured at the proxy level. This leaves the backend entirely exposed to unbounded traffic spikes, DoS attacks, or misconfigured clients hammering the API, requiring the Go application itself to handle all request shedding.

### 💡 Proposed Improvement
Add native rate limiting to the `Caddyfile` using the `rate_limit` directive (which may require the `http.handlers.rate_limit` Caddy module).
Specifically:
- Configure a global rate limit for the entire backend (e.g., max 1000 requests per IP per minute) to prevent abusive scraping or DoS.
- Configure stricter rate limits for specific sensitive or resource-intensive paths (e.g., `/api/auth/` endpoints, `/api/pipeline/` querying endpoints) to prevent brute-force attacks or database exhaustion.
- Ensure rate-limited requests return a standard HTTP 429 Too Many Requests response with a `Retry-After` header.

### 🎯 Why This Matters
For a system maintained by one person who checks in monthly, defense-in-depth is essential for survivability. If a malicious script or a runaway client begins hammering the backend, the lack of proxy-level rate limiting means the Go application must process and reject every single connection, potentially exhausting CPU, memory, or database connection pools. By dropping excessive traffic at the Caddy layer, the application remains stable and available for legitimate users during an attack, preventing an incident that would otherwise require manual intervention.

### 📐 Acceptance Criteria
- [ ] Rate limiting configuration is added to `oracle-backend/Caddyfile`.
- [ ] Global IP-based rate limiting is enforced for all routes.
- [ ] Stricter rate limits are defined for sensitive paths like `/api/auth/`.
- [ ] Requests exceeding the limit receive an HTTP 429 response.
- [ ] The custom Caddy build (if necessary to include the rate-limiting module) is updated in the deployment or Dockerfile configuration.

### 🔧 Technical Context
- Modifications are required in `oracle-backend/Caddyfile`.
- If the default Caddy binary does not include the rate-limit module (e.g., `github.com/mholt/caddy-ratelimit`), the `oracle-backend/Dockerfile` might need to be updated to use `xcaddy` to build a custom Caddy binary containing the required module.

### 📊 Estimated Complexity
Small (1-2 days). The configuration itself is minimal, but updating the Dockerfile to use `xcaddy` (if the standard image lacks the module) requires testing to ensure the image builds cleanly and the new binary functions exactly as before.

### ⚠️ Risks and Considerations
- **False Positives:** Strict global rate limiting could accidentally block legitimate bursts of traffic, particularly if multiple users operate behind a single NAT gateway. The limits must be set generously enough to accommodate normal spikes while aggressively shedding clear abuse.
- **Caddy Plugins:** Relying on third-party Caddy modules requires building a custom binary, which adds a slight amount of complexity to the Docker build process.

### 🔗 Related
- N/A
