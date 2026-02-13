# Oracle Backend Security Audit Report

Date: 2026-02-13
Scope: `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend` (plus associated Cloudflare-origin linkage where directly tied to Oracle ingest path)
Assessed by: Codex (SAST + manual review)

## Executive Summary
The codebase shows strong progress on core backend security: bcrypt password hashing, strict auth secret fail-closed startup, append-only audit chain, request body limits, CSRF header/origin checks for API mutations, authenticated `/metrics`, and no immediate SAST/CVE hits (`gosec`: 0 findings, `govulncheck`: no vulnerabilities).

Critical residual risk remains in infrastructure linkage: Cloudflare Worker origin is configured over plain HTTP, which can expose ingest secrets and payloads in transit. Additional medium/high-risk hardening gaps are mostly configuration/authorization scope issues rather than classic injection flaws.

---

## Tooling Evidence
- `go test ./... -count=1` passed.
- `go vet ./...` passed.
- `gosec -exclude=G701 ./...` reported 0 issues.
- `govulncheck ./...` reported no known vulnerabilities.

---

## Critical Findings

### ORA-SEC-001 — Cloudflare-to-Origin link uses plaintext HTTP
- Severity: **Critical**
- Location:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker/wrangler.toml:7`
- Description:
  - `ORACLE_ENDPOINT` is configured as `http://...:8080`. Durable Object batch flushes include `X-DO-SECRET`; using plaintext origin transport allows interception/tampering if traffic crosses untrusted network segments.
- PoC:
  1. Run packet capture on any network segment between Cloudflare egress and origin.
  2. Observe requests to `/ingest-batch` with header `X-DO-SECRET` and raw payload body.
- Remediation:
  1. Move origin to HTTPS with valid certificate and Cloudflare **Full (Strict)** mode.
  2. Update worker var to `https://<origin-host>`.
  3. Restrict origin access to Cloudflare egress IPs and/or mTLS tunnel.
  4. Disable direct public HTTP to origin (`:8080`) at firewall/security list level.

---

## High Findings

### ORA-SEC-002 — Weak default ingest secret in container image
- Severity: **High**
- Location:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/Dockerfile:50`
- Description:
  - Image bakes `DO_SHARED_SECRET=change-me-in-production`. If deployers forget to override this value, ingest auth becomes guessable.
- PoC:
  1. Start container overriding only required dashboard/super-admin vars.
  2. Send `/ingest-batch` with `X-DO-SECRET: change-me-in-production`.
  3. Request is accepted if value not overridden.
- Remediation:
  1. Remove default secret from Dockerfile.
  2. Fail startup when `DO_SHARED_SECRET` is empty or matches denylist (`change-me-in-production`).

### ORA-SEC-003 — Production foot-guns can disable auth controls
- Severity: **High** (when misconfigured in production)
- Location:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:50-52`
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:63-73`
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:1241-1251`
- Description:
  - `ALLOW_EMPTY_DASHBOARD_PASSWORD=true` disables session auth entirely.
  - `ALLOW_LOOPBACK_BYPASS=true` with empty `ARCHIVER_SHARED_SECRET` allows loopback auth bypass.
  - These are marked dev-only, but code does not enforce environment-based prohibition.
- PoC:
  - Set `ALLOW_EMPTY_DASHBOARD_PASSWORD=true` and unset dashboard password, then access `/api/admin/*` without logging in.
- Remediation:
  1. Introduce explicit `APP_ENV=production` guard.
  2. On production: hard-fail startup if either unsafe flag is true.
  3. Optionally compile out these bypasses for production builds.

---

## Medium Findings

### ORA-SEC-004 — Proxy/IP trust model can weaken rate-limits and abuse detection
- Severity: **Medium**
- Location:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:52`
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:1762-1781`
- Description:
  - Client IP is derived from `X-Real-IP` / `X-Forwarded-For` only when `TRUSTED_PROXY_CIDRS` matches remote IP. Misconfiguration can either:
    - collapse all clients behind proxy into one rate-limit bucket (DoS/lockout), or
    - trust spoofable forwarding headers if CIDRs are overly broad.
- PoC:
  - Configure `TRUSTED_PROXY_CIDRS=0.0.0.0/0` and send repeated login attempts with rotating `X-Forwarded-For`; rate limit/banning can be bypassed.
- Remediation:
  1. Enforce strict trusted proxy CIDR validation at startup (reject broad ranges like `/0`).
  2. Prefer Cloudflare canonical header `CF-Connecting-IP` when behind Cloudflare.
  3. Add startup warning/fail if running behind known proxy and no trusted CIDRs configured.

### ORA-SEC-005 — Newsletter subscriber upsert is write-capable with viewer-level auth only
- Severity: **Medium**
- Location:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:182`
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/creative_hub.go:167-222`
- Description:
  - `/api/admin/newsletter/subscribers/upsert` is behind `authMiddleware` but not `criticalMiddleware` (step-up). Any dashboard-authenticated viewer can mutate subscriber data.
- PoC:
  1. Authenticate with dashboard password only.
  2. POST to `/api/admin/newsletter/subscribers/upsert` with modified email metadata.
  3. Update succeeds without step-up.
- Remediation:
  1. Require step-up for all mutating newsletter endpoints, or
  2. Add role-based policy (read-only viewer vs editor/admin) with explicit server-side authorization checks.

### ORA-SEC-006 — Session token prefix is persisted in logs and exposed to non-step-up readers
- Severity: **Medium**
- Location:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:1271-1276`
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:521-529`
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:201`
- Description:
  - First 12 chars of session token are used as `token_id` and stored in request/operation logs. Log viewing endpoint (`/api/admin/oracle-logs`) is not step-up protected.
- PoC:
  1. Login as dashboard viewer.
  2. GET `/api/admin/oracle-logs`.
  3. Observe token prefixes for active sessions.
- Remediation:
  1. Replace token prefix with irreversible token fingerprint (e.g., HMAC-SHA256(token) truncated).
  2. Optionally move oracle logs listing under step-up/privileged role.

### ORA-SEC-007 — Deployment script may write secrets to world-readable `.env`
- Severity: **Medium**
- Location:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/scripts/deploy_main_inplace.sh:54-65`
- Description:
  - Script creates/rewrites `.env` but does not enforce restrictive file mode; permissions depend on shell umask.
- PoC:
  1. Run deploy script on host with default umask `022`.
  2. `ls -l oracle-backend/.env` may show `-rw-r--r--`.
- Remediation:
  1. Immediately enforce `chmod 600 .env` after creation and after rewrite.
  2. Consider migrating secrets to OCI Vault / Docker secrets and keeping `.env` non-secret.

### ORA-SEC-008 — Optional envs allow SSRF-like expansion of deployment sync fetcher
- Severity: **Medium** (misconfiguration-dependent)
- Location:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/internal/handlers/browser_store_sync.go:391-399`
- Description:
  - `ORACLE_ALLOW_HTTP_STORE_URLS=true` and `ORACLE_ALLOW_UNTRUSTED_STORE_URLS=true` disable URL trust controls for store sync fetches.
- PoC:
  1. Enable both envs.
  2. Set deployment target URL to internal endpoint.
  3. Trigger sync endpoint; backend performs fetch to arbitrary host.
- Remediation:
  1. Block these toggles in production (`APP_ENV=production` startup fail).
  2. Keep strict host allowlist and HTTPS-only enforcement permanently in production.

---

## Low / Informational Findings

### ORA-SEC-009 — Security header posture is good but lacks HSTS (context dependent)
- Severity: **Low / Informational**
- Location:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend/cmd/app/main.go:397-406`
- Description:
  - `X-Frame-Options`, `X-Content-Type-Options`, CSP, and Referrer Policy are set.
  - `Strict-Transport-Security` is not set (reasonable if service is intentionally HTTP behind edge termination).
- Remediation:
  - If and only if HTTPS is guaranteed at the browser edge for this host, set HSTS at edge (Cloudflare) rather than app.

---

## SAST Coverage Notes

### Injection (SQL/NoSQL)
- SQL injection in standard handlers: no direct findings; parameterized SQL is used.
- SQL console endpoints remain high-risk by nature but protected via:
  - feature flag (`feature_sql_console_enabled` default off),
  - step-up middleware,
  - read-only and restricted-table guards.
- NoSQL injection: not applicable in `oracle-backend` (no MongoDB usage in this folder).

### Broken Authentication
- Positive controls present:
  - bcrypt hashing (`main.go`),
  - session/step-up expiry,
  - rate-limiting for login/step-up,
  - startup fail-closed for dashboard/super-admin password presence.

### Sensitive Data Exposure
- Positive controls present:
  - ingest raw payload sanitization/redaction for IP-like fields,
  - no direct credential logging in reviewed backend code.
- Residual concern:
  - token prefix logging noted in ORA-SEC-006.

### Dependencies / Supply Chain
- `govulncheck` result: no known vulnerable Go modules in current graph.
- `gosec` result: no detected security issues (excluding acknowledged SQL false-positive rule G701).

---

## Deployment / Network Hardening Checklist
- Require Cloudflare origin mode: **Full (Strict)**.
- Restrict origin firewall ingress to Cloudflare egress ranges (or use Cloudflare Tunnel/mTLS).
- Do not expose port `8080` publicly on OCI unless tightly ACL’d.
- Enforce production guardrails for unsafe env toggles.
- Enforce `chmod 600` for local secret files.

