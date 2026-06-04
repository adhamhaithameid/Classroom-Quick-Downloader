## 🔮 Oracle — Backend Suggestion
**Agent:** Oracle | **Day:** Thursday | **Date:** 2026-03-05

---

### 🔧 Improvement Type
Operational / Security Hardening

### 🔍 Current State
Currently, the `oracle-backend/Caddyfile` acts as a reverse proxy but entirely lacks rate limiting configuration. It blindly forwards all requests to the `oracle-backend:8080` instance. Since the backend handles incoming webhooks and traffic metrics synchronization (e.g., from Cloudflare Worker flushes), it is susceptible to denial-of-service (DoS) and brute-force attacks at the application layer.

### 💡 Proposed Improvement
Add rate limiting directives to the `Caddyfile` using Caddy's `rate_limit` module (which might require a custom build or using Caddy's built-in `request_body` and basic connection limits if plugins aren't preferred). The proposed change should configure:
- Global rate limits to prevent volumetric DoS attacks.
- Specific rate limits on sensitive endpoints (like `/api/auth/login` and `/api/auth/stepup/start`) to mitigate brute-forcing.

### 🎯 Why This Matters
For a backend maintained by a single person with monthly check-ins, unmitigated application-level volumetric attacks can quietly exhaust server resources (CPU, RAM, connection pools), causing silent outages. An outage could last days before discovery. Implementing rate limiting at the proxy layer drops abusive traffic before it hits the Go application and database, dramatically improving the survivability and resilience of the system without requiring active monitoring.

### 📐 Acceptance Criteria
- [ ] The `Caddyfile` is updated with appropriate rate limiting configurations.
- [ ] High-risk endpoints (e.g., authentication routes) have stricter rate limits.
- [ ] General API endpoints have reasonable global rate limits to prevent exhaustion.
- [ ] Legitimate burst traffic from the Cloudflare Worker (like batch flushes) is allowed through (potentially via IP allowlisting or sufficient burst limits).

### 🔧 Technical Context
- **Files to modify:** `oracle-backend/Caddyfile`, potentially `oracle-backend/Dockerfile` if a custom Caddy build with the rate-limit module is required.
- **Implementation Details:** If standard Caddy is used, connection limits can be achieved via reverse_proxy settings. However, proper endpoint-based rate limiting requires the `caddy-rate-limit` module. The implementation must carefully ensure that the `CLOUDFLARE_WORKER` IPs or the specific `X-DO-SECRET` authenticated traffic for `/ingest-batch` is not overly constrained.

### 📊 Estimated Complexity
Small (1–2 days). Modifying the Caddyfile is trivial, but ensuring that valid burst traffic is not disrupted requires careful testing and tuning of the rate limit thresholds.

### ⚠️ Risks and Considerations
The primary risk is false positives—blocking legitimate background batch ingestion from the Cloudflare Worker. The configuration must be thoroughly tested against the maximum expected flush bursts to prevent data loss.

### 🔗 Related
None.
