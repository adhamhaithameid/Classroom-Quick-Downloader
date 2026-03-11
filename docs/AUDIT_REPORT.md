# Classroom Quick Downloader — Full Project Audit Report

> **Scope:** Extension · Cloudflare Worker (CF) · Oracle Backend (Go) · Website (SvelteKit)
> **Audit Type:** Security, Correctness, Architecture, Code Quality
> **Files Examined:** ~50 source files across all four subsystems

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Severity Legend](#2-severity-legend)
3. [CRITICAL Findings](#3-critical-findings)
4. [HIGH Findings](#4-high-findings)
5. [MEDIUM Findings](#5-medium-findings)
6. [LOW / Informational Findings](#6-low--informational-findings)
7. [Positive Observations](#7-positive-observations)
8. [Remediation Priority Matrix](#8-remediation-priority-matrix)

---

## 1. Executive Summary

The project is a well-structured, multi-layer system. The code shows clear engineering
effort — constant-time comparisons, rate limiting, input sanitisation, parameterised
SQL, and audit logging are all present. However, **three critical issues** require
immediate attention before the codebase is considered safe for public exposure, and
several high/medium issues should be addressed in the next development cycle.

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 9 |
| 🟡 MEDIUM | 10 |
| 🔵 LOW / Info | 6 |
| **Total** | **28** |

### Status Update — 2026-03-11

This report started as a static review snapshot. Since then, the repository has moved
substantially.

Current status of the original 28 findings:

| Status | Count | Notes |
|--------|-------|-------|
| ✅ Closed / effectively closed | 20 | Includes Worker/Oracle remediation landed after the original audit. |
| 💤 Stale finding | 1 | `H-09` assumed Go `1.26` did not exist; that assumption is now outdated. |
| ⚠️ Accepted for now | 0 | — |
| 🔓 Still open | 7 | Remaining open items are now extension-runtime follow-up items only. |
| **Total** | **28** | |

The tables and narrative below preserve the original findings, but the current closure
state should be read from this status block and the updated remediation matrix.

---

## 2. Severity Legend

| Icon | Level | Meaning |
|------|-------|---------|
| 🔴 | CRITICAL | Immediate exploitation risk or data exposure. Fix before next deploy. |
| 🟠 | HIGH | Material security weakness or correctness bug with user-visible impact. |
| 🟡 | MEDIUM | Latent risk, defence-in-depth gap, or reliability issue under stress. |
| 🔵 | LOW | Code smell, inconsistency, or minor architecture concern. |

---

## 3. CRITICAL Findings

---

### C-01 — Plaintext Credentials Committed to Repository

**Affected file:** `cloudflare-worker/.dev.vars`
**Subsystem:** Cloudflare Worker

#### What was found

```cloudflare-worker/.dev.vars#L1-4
# Secrets for local development (DO NOT COMMIT)
DO_SHARED_SECRET=SuperSecretPassword16/12/2025
DANGER_PASSWORD=SuperDuperSecretPassword05/02/2026
DASHBOARD_PASSWORD=SuperSecretPassword16/12/2025
```

The file itself carries the comment `# Secrets for local development (DO NOT COMMIT)`,
yet it is present in the repository tree and was readable during this audit. The root
`.gitignore` lists `.dev.vars` (line 14), but a file that was already tracked before
the ignore rule was added will remain in the git history unless explicitly purged with
`git rm --cached`.

#### Why it is dangerous

- **All three secrets are weak passwords** — they embed calendar dates as the sole
  source of entropy (`16/12/2025`, `05/02/2026`), making them trivially guessable or
  brute-forceable.
- `DO_SHARED_SECRET` authorises every ingest request to the Oracle backend. Any actor
  who reads this value can send arbitrary analytics batches.
- `DANGER_PASSWORD` unlocks the "danger step-up" admin tier — a second authentication
  factor that guards destructive operations (data wipe, config reset). Exposing it
  collapses that tier entirely.
- `DASHBOARD_PASSWORD` equals `DO_SHARED_SECRET`, so a single leaked value compromises
  both the dashboard login **and** the backend ingest authentication.
- Even if the file is not currently in the live remote HEAD, it may exist in git history
  across branches, forks, or CI artefacts.

#### How it happened

`wrangler` uses `.dev.vars` as a local-only secrets file by convention. It is correct
to create that file. The mistake was: (a) not adding it to `.gitignore` *before* the
first `git add`/`git commit`, and (b) using date-embedded strings instead of
cryptographically random secrets.

#### Remediation

1. Run `git rm --cached cloudflare-worker/.dev.vars` and force-push to purge from
   history (use `git filter-repo` for thorough removal).
2. **Rotate all three credentials immediately** — assume they are compromised.
3. Generate strong replacements: `openssl rand -hex 32` (64-char hex, 256-bit entropy).
4. Store production secrets exclusively in Cloudflare Worker Secrets
   (`wrangler secret put DO_SHARED_SECRET`), never in files.
5. Create a `.dev.vars.example` template with placeholder values so the convention is
   clear for contributors.

---

### C-02 — Production Server IP and Infrastructure IDs Committed in `wrangler.toml`

**Affected file:** `cloudflare-worker/wrangler.toml`
**Subsystem:** Cloudflare Worker

#### What was found

```cloudflare-worker/wrangler.toml#L1-10
name = "cqd-analytics"
main = "src/index.ts"
account_id = "fc9538cb362e6266eea89037f6347225"
...
[vars]
  ORACLE_ENDPOINT = "http://129.151.233.229.nip.io:8080"
  ALLOW_INSECURE_ORACLE_ENDPOINT = "true"
```

And further down:

```cloudflare-worker/wrangler.toml#L22-30
[[kv_namespaces]]
  binding = "SITE_SNAPSHOT_KV"
  id = "34a558d6cb094467b67a31465e09776b"
  preview_id = "78c3997a24a843eabdff73ed36cffa99"

[[d1_databases]]
  binding = "SITE_CACHE_DB"
  database_name = "cqd_site_cache"
  database_id = "b77cac38-4aec-46db-acb3-c9e35ff2868e"
```

#### Why it is dangerous

- **The raw Oracle Cloud IP (`129.151.233.229`)** is now public. An attacker can probe
  that host directly, bypassing Cloudflare's WAF and DDoS protection entirely.
- The backend listens on plain **HTTP port 8080** (`ALLOW_INSECURE_ORACLE_ENDPOINT =
  "true"`), so every byte of analytics data — including the `X-DO-SECRET` header —
  travels unencrypted. A passive observer on the Oracle Cloud network path can
  trivially capture the shared secret and all payload data.
- Cloudflare resource IDs (KV, D1) are not secrets per se, but exposing them lowers
  the bar for targeted abuse of those resources if combined with other token leaks.

#### How it happened

`wrangler.toml` is normally committed for CI/CD (`wrangler deploy`). The mistake is
mixing non-sensitive deployment metadata (binding names, database names) with a **live
production IP** and enabling plaintext HTTP. Production endpoints should use DNS names
with TLS termination, not raw IPs over HTTP.

#### Remediation

1. **Enable TLS** on the Oracle backend. Place an nginx/Caddy reverse proxy in front
   of the Go server and obtain a certificate (Let's Encrypt via Certbot or Oracle Cloud
   LB). Update `ORACLE_ENDPOINT` to `https://oracle.your-domain.com`.
2. Remove the raw IP from `wrangler.toml`. Use a DNS CNAME that points to the server.
3. Set `ALLOW_INSECURE_ORACLE_ENDPOINT = "false"` (the default). The code already
   enforces this check in `oracle-endpoint.ts`.
4. Remove `ALLOW_INSECURE_ORACLE_ENDPOINT` from `[vars]` entirely once TLS is in place.

---

### C-03 — Worker-to-Oracle Communication Over Plaintext HTTP

**Affected files:** `cloudflare-worker/wrangler.toml`, `cloudflare-worker/src/oracle-endpoint.ts`
**Subsystem:** Cloudflare Worker → Oracle Backend

#### What was found

All data flows between the Cloudflare Durable Object and the Oracle backend use HTTP,
not HTTPS:

```cloudflare-worker/wrangler.toml#L7-8
ORACLE_ENDPOINT = "http://129.151.233.229.nip.io:8080"
ALLOW_INSECURE_ORACLE_ENDPOINT = "true"
```

The worker correctly guards this with a code-level check in `oracle-endpoint.ts`:

```cloudflare-worker/src/oracle-endpoint.ts#L60-67
const allowInsecureHttp = options.allowInsecureHttp === true;
const insecureHttp = protocol === "http:";
if (insecureHttp && !allowInsecureHttp && !isLoopbackHostname(parsed.hostname)) {
  return {
    ok: false,
    error: "oracle_endpoint_insecure",
    message: "ORACLE_ENDPOINT must use HTTPS..."
  };
}
```

But the env var overrides this protection and silently allows HTTP for any hostname.

> **Status (2026-03-11):** Closed in committed defaults. Worker config and deploy
> guardrails now require an HTTPS Oracle endpoint by default, and the Oracle compose
> stack ships with a bundled Caddy TLS terminator for production-style deployments.

#### Why it is dangerous

- The `X-DO-SECRET` authentication header is transmitted unencrypted. Anyone who can
  sniff traffic between the Cloudflare PoP and the Oracle server captures the secret
  and can replay it to inject arbitrary analytics batches.
- All extension analytics (download types, error codes, browser details, IP addresses)
  are transmitted in cleartext — a privacy violation for users.
- The guard in `oracle-endpoint.ts` exists precisely to prevent this but is bypassed
  by the production configuration.

#### How it happened

This appears to be a temporary workaround applied when TLS was not yet configured on
the Oracle server ("only for temporary/local migration" per the wrangler comment). The
workaround was never reverted.

#### Remediation

Same as C-02. TLS termination on the Oracle server is the required fix. After enabling
HTTPS, set `ALLOW_INSECURE_ORACLE_ENDPOINT = "false"` and remove the exception.

---

## 4. HIGH Findings

---

### H-01 — Duplicate `timingSafeStringEqual` with Divergence Risk

**Affected files:** `cloudflare-worker/src/index.ts` (L45–54),
`cloudflare-worker/src/downloads_do.ts` (L1683–1692)
**Subsystem:** Cloudflare Worker

#### What was found

An identical function is defined in two separate files:

```cloudflare-worker/src/index.ts#L45-54
function timingSafeStringEqual(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i += 1) {
    const aCode = i < a.length ? a.charCodeAt(i) : 0;
    const bCode = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= aCode ^ bCode;
  }
  return mismatch === 0;
}
```

The exact same body appears at `downloads_do.ts` L1683–1692. The function is used for
password comparison in the dashboard login path (`index.ts`) and admin secret
validation inside the Durable Object (`downloads_do.ts`).

#### Why it is a problem

- Any improvement to one copy (e.g., switching to `crypto.subtle.timingSafeEqual` if
  it becomes available for string comparison) will silently not apply to the other.
- Both copies carry a comment warning that JS does **not** guarantee constant-time
  execution. If someone updates the comment in one file and adds a proper mitigation in
  the other, the codebase becomes inconsistent about its own security posture.
- The comment itself notes the limitation clearly, but since there are now two copies,
  that warning can fall out of sync.

#### Remediation

Extract the function into a shared utility module (e.g.,
`cloudflare-worker/src/utils/timing.ts`) and import it in both `index.ts` and
`downloads_do.ts`. This ensures there is a single source of truth.

---

### H-02 — Internal Error Details Leaked in HTTP Responses (Oracle Backend)

**Affected file:** `oracle-backend/internal/handlers/pipeline.go`
**Subsystem:** Oracle Backend

#### What was found

Multiple handler functions pass raw Go `error.Error()` strings directly to the HTTP
client:

```oracle-backend/internal/handlers/pipeline.go#L125-127
if err != nil {
    http.Error(w, "failed to query stage daily: "+err.Error(), http.StatusInternalServerError)
    return
}
```

This pattern repeats for every database query across `PipelineMetricsHandler` and
`PipelineFailuresHandler`. A similar pattern appears in `IngestBatchHandlerV4` (logged
to the client as raw error strings when the batch is malformed).

#### Why it is a problem

- Database error messages can reveal schema names, table structures, query patterns,
  and occasionally connection strings.
- Go's `database/sql` errors sometimes include dialect-specific details (e.g., SQLite
  constraint names, column names) that aid SQL injection reconnaissance.
- This violates the principle of returning opaque error identifiers to clients while
  keeping details server-side.

#### Remediation

Replace inline error concatenation with a generic message and log the full detail
server-side:

```/dev/null/example.go#L1-8
if err != nil {
    logEvent("error", "pipeline_query_failed", map[string]interface{}{
        "error": err.Error(),
        "query": "stage_daily",
    })
    http.Error(w, "internal server error", http.StatusInternalServerError)
    return
}
```

---

### H-03 — Module-Level CORS Origin Cache Never Expires in Cloudflare Worker

**Affected file:** `cloudflare-worker/src/index.ts`
**Subsystem:** Cloudflare Worker

#### What was found

```cloudflare-worker/src/index.ts#L413-415
const parsedAllowedOriginsCache = new Map<string, Set<string>>();
const parsedAllowedEmailsCache  = new Map<string, Set<string>>();
```

These `Map` objects live at the module (isolate) level and are populated on first
access by `parseAllowedOrigins()` / `parseAllowedEmails()`. They are **never
invalidated**. A Cloudflare Worker isolate can stay alive for hours.

#### Why it is a problem

- If `CORS_ALLOWED_ORIGINS` or `CLOUDFLARE_ACCESS_EMAIL_ALLOWLIST` is updated via
  the Cloudflare dashboard (env vars update), requests handled by long-lived isolates
  will continue using the stale cached set until the isolate is recycled.
- Adding a new domain to the allowlist will not take effect immediately; removing a
  domain that should be blocked will also not take effect immediately.
- Under a security incident, you cannot quickly revoke a compromised origin.

#### Remediation

Because Cloudflare Workers cannot detect env var changes mid-lifetime, the simplest
safe fix is to **not cache these small sets at all** — `parseAllowedOrigins` is cheap
(splits a string into a `Set`), and the env var is already in-memory. Remove the cache
maps entirely. If performance profiling later shows this matters, cap the cache at a
short TTL using an age timestamp.

---

### H-04 — Development Origins Hardcoded in Production Oracle CORS List

**Affected file:** `oracle-backend/internal/handlers/public_website.go`
**Subsystem:** Oracle Backend

#### What was found

```oracle-backend/internal/handlers/public_website.go#L42-50
defaultPublicWebsiteAllowedOrigins = []string{
    "https://adhamhaithameid.github.io",
    "https://classroom-quick-downloader-website.pages.dev",
    "https://not-stable.classroom-quick-downloader-website.pages.dev",
    "https://classroom-quick-downloader.pages.dev",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}
```

Two localhost origins and a canary subdomain
(`not-stable.classroom-quick-downloader-website.pages.dev`) are present in the
production CORS allowlist.

#### Why it is a problem

- **localhost origins in production**: Any page served from `localhost:5173` on
  any machine can make authenticated API calls to the production Oracle backend.
  This is not usually exploitable remotely (loopback is local), but it is a policy
  violation and creates confusion.
- **Canary/not-stable subdomain**: If this preview deployment ever has an XSS
  vulnerability (common on preview builds that may include debug tooling), an attacker
  can use that XSS to make credentialed requests to the production backend from a
  whitelisted origin — a classic CORS-via-XSS escalation.

#### How it happened

Origins were added incrementally during development and never cleaned up for production
deployment.

#### Remediation

1. Remove `"http://localhost:5173"` and `"http://127.0.0.1:5173"` from the hardcoded
   list; configure them via an environment variable read at startup.
2. Either harden the canary subdomain to the same security bar as production, or
   remove it from the production CORS list and have it call a staging backend.

---

### H-05 — `oracle-endpoint.ts`: `ingestUrl` and `ingestBatchUrl` Are Identical

**Affected file:** `cloudflare-worker/src/oracle-endpoint.ts`
**Subsystem:** Cloudflare Worker

#### What was found

```cloudflare-worker/src/oracle-endpoint.ts#L19-21
const EXTENSION_INGEST_BATCH_PATH = "/ingest-batch";
...
ingestUrl:      `${baseUrl}${EXTENSION_INGEST_BATCH_PATH}`,
ingestBatchUrl: `${baseUrl}${EXTENSION_INGEST_BATCH_PATH}`,
```

Both fields resolve to the exact same URL. Every consumer that uses `ingestUrl`
instead of `ingestBatchUrl` (or vice versa) will get identical results but the
semantic difference between the two names is never explained.

#### Why it is a problem

- Introduces confusion for future maintainers — it implies two distinct paths that do
  not exist.
- If the intended design was to have `ingestUrl` point to a single-event endpoint and
  `ingestBatchUrl` to a batch endpoint, only one path is currently implemented and the
  API contract is silently broken.

#### Remediation

Remove `ingestUrl` from the return type and all call sites, keeping only
`ingestBatchUrl` (the semantically correct name for the batch path). If a separate
single-event endpoint is planned, add it when it is implemented.

---

### H-06 — `SESSION_BINDING_MODE=optional` Provides False Fingerprint Security

**Affected file:** `cloudflare-worker/src/index.ts`
**Subsystem:** Cloudflare Worker

#### What was found

```cloudflare-worker/src/index.ts#L270-280
const expectedFingerprint = await buildSessionFingerprint(clientIp, clientUserAgent);
if (timingSafeStringEqual(payload.fp, expectedFingerprint)) {
  return true;
}
if (bindingMode === "strict") {
  return false;
}
return true;  // optional mode: fp mismatch is allowed through
```

In `optional` mode, a fingerprint mismatch **silently returns `true`** (the token is
accepted). This means a stolen session cookie used from a different IP or user-agent
is accepted without any warning or logging.

#### Why it is a problem

- The name "optional" implies the binding adds some protection. In practice it adds
  zero protection against cookie theft — the attacker just needs the cookie value.
- There is no audit log or counter increment on fingerprint mismatch in optional mode,
  so there is no visibility into token reuse.

#### Remediation

When `optional` mode detects a fingerprint mismatch, at minimum:
1. Log a `warn` level event with the expected vs actual IP prefix (not full IP).
2. Increment a mismatch counter in the Durable Object for alerting.

Consider renaming `optional` → `audit` to make the semantics clear in documentation
and configuration.

---

### H-07 — Bypass Tab Removal With 5-Second Delay May Close Wrong Tab

**Affected file:** `extension/entrypoints/background/index.ts`
**Subsystem:** Extension

#### What was found

```extension/entrypoints/background/index.ts#L121-127
if (message.type === 'CQD_BYPASS_SUCCESS') {
  ...
  setTimeout(() => {
    try { chrome.tabs.remove(tabId); } catch {}
  }, 5000);
  return;
}
```

The bypass tab is removed 5 seconds after the success message. Chrome reuses tab IDs;
within 5 seconds the same integer tab ID can be assigned to a new tab opened by the
user or another extension.

#### Why it is a problem

Under normal usage, 5 seconds is usually safe. But under adverse conditions (slow
machine, many rapid tab opens), the user's active tab can be closed unexpectedly. The
failure is silent — the `catch {}` swallows any error.

#### Remediation

Before calling `chrome.tabs.remove`, verify the tab still exists and is still a Drive
download tab:

```/dev/null/fix.ts#L1-8
setTimeout(async () => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && tab.url.includes('drive.google.com')) {
      chrome.tabs.remove(tabId);
    }
  } catch { /* tab already closed */ }
}, 5000);
```

---

### H-08 — `pendingByUrl` Map Silently Clobbers Concurrent Downloads of Same URL

**Affected file:** `extension/entrypoints/background/download-handler.ts`
**Subsystem:** Extension

#### What was found

```extension/entrypoints/background/download-handler.ts#L130-131
pendingByRequestId.set(requestId, pending);
pendingByUrl.set(baseUrl, pending);
```

`pendingByUrl` is a `Map<string, PendingDownload>` keyed by the base URL. If a user
clicks the download button on the same file twice in quick succession (two different
requests with the same URL), the second write silently replaces the first. The first
`pending` object is then orphaned in `pendingByDownloadId` but no longer reachable
from `pendingByUrl`.

#### Why it is a problem

- The first download's UI button never receives a `success` or `error` status message;
  it will stay in `loading` state until the 10-minute orphan TTL cleanup runs.
- When `onDeterminingFilename` fires for the second download but the URL lookup finds
  the second pending, the first download is silently dropped.

#### Remediation

Use a `Map<string, Set<PendingDownload>>` for `pendingByUrl` so multiple downloads of
the same URL can coexist. Update all readers to handle the set.

---

### H-09 — Go Dockerfile References Non-Existent Go Version `1.26`

**Affected file:** `oracle-backend/Dockerfile`
**Subsystem:** Oracle Backend

#### What was found

```oracle-backend/Dockerfile#L4
FROM golang:1.26-alpine AS builder
```

As of the current Go release history, version `1.26` does not exist. The latest stable
release at time of writing is Go `1.22.x`. This will cause `docker build` to fail with
`manifest unknown` when the image is pulled from Docker Hub.

#### Why it is a problem

- Docker builds fail in CI and during deployments.
- If a `1.26` tag is eventually published by an unofficial or compromised account
  before the official Go team does, the image could be pulled from a malicious source.

#### How it happened

Likely a forward-looking version number was written anticipating an upgrade, then never
corrected after the actual new version was pinned.

#### Remediation

Pin to the current latest stable Go version:

```/dev/null/fix.dockerfile#L1
FROM golang:1.22-alpine AS builder
```

Enable Dependabot or Renovate to keep this up to date automatically (a `renovate.json`
already exists at the repo root — add the Dockerfile update rule).

---

## 5. MEDIUM Findings

---

### M-01 — Inconsistent Structured Logging Across Oracle Backend

**Affected files:** `oracle-backend/internal/handlers/admin_sql.go`,
`oracle-backend/internal/handlers/pipeline.go` vs. `store_batch.go`, etc.
**Subsystem:** Oracle Backend

Some handlers use the project's own `logEvent()` (emits JSON), while others call
`log.Printf()` directly (emits plain text):

```oracle-backend/internal/handlers/admin_sql.go#L105-106
log.Printf("[SQLQuery] query error: %v", err)
```

```oracle-backend/internal/handlers/store_batch.go#L63-65
logEvent("warn", "ingest_unauthorized", fields)
```

Mixed log formats break any log-aggregation pipeline (e.g., structured JSON lines
shipped to a SIEM or CloudWatch Logs Insights). Queries that filter by `level` or
`message` fields will miss the `log.Printf` lines.

**Remediation:** Replace all `log.Printf` calls in handler files with `logEvent()`.

---

### M-02 — `docker-compose.yml` Uses Obsolete Compose Schema `version: '3.8'`

**Affected file:** `oracle-backend/docker-compose.yml`
**Subsystem:** Oracle Backend

```oracle-backend/docker-compose.yml#L3
version: '3.8'
```

Docker Compose v2+ (the current CLI) ignores the `version` field and emits a
deprecation warning. The Compose specification no longer uses version keys.

**Remediation:** Remove the `version: '3.8'` line.

---

### M-03 — `X-Requested-With: XMLHttpRequest` CSRF Check Is Trivially Forgeable

**Affected file:** `oracle-backend/internal/handlers/public_website.go`
**Subsystem:** Oracle Backend

```oracle-backend/internal/handlers/public_website.go#L748-751
if strings.TrimSpace(r.Header.Get("X-Requested-With")) != "XMLHttpRequest" {
    writePublicWebsiteError(w, http.StatusBadRequest,
        "missing_required_header", "X-Requested-With header is required.", false)
    return
}
```

This check is used in the uninstall feedback and newsletter subscribe handlers as a
form of CSRF protection. The `X-Requested-With` header is not a reliable CSRF
mitigation: `curl`, `fetch()`, and `XMLHttpRequest` can all set it freely. The actual
CSRF protection is provided by CORS (the `Origin` header check), which already happens
earlier in the call chain.

**Impact:** Low exploitation risk (CORS provides the real defence), but the check
creates a false sense of added security and may mislead security reviewers.

**Remediation:** Remove the `X-Requested-With` check and document that CORS origin
validation is the CSRF mitigation for these endpoints.

---

### M-04 — `wxt.config.ts` Hardcodes Personal Workers.dev Subdomain in Extension

**Affected file:** `extension/wxt.config.ts`
**Subsystem:** Extension

```extension/wxt.config.ts#L40-41
'https://cqd-analytics.adhamhaithameid.workers.dev/*',
```

The host permission uses a personal `adhamhaithameid.workers.dev` subdomain. If this
worker is ever moved to a custom domain or account, the extension must be re-published
with updated permissions and all existing users' extensions will stop sending analytics
until they update.

**Remediation:** Use the production custom domain
(`https://oracle.classroom-quick-downloader.com/*`) in host permissions, and keep the
workers.dev URL only as a fallback in non-production builds.

---

### M-05 — `ALLOW_INSECURE_COOKIES` Env Var Requires Exact Lowercase String `"true"`

**Affected file:** `cloudflare-worker/src/index.ts`
**Subsystem:** Cloudflare Worker

```cloudflare-worker/src/index.ts#L305
const allowInsecure = env?.ALLOW_INSECURE_COOKIES === 'true';
```

Setting `ALLOW_INSECURE_COOKIES=TRUE` or `ALLOW_INSECURE_COOKIES=1` silently does
nothing, leaving the cookie as `Secure` in an environment where that may not be
intended. This is inconsistent with how most environment variable parsing treats
boolean flags.

**Remediation:**

```/dev/null/fix.ts#L1
const allowInsecure = (env?.ALLOW_INSECURE_COOKIES ?? '').trim().toLowerCase() === 'true';
```

---

### M-06 — Changelog Auto-Sync Fetches Markdown From GitHub Without Content Verification

**Affected file:** `cloudflare-worker/src/downloads_do.ts` (`fetchMarkdownFromUrl`)
**Subsystem:** Cloudflare Worker

The auto-sync feature periodically fetches a markdown file from a GitHub raw URL:

```cloudflare-worker/src/downloads_do.ts#L392-393
const USER_FRIENDLY_CHANGELOG_GITHUB_URL =
  "https://raw.githubusercontent.com/adhamhaithameid/Classroom-Quick-Downloader/main/user-friendly-changelog.md";
```

The fetched content is sanitised before use, but there is no length pre-check before
the full `text()` read, and no cryptographic signature verification.

**Impact:** If the GitHub repo or the raw CDN is compromised, malicious changelog
content could be injected. The sanitiser limits damage, but the trust chain is weak.

**Remediation:**
1. Cap the allowed response `Content-Length` before calling `text()` (already done with
   a 10-second timeout, but no byte cap is enforced).
2. Document in `ARCHITECTURE.md` that this fetch trusts the GitHub CDN implicitly.
3. Consider signing releases and verifying signatures.

---

### M-07 — `detectEdited` Layer 4 Exclusion Check Is Semantically Unclear

**Affected file:** `extension/entrypoints/content/smart-detector.ts`
**Subsystem:** Extension

```extension/entrypoints/content/smart-detector.ts#L342-344
const isEdited = primaryMatch.matchedText !== null &&
                 layer4.score >= 0; // Not penalized by exclusion
```

`LAYER_4_EXCLUSION` is `-25`. When exclusion fires, `layer4.score = -25`, making
`layer4.score >= 0` false — correct. When exclusion does not fire, `layer4.score = 0`,
making the check true — also correct. **The logic is functionally correct**, but the
condition is not idiomatic. A reader unfamiliar with the negative-score convention
could mistake `>= 0` for "score is positive/good" rather than "not penalised".

This is also fragile: if `LAYER_4_EXCLUSION` is ever changed to `0` during a weight
tuning exercise, the exclusion engine will silently stop filtering keywords.

**Remediation:** Replace the magic comparison with a named constant or explicit check:

```/dev/null/fix.ts#L1-2
const EXCLUSION_FIRED = layer4.score < 0;
const isEdited = primaryMatch.matchedText !== null && !EXCLUSION_FIRED;
```

---

### M-08 — `parsedAllowedOriginsCache` Grows Without Bound Under Varied Config Values

**Affected file:** `cloudflare-worker/src/index.ts`
**Subsystem:** Cloudflare Worker

`parseAllowedOrigins(raw)` uses `raw.trim()` as the cache key. If `CORS_ALLOWED_ORIGINS`
has slight formatting variants between deploys, the cache will accumulate entries that
are never evicted for the lifetime of the isolate (potentially hours). The cache size is
small in practice, but it is an unbounded allocation with no eviction policy.

**Remediation:** Either remove the cache (as recommended in H-03) or cap it at a fixed
size (e.g., 10 entries) with LRU eviction.

---

### M-09 — Uninstall Stats GET Endpoint Has No Access Control

**Affected file:** `oracle-backend/internal/handlers/public_website.go`
**Subsystem:** Oracle Backend

```oracle-backend/internal/handlers/public_website.go#L722-731
case http.MethodGet:
    stats, err := loadPublicWebsiteUninstallStats(r.Context(), sqliteDB)
    if err != nil {
        writePublicWebsiteError(...)
        return
    }
    writePublicWebsiteJSON(w, http.StatusOK, publicWebsiteUninstallStatsResponse{...})
    return
```

The GET handler for `/api/public/website/uninstall` returns uninstall statistics —
including top reasons users removed the extension — to any unauthenticated caller.
While not a PII leak, this reveals product health data (churn signals, failure modes)
that a competitor or attacker could use for targeting.

**Remediation:** Move this endpoint behind the admin authentication layer, or add a
separate admin-only route for the aggregate statistics while keeping the POST (feedback
submission) endpoint public.

---

### M-10 — `while (true)` Polling Loops Consume Event Loop Continuously

**Affected file:** `extension/entrypoints/content/download-handler.ts`
**Subsystem:** Extension

```extension/entrypoints/content/download-handler.ts#L68-78
while (true) {
  await delay(200);
  if (getButtonState(button) !== 'cancelled') return;
  if (Date.now() >= maxReset) break;
  if (Date.now() >= earliestReset && !button.matches(':hover')) break;
}
```

The same `while (true) / await delay(200)` pattern is used in `handleCancelClick`,
`showErrorState`, and `waitForSuccessReset`. Each active download button spawns one
of these loops that wakes up every 200 ms for the full `MAX_TERMINAL_STATE_MS`
duration (if the user keeps hovering).

**Impact:** On a Google Classroom page with many attachments and a user who keeps
buttons hovered, dozens of these 200 ms timers can run simultaneously, contributing
to main-thread jitter in the content script context.

**Remediation:** Replace the polling loops with `Promise.race` over a `setTimeout`
for the max reset and a `mouseleave` event listener for the hover condition. This
eliminates the polling entirely and is more responsive.

---

## 6. LOW / Informational Findings

---

### L-01 — `docker-compose.yml` Exposes Port 8080 Directly Without TLS Termination

**Affected file:** `oracle-backend/docker-compose.yml`
**Subsystem:** Oracle Backend

> **Status (2026-03-11):** Closed. The compose stack now fronts the backend with
> Caddy on ports `80/443`, and backend health checks stay internal to the app container.

```oracle-backend/docker-compose.yml#L10-11
ports:
  - "8080:8080"
```

The compose file maps port 8080 (HTTP) directly to the host. There is no TLS
terminator (nginx, Caddy, Traefik) declared in the compose file. Production deployments
rely on an external reverse proxy not described in the repository, making the deployment
architecture partially undocumented.

**Remediation:** Add an nginx or Caddy service to the compose file that terminates TLS
and proxies to the Go backend. Document the external proxy requirement in `README.md`
or `ARCHITECTURE.md`.

---

### L-02 — `logEvent()` Has No Request Correlation ID

**Affected file:** `oracle-backend/internal/handlers/logging.go`
**Subsystem:** Oracle Backend

```oracle-backend/internal/handlers/logging.go#L16-25
func logEvent(level string, message string, fields map[string]interface{}) {
    payload := logPayload{
        Level:   level,
        Message: message,
        Time:    time.Now().UTC().Format(time.RFC3339),
        Fields:  fields,
    }
    ...
}
```

`logEvent` does not accept a `context.Context`, so it cannot attach a request-scoped
trace/correlation ID to log entries. When multiple concurrent requests generate errors,
log entries from different requests are interleaved with no way to group them.

**Remediation:** Add a `context.Context` parameter and read a request ID from the
context (set in middleware). Use `slog` (Go 1.21+) which natively supports structured,
context-aware logging.

---

### L-03 — `ARG TARGETARCH=arm64` Default May Mismatch CI/CD Environment

**Affected file:** `oracle-backend/Dockerfile`
**Subsystem:** Oracle Backend

```oracle-backend/Dockerfile#L18-19
ARG TARGETARCH=arm64
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build ...
```

The default target architecture is `arm64`. Most CI/CD pipelines (GitHub Actions
`ubuntu-latest`, standard Docker Hub builders) run on `amd64`. Builds that do not
pass `--build-arg TARGETARCH=amd64` explicitly will produce an `arm64` binary in an
`amd64` container, which will fail at startup with `exec format error`.

**Remediation:** Set the default to `amd64`, use Docker Buildx `--platform` for
multi-arch builds, or remove the default entirely and require it to be specified
explicitly in CI.

---

### L-04 — `deploy.sh` Is an Indirection Wrapper With No Added Value

**Affected file:** `oracle-backend/deploy.sh`
**Subsystem:** Oracle Backend

```oracle-backend/deploy.sh#L7-9
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/scripts/deploy_main_inplace.sh" "$@"
```

`deploy.sh` does nothing except call `scripts/deploy_main_inplace.sh`. The comment
explains it exists for backward compatibility with an older flow. This wrapper silently
ignores any future changes to the calling convention and adds a layer of indirection
that can confuse new contributors who wonder why `deploy.sh` is nearly empty.

**Remediation:** Either delete `deploy.sh` and update all references to call
`scripts/deploy_main_inplace.sh` directly, or inline the compatibility shim with a
prominent deprecation notice.

---

### L-05 — Extension `wxt.config.ts` Has No `web_accessible_resources` Scoping

**Affected file:** `extension/wxt.config.ts`
**Subsystem:** Extension

The manifest does not declare `web_accessible_resources`, which means WXT's default
generates an entry that may be overly broad. While WXT handles this automatically,
without an explicit declaration it is harder to audit exactly which extension assets
are accessible from web pages — a vector for extension fingerprinting.

**Remediation:** Add an explicit `web_accessible_resources` entry in `wxt.config.ts`
listing only the assets that content scripts inject into pages (icons, CSS), scoped to
`https://classroom.google.com/*`.

---

### L-06 — `recentDownloads` Map Has No Maximum Size Cap

**Affected file:** `extension/entrypoints/background/cleanup.ts`
**Subsystem:** Extension

```extension/entrypoints/background/cleanup.ts#L53-57
// Also clean recentDownloads older than TTL
for (const [filename, timestamp] of recentDownloads.entries()) {
  if (timestamp < staleThreshold) {
    recentDownloads.delete(filename);
  }
}
```

`recentDownloads` tracks filenames of completed downloads (used for Firefox file-tab
auto-close). It is only pruned by age. If a user downloads thousands of uniquely named
files within the 10-minute TTL window, the map grows unboundedly until cleanup runs.
The `cancelledByUs` set has an explicit size cap (100 entries), but `recentDownloads`
does not.

**Remediation:** Add a size cap analogous to the `cancelledByUs` guard:

```/dev/null/fix.ts#L1-5
if (recentDownloads.size > 200) {
  const oldest = [...recentDownloads.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, recentDownloads.size - 100);
  oldest.forEach(([k]) => recentDownloads.delete(k));
}
```

---

## 7. Positive Observations

The following patterns demonstrate strong engineering discipline and should be
**preserved and extended** throughout the codebase.

---

### ✅ Constant-Time Password Comparison

Both `index.ts` and `downloads_do.ts` implement a best-effort constant-time string
comparison using XOR accumulation to avoid early exit on password checks. The function
includes an honest comment about JS JIT limitations. The Oracle backend uses Go's
`crypto/subtle.ConstantTimeCompare` for the `X-DO-SECRET` header check — the gold
standard.

---

### ✅ Body Size Limits on Every Ingest Path

Every HTTP handler that reads a request body wraps it with a size limiter:

- Oracle: `http.MaxBytesReader(w, r.Body, 5<<20)` (5 MB)
- Cloudflare DO: `WEBSITE_EVENTS_BODY_LIMIT_BYTES` constant enforced before parsing
- Oracle public events: `publicWebsiteEventsBodyLimitBytes`

This consistently prevents OOM/DoS through unbounded body reads.

---

### ✅ Parameterised SQL Throughout the Oracle Backend

Every SQL query in the Go backend uses `?` placeholders with bound parameters. No
string concatenation is used to build SQL. The `#nosec G701` comments confirm each
site has been reviewed. The `admin_sql.go` SQL console adds a multi-layer policy
check (single-statement, read-only detection, forbidden term regex, allowlisted tables)
before executing any user-supplied SQL — a well-designed defence.

---

### ✅ URL Validation Before Every Download (Extension)

The extension validates download URLs using `validateDownloadUrl()` before passing
them to `chrome.downloads.download()` — including on Drive auth-rotation retry
attempts and direct single downloads. This prevents the extension from being tricked
into downloading arbitrary URLs injected via page manipulation.

---

### ✅ IP Allowlist + Step-Up Authentication for Danger Operations

The dashboard implements a two-tier auth model: standard session login, and a separate
"danger step-up" short-lived token required for destructive operations. The Durable
Object tracks login attempts per IP and enforces lockouts. The IP allowlist provides
an additional perimeter for dashboard access. This is a production-grade admin
security model.

---

### ✅ Structured JSON Logging in Go Backend

`logEvent()` emits newline-delimited JSON, making logs compatible with any log
aggregator (CloudWatch, Datadog, Loki). The consistent `level`, `message`, `time`, and
`fields` schema means alerting rules can be written declaratively.

---

### ✅ Content-Security-Policy on Dashboard HTML Responses

```cloudflare-worker/src/index.ts#L391-400
const HTML_SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; ...",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};
```

All dashboard HTML pages are served with a strict CSP, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, and `Permissions-Policy`. This is a comprehensive
set of defensive headers applied uniformly via `withHtmlSecurityHeaders()`.

---

### ✅ Non-Root Docker User

```oracle-backend/Dockerfile#L22-27
RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup
...
USER appuser
```

The production container explicitly runs as a non-root user. Combined with
`CGO_ENABLED=0` (no C runtime dependency) and a minimal Alpine base image, the attack
surface of the container is well controlled.

---

### ✅ Idempotent Batch Ingestion

Both the SQLite and PostgreSQL ingest paths are idempotent by `batch_id`. Duplicate
deliveries from the Cloudflare DO retry logic will not cause double-counting. This is
a critical correctness property for analytics pipelines.

---

## 8. Remediation Priority Matrix

| ID | Subsystem | Finding | Effort | Priority |
|----|-----------|---------|--------|----------|
| C-01 | CF Worker | Committed `.dev.vars` credentials | Low | ✅ Closed |
| C-02 | CF Worker | Infra IDs + IP in `wrangler.toml` | Low | ✅ Partially closed: raw IP/account ID removed; required binding IDs retained as non-secret deployment metadata |
| C-03 | CF + Oracle | HTTP (not HTTPS) Worker→Oracle | Medium | ✅ Closed: Worker defaults/workflow now require HTTPS Oracle endpoints |
| H-09 | Oracle | Dockerfile Go 1.26 (non-existent) | Low | 💤 Stale finding |
| H-02 | Oracle | Error details leaked in HTTP responses | Low | ✅ Closed |
| H-04 | Oracle | localhost origins in production CORS | Low | ✅ Closed |
| H-01 | CF Worker | Duplicate `timingSafeStringEqual` | Low | ✅ Closed |
| H-08 | Extension | `pendingByUrl` clobbers concurrent downloads | Medium | 🔓 Still open |
| H-07 | Extension | Bypass tab closes wrong tab (race) | Low | 🔓 Still open |
| H-03 | CF Worker | CORS origin cache never expires | Low | ✅ Closed |
| H-05 | CF Worker | `ingestUrl === ingestBatchUrl` dead code | Low | ✅ Closed |
| H-06 | CF Worker | Optional session binding silent pass | Medium | ✅ Closed |
| M-01 | Oracle | Inconsistent structured logging | Low | ✅ Closed |
| M-07 | Extension | `isEdited` exclusion check fragile | Low | 🔓 Still open |
| M-10 | Extension | `while(true)` polling in content script | Medium | 🔓 Still open |
| M-04 | Extension | Personal workers.dev in host permissions | Low | 🔓 Still open |
| M-02 | Oracle | Obsolete `version: '3.8'` in compose | Trivial | ✅ Closed |
| M-03 | Oracle | `X-Requested-With` false CSRF protection | Low | ✅ Closed |
| M-05 | CF Worker | `ALLOW_INSECURE_COOKIES` case-sensitivity | Trivial | ✅ Closed |
| M-06 | CF Worker | Changelog fetch no content verification | Medium | ✅ Closed |
| M-08 | CF Worker | Origin cache unbounded growth | Low | ✅ Closed |
| M-09 | Oracle | Uninstall stats publicly accessible | Low | ✅ Closed |
| L-01 | Oracle | No TLS terminator in docker-compose | Medium | ✅ Closed: compose stack now fronts Oracle with Caddy on `80/443` |
| L-02 | Oracle | No correlation ID in `logEvent` | Medium | ✅ Closed |
| L-03 | Oracle | Wrong default TARGETARCH in Dockerfile | Low | ✅ Closed |
| L-04 | Oracle | `deploy.sh` indirection wrapper | Trivial | ✅ Effectively closed (deprecated and documented) |
| L-05 | Extension | No explicit `web_accessible_resources` | Low | 🔓 Still open |
| L-06 | Extension | `recentDownloads` no size cap | Low | 🔓 Still open |

---

*Report generated by full static analysis across all four project subsystems.*
*No dynamic testing (fuzzing, runtime probes) was performed — findings reflect
source-code review only.*
