# Oracle Dashboard — Security Audit Report

> **Date:** 2026-02-12
> **Scope:** Full-stack audit — Go backend (30+ source files) and HTML/JS frontend (5021-line `index.html`)

---

## Summary

| Severity | Backend | Frontend | Total |
|----------|---------|----------|-------|
| 🔴 Critical | 3 | 0 | **3** |
| 🟠 High | 5 | 0 | **5** |
| 🟡 Medium | 4 | 4 | **8** |
| 🔵 Low / Info | 4 | 4 | **8** |
| **Total** | **16** | **8** | **24** |

---

## Remediation Status (2026-02-12)

| ID | Status | Notes |
|---|---|---|
| C1 | ✅ Codebase fixed / ⚠️ manual rotation still required | Credential file removed from repo tree, ignored in git/docker, deploy switched to external secret mount. GCP key rotation and git-history purge must still be run operationally. |
| C2 | ✅ Fixed | Password hashing moved to bcrypt. |
| C3 | ✅ Fixed | SQL guardlist expanded, read-only DB handle for query path, SQL text recorded in audit. |
| H1 | ✅ Fixed | Auth sessions, step-up challenges, and rate-limit state persisted in SQLite (`auth_sessions`, `auth_stepup_challenges`, `auth_rate_limits`) with cleanup. |
| H2 | ✅ Fixed | Graceful shutdown with SIGINT/SIGTERM + `server.Shutdown`. |
| H3 | ✅ Fixed | Admin/auth body size limits + strict JSON decoders applied. |
| H4 | ✅ Fixed | `/metrics` now protected by auth middleware. |
| H5 | ✅ Fixed | Periodic cleanup loop for in-memory + persisted auth state. |
| M1 | ✅ Fixed | Script CSP hardened to nonce-only (no inline script fallback). |
| M2 | ✅ Fixed | SQLite `PRAGMA synchronous = FULL`. |
| M3 | ✅ Fixed | `VACUUM INTO` interpolation documented with explicit defense layers and validated path constraints. |
| M4 | ✅ Fixed | Deploy path now uses external secret mount, not repo copy. |
| M5 | ✅ Fixed | Tooltip now uses structured payload rendering, not raw HTML injection API. |
| M6 | ✅ Fixed | CSRF defense-in-depth with `X-Requested-With` on mutating API routes. |
| M7 | ✅ Fixed | GitHub notifications moved behind backend proxy + cache/fallback. |
| M8 | ✅ Fixed | localStorage fallback for version notes removed. |
| L2 | ✅ Fixed | Dead cookie-policy branch removed. |
| L3 | ✅ Fixed | Committed binary removed and ignored. |
| L5 | ✅ Fixed | Hardcoded infra URLs moved to backend config endpoint. |
| L6/L7 | ✅ Fixed | Inline handlers removed; CSP nonce enforcement active. |
| L8 | ✅ Fixed | Auto-refresh skips hidden tabs and refreshes on visibility return. |

### Follow-up Hardening (2026-02-13)

- Auth handlers now use strict JSON decoding (unknown fields and trailing payloads rejected) for login and step-up verification.
- SQL restricted-table coverage now explicitly includes quoted variants (`"table"`, `` `table` ``, `[table]`) and schema-qualified forms.
- Worker flush/alarm logging now emits structured events only; secret-derived debug metadata has been removed.
- Cookie troubleshooting now documents `SESSION_COOKIE_SECURE` mode selection for HTTP vs HTTPS deployments.

---

## 🔴 CRITICAL

### C1. GCP Service Account Private Key Committed to Repository

| | |
|---|---|
| **Component** | Backend — Credentials |
| **File** | `google-credentials.json` |
| **Description** | A full Google Cloud service account private key (private key PEM, service account email, project ID) is committed to the repository. Although listed in `.gitignore`, the file exists in git history and **must be considered compromised**. |
| **Impact** | Anyone with repo access can impersonate the service account, access Google Sheets, and potentially pivot to other GCP resources. |
| **Fix** | 1. **Immediately rotate** the key in GCP Console. 2. Run `git filter-repo` or BFG Repo-Cleaner to purge from history. 3. Use GCP Workload Identity or Docker secrets instead. 4. Add to `.dockerignore`. |

---

### C2. SHA-256 for Password Hashing (No Key Stretching)

| | |
|---|---|
| **Component** | Backend — Authentication |
| **File** | `cmd/app/main.go` (lines 725-728) |
| **Description** | Passwords are hashed with plain SHA-256 (`sha256.Sum256`), a fast hash designed for data integrity — not password storage. An attacker with the hash can brute-force it at billions of attempts/second. |
| **Impact** | Dashboard and super-admin passwords are trivially crackable if hashes are exposed. |
| **Fix** | Replace with `bcrypt` or `argon2id`: `bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)` |

---

### C3. SQL Console Allows Arbitrary Query Execution with Bypassable Guards

| | |
|---|---|
| **Component** | Backend — Injection |
| **Files** | `internal/handlers/admin_ops.go` — `SQLQueryHandler`, `SQLExecHandler` |
| **Description** | Safety guards (`normalizeSingleStatement`, `isReadOnlySQL`, `isForbiddenMutatingSQL`) can be bypassed: semicolon count is insufficient, prefix-only checks miss CTEs (`WITH`), and the forbidden keyword list is missing `CREATE`, `CREATE TRIGGER`, `LOAD_EXTENSION`. |
| **Impact** | Can read all tables including audit logs and session data. Can modify feature flags to disable step-up auth. Can forge audit log entries via INSERT. Can install persistent backdoors via `CREATE TRIGGER`. |
| **Mitigations** | Step-up auth + feature flag (`feature_sql_console_enabled` defaults to `0`). |
| **Fix** | 1. Add `CREATE`, `TRIGGER`, `LOAD_EXTENSION`, `REPLACE` to forbidden list. 2. Use a read-only DB connection (`?mode=ro`) for `SQLQueryHandler`. 3. Log actual SQL in audit trail. 4. Consider statement allowlist instead of denylist. |

---

## 🟠 HIGH

### H1. In-Memory Session Store — All Sessions Lost on Restart

| | |
|---|---|
| **Component** | Backend — Reliability |
| **File** | `cmd/app/main.go` (lines 587-591) |
| **Description** | Sessions, step-up tokens, rate limiting counters, and challenge tokens are all stored in-memory. Every restart/redeploy forces re-authentication. |
| **Impact** | UX disruption on every deploy. Rate limiting resets — attackers can bypass lockout by waiting for a restart. |
| **Fix** | Persist sessions in SQLite: `CREATE TABLE sessions (token TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)` |

---

### H2. No Graceful Shutdown

| | |
|---|---|
| **Component** | Backend — Reliability |
| **File** | `cmd/app/main.go` (lines 192-204) |
| **Description** | No `os.Signal` handling or `server.Shutdown(ctx)`. On `SIGTERM` (Docker stop), in-flight requests are killed immediately, potentially corrupting SQLite transactions or losing ingest data. |
| **Fix** | Add signal handler: `signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)` → `server.Shutdown(ctx)` with 30s timeout. |

---

### H3. Admin API Request Bodies Have No Size Limits

| | |
|---|---|
| **Component** | Backend — DoS |
| **File** | `internal/handlers/admin_ops.go` |
| **Description** | The ingest endpoint correctly uses `http.MaxBytesReader` (5MB), but **all admin endpoints** use raw `json.NewDecoder(r.Body)` without size limits: SQL handlers, danger zone, feature flags, records, creative hub, newsletter handlers. |
| **Impact** | An authenticated attacker can send multi-gigabyte request bodies to exhaust server memory (OOM kill). |
| **Fix** | Add per-handler or global middleware: `r.Body = http.MaxBytesReader(w, r.Body, 1<<20)` (1MB for admin APIs). |

---

### H4. `/metrics` Endpoint Is Unauthenticated

| | |
|---|---|
| **Component** | Backend — Information Disclosure |
| **File** | `cmd/app/main.go` (line 166) |
| **Description** | The Prometheus metrics endpoint is registered without `authMiddleware`, exposing auth failure counters, rate limit hits, step-up stats, and backup counts to unauthenticated users. |
| **Impact** | An attacker can monitor auth failures in real-time to optimize brute-force timing. |
| **Fix** | Wrap with `authMiddleware`: `mux.Handle("/metrics", authMiddleware(metricsHandler(appMetrics)))` |

---

### H5. No Session Cleanup — Memory Leak Over Time

| | |
|---|---|
| **Component** | Backend — Memory Leak |
| **File** | `cmd/app/main.go` (lines 1176-1194) |
| **Description** | Expired sessions are only cleaned when accessed. Sessions never accessed again remain in memory forever. Same applies to `stepUpSessionStore`, `stepUpChallengeStore`, `loginRateStore`, `stepUpRateStore`. |
| **Impact** | Slow memory leak. Over months, in-memory maps could grow significantly. |
| **Fix** | Add periodic cleanup goroutine: `go func() { for range time.Tick(15 * time.Minute) { cleanupExpiredSessions() } }()` |

---

## 🟡 MEDIUM

### M1. CSP Allows `unsafe-inline` for Scripts

| | |
|---|---|
| **Component** | Backend — XSS Defense |
| **File** | `cmd/app/main.go` (line 264) |
| **Description** | The Content-Security-Policy header includes `script-src 'self' 'unsafe-inline'`, which makes the CSP nonce mechanism (`__CSP_NONCE__`) redundant — any injected inline script would execute regardless. |
| **Impact** | If any XSS vector exists in the dashboard, the CSP won't block it. |
| **Fix** | Migrate inline `onclick` handlers to `addEventListener()`, then remove `'unsafe-inline'` from CSP. |

---

### M2. SQLite `PRAGMA synchronous = NORMAL` Risks Durability

| | |
|---|---|
| **Component** | Backend — Data Loss |
| **File** | `internal/db/db.go` (line 38) |
| **Description** | With WAL mode + `synchronous = NORMAL`, a power failure or OS crash can lose the most recent committed transaction. |
| **Impact** | Acceptable for analytics data, but problematic for audit logs which use a hash chain for integrity. |
| **Fix** | Use `synchronous = FULL` for maximum durability, or document the trade-off explicitly. |

---

### M3. Backup Handler Uses String Concatenation for SQL

| | |
|---|---|
| **Component** | Backend — Injection |
| **File** | `internal/handlers/admin_ops.go` (line 1244) |
| **Description** | `VACUUM INTO` path is built via string concatenation with single-quote escaping. The path is validated by regex (`^[a-zA-Z0-9._-]+\.db$`), but string concatenation for SQL is an anti-pattern. |
| **Impact** | Low risk due to validation; any future relaxation of the regex could introduce SQL injection. |
| **Fix** | Document why parameterization isn't possible (SQLite `VACUUM INTO` requires a literal) and comment the defense layers. |

---

### M4. Deploy Script Copies Credentials Into Repository Directory

| | |
|---|---|
| **Component** | Backend — Credentials |
| **File** | `scripts/deploy_main_inplace.sh` (lines 26-29) |
| **Description** | The deploy script copies `google-credentials.json` into the git working tree. A subsequent `git add .` would re-commit the credentials. |
| **Fix** | Mount credentials as Docker secrets or use a path outside the repo tree. |

---

### M5. `showTooltip()` Accepts Raw HTML via `innerHTML`

| | |
|---|---|
| **Component** | Frontend — XSS |
| **File** | `static/index.html` (lines 2952-2963) |
| **Description** | The `showTooltip(e, html)` function directly assigns its `html` parameter to `innerHTML`. While all current callers properly escape via `escapeHtml()`, a future caller that forgets to escape could introduce stored XSS. |
| **Fix** | Accept a data object instead of raw HTML, and build the HTML inside `showTooltip()`. |

---

### M6. No CSRF Protection on API Mutations

| | |
|---|---|
| **Component** | Frontend — CSRF |
| **File** | `static/index.html` — all POST calls via `fetchJSONWithInit()` |
| **Description** | All POST requests use `Content-Type: application/json` with session cookies but no CSRF token. |
| **Mitigations** | `Content-Type: application/json` prevents simple form-based CSRF. Backend requires `decodeJSONBodyStrict()` which rejects non-JSON. Single-user admin panel reduces surface. |
| **Fix** | Add `X-Requested-With: XMLHttpRequest` header or implement proper CSRF tokens for defense-in-depth. |

---

### M7. External GitHub API Calls Without Authentication

| | |
|---|---|
| **Component** | Frontend — Rate Limiting |
| **File** | `static/index.html` (lines 4496-4497) |
| **Description** | The notification loader calls the GitHub Search API without authentication. The unauthenticated limit is 10 requests/minute, which the 60-second auto-refresh will exhaust quickly. |
| **Fix** | Proxy these calls through the backend with a GitHub token, or cache results client-side. |

---

### M8. `localStorage` Fallback Stores Unvalidated Data

| | |
|---|---|
| **Component** | Frontend — Data Integrity |
| **File** | `static/index.html` (lines 4184-4188) |
| **Description** | When the API call fails, version notes fall back to `localStorage`, persisting across sessions without server-side audit. The data is rendered safely via `escapeHtml()`, but cannot be audited server-side. |
| **Fix** | Remove the `localStorage` fallback or add a visual indicator for local-only data. |

---

## 🔵 LOW / INFORMATIONAL

### L1. No CORS Headers

| | |
|---|---|
| **Component** | Backend — Configuration |
| **Description** | No CORS middleware exists. Same-origin-only is likely intentional for a single-user admin panel. If cross-origin access becomes needed, this must be added. |

---

### L2. `cookieSecurityPolicy` Dead Branch

| | |
|---|---|
| **Component** | Backend — Code Quality |
| **File** | `cmd/app/main.go` (lines 1412-1420) |
| **Description** | The `allowInsecure` flag has no functional effect — both branches return the same values (`false, SameSiteLaxMode`). |
| **Fix** | Either differentiate the behavior or remove the flag. |

---

### L3. Compiled Binary Checked Into Repository

| | |
|---|---|
| **Component** | Backend — Repo Hygiene |
| **File** | `oracle-backend/app` (14MB binary) |
| **Description** | A compiled Go binary is committed. The Dockerfile builds from source, making this redundant. |
| **Fix** | Add to `.gitignore` and remove from git history. |

---

### L4. `isReadOnlySQL` Only Checks for `SELECT` Prefix

| | |
|---|---|
| **Component** | Backend — Usability |
| **File** | `internal/handlers/admin_ops.go` (lines 1516-1519) |
| **Description** | Valid read-only SQL can start with `WITH` (CTEs), `EXPLAIN`, `VALUES`, `PRAGMA`. The check is overly restrictive but safe — `WITH` queries are correctly blocked since they don't start with `"select "`. |

---

### L5. Hardcoded Infrastructure IP in HTML Source

| | |
|---|---|
| **Component** | Frontend — Information Disclosure |
| **File** | `static/index.html` (line 2137) |
| **Description** | The Oracle VM's public IP (`129.151.233.229`) and Uptime Kuma port (`3001`) are hardcoded in the HTML source. While served behind authentication, the IP is committed to the public GitHub repo. |
| **Fix** | Move to a backend-served config endpoint. |

---

### L6. CSP Nonce Placeholder Rendered Redundant

| | |
|---|---|
| **Component** | Frontend — XSS Defense |
| **File** | `static/index.html` (line 2472) |
| **Description** | The `<script nonce="__CSP_NONCE__">` placeholder is good practice, but the CSP header allows `'unsafe-inline'` as a fallback, making the nonce completely redundant. |
| **Fix** | Remove `'unsafe-inline'` from CSP to make nonces enforce script restrictions (see M1). |

---

### L7. Inline `onclick` Handlers Throughout HTML

| | |
|---|---|
| **Component** | Frontend — Code Quality / CSP |
| **File** | `static/index.html` — throughout |
| **Description** | Inline `onclick` handlers are used extensively for buttons and form actions. These require `'unsafe-inline'` in CSP `script-src`. The codebase already uses `addEventListener()` for navigation (`bindButtonActions()`), so migration is feasible. |
| **Fix** | Migrate all inline handlers to `addEventListener()` to allow removal of `'unsafe-inline'` from CSP. |

---

### L8. 60-Second Auto-Refresh Without Visibility Check

| | |
|---|---|
| **Component** | Frontend — Performance |
| **File** | `static/index.html` (lines 4909-4916) |
| **Description** | The auto-refresh runs every 60 seconds regardless of tab visibility. Combined with unauthenticated GitHub API calls (M7), this exhausts rate limits even when the dashboard is in a background tab. |
| **Fix** | Pause the refresh loop when `document.visibilityState === 'hidden'`. |

---

## ✅ Positive Findings

| Area | Assessment |
|------|------------|
| **XSS escaping** | `escapeHtml()` used consistently at all 50+ `innerHTML` injection points ✅ |
| **`textContent` for simple values** | Overview stats, clock, auth errors, danger zone output all use `textContent` ✅ |
| **`syntaxHighlight()` pre-escapes** | JSON viewer escapes `& < >` before regex coloring ✅ |
| **Step-up auth** | All destructive operations gate behind `ensureStepUp()` + `window.confirm()` ✅ |
| **Timing-safe comparisons** | `subtle.ConstantTimeCompare` used for all secret/password checks ✅ |
| **Audit log hash chain** | Append-only with SHA-256 chain, immutability enforced by SQLite triggers ✅ |
| **Feature flags** | SQL console and danger zone disabled by default ✅ |
| **Rate limiting** | Per-IP rate limiting on login and step-up with lockout ✅ |
| **Path traversal protection** | SPA handler validates paths stay within `staticDir` ✅ |
| **IP sanitization** | Sensitive IP fields redacted from raw snapshots ✅ |
| **Ingest validation** | 5MB body limit, idempotent by `batchId`, secret-authenticated ✅ |
| **Security headers** | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ✅ |
| **Non-root Docker user** | `appuser:appgroup` with minimal privileges ✅ |
| **Chart bar data encoding** | JSON.stringify + `&quot;` for attribute values, parsed via `JSON.parse` ✅ |
| **`safeDomIdPart()`** | `encodeURIComponent()` for dynamic element IDs ✅ |
| **Auth error messages** | Use `textContent`, safe even with attacker-controlled strings ✅ |

---

## Recommendations (Priority Order)

| Priority | Action | Findings Addressed |
|----------|--------|-------------------|
| 🔴 **P0** | Rotate GCP service account key & purge from git history | C1 |
| 🔴 **P0** | Replace SHA-256 with bcrypt/argon2id for password hashing | C2 |
| 🔴 **P0** | Harden SQL console: add missing keywords, use read-only connection | C3 |
| 🟠 **P1** | Persist sessions in SQLite | H1 |
| 🟠 **P1** | Add graceful shutdown with signal handling | H2 |
| 🟠 **P1** | Add `MaxBytesReader` to all admin API handlers | H3 |
| 🟠 **P1** | Wrap `/metrics` with `authMiddleware` | H4 |
| 🟠 **P1** | Add periodic session cleanup goroutine | H5 |
| 🟡 **P2** | Remove CSP `unsafe-inline` + migrate inline handlers | M1, L6, L7 |
| 🟡 **P2** | Add CSRF defense header (`X-Requested-With`) | M6 |
| 🟡 **P2** | Proxy GitHub API calls through backend | M7, L8 |
| 🟡 **P2** | Move credentials out of repo tree in deploy script | M4 |
| 🔵 **P3** | Remove compiled binary from repo | L3 |
| 🔵 **P3** | Move hardcoded IP to backend config | L5 |
| 🔵 **P3** | Remove `localStorage` fallback or add indicator | M8 |
| 🔵 **P3** | Fix dead `cookieSecurityPolicy` branch | L2 |
