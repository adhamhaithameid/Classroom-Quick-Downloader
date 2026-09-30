# Website Security Audit — 2026-09-30

**Scope:** the internet-facing website stack — `website/` (SvelteKit static site on Cloudflare Pages), `cloudflare-worker/` (the `cqd-analytics` Worker: public API + admin dashboard + D1/KV/DO data plane), CI/CD workflows, and repo hygiene. The browser extension was audited separately (see `docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md`); `oracle-backend/` is out of scope except for Mimosa triage (it is severed from production).

**Method:** Mimosa deep scan (sealed), three parallel code audits (Worker surface, website client, CI/repo), live probes of production (GET/HEAD only), full git-history secret scan.

**Overall verdict: no known exploitable pre-auth path.** All mutating/admin endpoints authenticate (verified live: 401s across `/stats`, `/admin/*`, `/dashboard` redirects to login), ingestion endpoints are size/schema/charset-bounded, D1 access is parameterized, no secrets are committed, TLS 1.3 with valid certs, dependency audit green (0 advisories / 46 packages scanned). The real findings are hardening gaps (below), one live operational incident, and spoofable public counters.

---

## Findings

Severity: CRITICAL > HIGH > MEDIUM > LOW > HARDENING. Status: FIXED (this pass) / DEFERRED (bead filed) / ACCEPTED.

### S1 · MEDIUM — No CSP / frame protection on the marketing site — FIXED
The Worker dashboard set an exemplary nonce-based CSP; the public site set none (`website/static/_worker.js:6-7` explicitly declined). A hash-based policy was infeasible as a committed file because SvelteKit's per-page inline bootstrap changes every build.
**Fix:** `_worker.js` now computes `script-src` at the edge — hashes the inline scripts of each HTML response (skips `application/ld+json` and `src=` scripts), caches per-path (bounded 512 entries), and adds `frame-ancestors 'none'` + `X-Frame-Options: DENY` + baseline directives (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`, tightened `img/font/connect` sources). Guard test `website/src/routes/worker.headers.guard.test.ts` extended (9 assertions) — it hashes `app.html`'s inline scripts with node crypto and asserts the builder covers them.

### S2 · MEDIUM — Public write endpoints had no per-IP rate limit — FIXED
`/api/public/website/events` (≤64 events/request) and `/api/public/website/uninstall` POST had no per-IP limiting; only `/track` did.
**Fix:** shared `checkIpMinuteRateLimit` bucket in the DO (events: 30/min/IP; uninstall: 3/min/IP; 429 + `retry-after`), daily privacy reset clears the new buckets alongside `trackRates`. Tests: `cloudflare-worker/tests/website-rate-limits.test.ts` (5).

### S3 · MEDIUM — `/admin/storage-export` needed no danger step-up — FIXED
A stolen session cookie alone could dump the entire DO state (login-attempt IPs, free-text feedback, telemetry queues). The raw console endpoints already required step-up; the full-state dump did not.
**Fix:** `/admin/storage-export` added to `DANGER_STEP_UP_PATHS` (`cloudflare-worker/src/index.ts`); literal `X-Admin-Secret` (CI backups) still passes.

### S4 · MEDIUM — Fork-PR title → shell command in CI — FIXED
`.github/workflows/duplicate-pr-check.yml:74` ran `execSync("gh pr comment N --body ${JSON.stringify(body)}")` where `body` embeds other open PRs' titles (fork-controlled). `JSON.stringify` does not neutralize `$(...)`/backticks inside a bash double-quoted string → command substitution on a maintainer-triggered run. Blast radius was small (no secrets in job), but the pattern is a real CI-compromise primitive.
**Fix:** body written to a file, `gh pr comment --body-file`.

### S5 · LOW — Admin sessions bound to nothing by default — FIXED
With `SESSION_BINDING_MODE` unset, a stolen `cqd_session` cookie worked from any IP/UA for its TTL.
**Fix:** `SESSION_BINDING_MODE = "optional"` in `wrangler.toml` — cookies are fingerprint-bound (IP prefix + UA hash); mismatches are logged and still accepted, so a stolen cookie is *detectable* without locking the owner out. Upgrade to `strict` documented.

### S6 · LOW — `/pipeline-health` exposed internal detail publicly — FIXED
Queue depths, batch/correlation IDs, sequence numbers, thresholds, and error strings were readable by anyone (recon surface).
**Fix:** unauthenticated callers now get `{ok, status, reasons}` only; the full payload requires admin auth (the cron alert consumer already authenticates).

### S7 · LOW — SVG `{@html}` sink lacked re-validation — FIXED
`/overview` and `/overview-editor` render placement SVGs via `{@html}`; values from localStorage are validated by `isSafeSvgMarkup()` on load, but the resolvers returned `customSvg` unchecked — any future code path that skipped normalization would bypass the filter.
**Fix:** both resolvers (`website/src/lib/svgCatalog/placements.ts`, `overview-editor/+page.svelte`) re-validate at the sink and fall back to empty output. `isSafeSvgMarkup` exported. Tests added.

### S8 · LOW — Dead-but-armed markdown sink — FIXED
`website/src/lib/content/repoMarkdown.ts` ran `marked.parse()` with no sanitizer and had zero importers — one wire-away from stored XSS. Deleted (with the now-unused `marked` dependency; lockfile refreshed).

### S9 · LOW — Backup workflow never worked — FIXED (with Phase 0)
`data-backups.yml` passed SQL to `wrangler d1 execute` positionally; `wrangler@latest` requires `--command` — every run since creation (Sep 24) failed at export. Fixed. Consequence: daily DO-state dumps never ran, which is also why the pipeline incident below went unnoticed.

### S10 · HIGH (operational, not a breach) — Extension analytics pipeline is failing — UNDER INVESTIGATION (P0)
Live `/pipeline-health`: `status: critical`, 28 consecutive flush failures, last successful extension-buffer flush 2026-08-17, one batch pending ~43 days. Differential diagnosis: the website-telemetry path flushes to the same D1 database successfully (rows ACKed the same day), so D1 is healthy and the failure is specific to the extension pipeline's head batch — a deterministically failing "poison batch" retrying forever, blocking everything behind it. The exact `lastError` needs `/stats` (admin). A `worker-diagnostic.yml` workflow (dispatch-only, prints retry state) was added to extract it via CI secrets; the fix (DLQ the head batch after N attempts + payload size cap) is designed and beaded.

### S11 · MEDIUM — Public download counters are spoofable — DEFERRED (bead)
`/track` accepts a client-supplied rollup `count` (up to 100,000 per event) with no auth — anyone can inflate the public total. Data-integrity issue, not a breach. Suggested design: server-side per-batch caps + anomaly flagging rather than client counts.

### S12 · LOW — Uninstall free-text hygiene — FIXED
User-typed `reason`/`notes` kept control characters and were served publicly via `topReasons`. Ingest now strips control chars/collapses whitespace (`sanitizeUserFreeText`). Full bucketed aggregation deferred (product decision).

### S13 · LOW — D1 archive grows forever — FIXED
No DELETE existed against `event_archive`. The daily alarm now prunes rows older than 400 days (matching request-history retention), best-effort.

### S14 · LOW — Repo hygiene — FIXED
Committed DO sqlite blob removed from tracking (`.wrangler/` rule predates it); `.gitignore` now covers simulator private keys; `docs/BACKUPS.md` no longer publishes the service-account email/sheet ID; stale `final-river-carp.md` claim corrected (oracle `.env` was never committed — verified via full-history scan); `socket-security.yml` now installs `--frozen-lockfile`; CODEOWNERS added.

---

## Mimosa deep scan triage (scan `scan-2026-09-30T16-55-18.009Z-1a29c5274363`, seal `sha256:a329bfe4…`, 43 findings)

| Finding group | Count | Verdict |
| --- | --- | --- |
| HIGH `fetch()` SSRF, cloudflare-worker (`proxyToDO`, changelog fetch, webhook, mirror, session-binding report) | 30 | **False positive.** Targets verified: `https://do` fixed origin (client Host cannot retarget), raw-GitHub/GitHub host allowlist + https + `redirect: "error"`, env-only `ALERT_WEBHOOK_URL`/`ORACLE_ENDPOINT` (https-enforced). No request input reaches a fetch URL. Systemic note: protections are per-site conventions, not one centralized egress allowlist utility — worth consolidating when the license API (Phase 3) adds new outbound calls. |
| HIGH command injection, `oracle-backend` (`git rev-parse/log`, archiver exec) | 4 | **False positive.** Fixed argv, no shell interpolation; archiver path validated via `resolveArchiverPath` with an explicit gosec triage comment. Backend is severed from production regardless. |
| HIGH `runArchiver` security entry (env → exec) | 2 | **False positive** (same as above; env vars are operator-controlled config). |
| MEDIUM mongo-sort-injection, `release-notes.ts` | 2 | **False positive.** No MongoDB exists anywhere in the stack (D1/SQLite); the flagged `sort` is array sorting of sanitized entries. |
| MEDIUM XSS `engine-v3.ts` → test `innerHTML` | 1 | **False positive (test hygiene).** Sink is in a test file, not shipped code. |
| HIGH/MEDIUM path traversal, `tools/capture-classroom-snapshot.ts` → `qa/harness.ts` screenshot path | 3 | **Accepted risk.** Local developer CLI writing to an operator-supplied path; not internet-exposed. |
| Call-graph coverage gap | — | Scan self-reported "inconclusive" coverage (dynamic dispatch); the manual audits above cover the flagged files. |

## Live production probes (2026-09-30)

| Check | Result |
| --- | --- |
| Site security headers | HSTS/nosniff/referrer/permissions present; **CSP/XFO were missing → fixed via S1** |
| Worker login page CSP | Nonce-based CSP, `X-Frame-Options: DENY`, HSTS — exemplary |
| Admin endpoints unauthenticated | `/stats`, `/admin/storage-export`, `/admin/website/console/*` → 401; `/dashboard` → 302 to login |
| TLS | TLS 1.3, Google Trust Services certs, valid to Dec 2026, both hosts |
| Robots/AI crawlers | Intentionally fully open — confirmed as policy |
| `github.io` graph site | HSTS present; no CSP is a GitHub Pages platform limit (static graph only, vendored vis-network **with SRI**) |

## Deferred items (beads)

- Poison-batch tolerance + exact flush root cause (P0)
- Public counter spoof resistance (S11)
- Uninstall reason bucketing (S12 follow-up)
- Simulator private-key un-commit (needs a verified CI/E2E window)
- Branch protection completion (needs owner console action — ready JSON in `docs/E2E_BROWSER_MATRIX.md:234-252`), tag ruleset for `v*`
- Oracle-backend dedicated pass (severed; triaged above)
