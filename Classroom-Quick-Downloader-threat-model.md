# Classroom-Quick-Downloader — Threat Model (website stack)

Date: 2026-09-30 · Scope: `website/` + `cloudflare-worker/` + CI/CD · Companion audit: `docs/SECURITY_AUDIT_WEBSITE_2026-09-30.md`

## 1. System model

| Component | Runtime | Trust level |
| --- | --- | --- |
| Marketing site (`website/`) | SvelteKit static bundle on Cloudflare Pages, headers via Pages Function `_worker.js` | Public, zero server state |
| Worker `cqd-analytics` (`cloudflare-worker/src/index.ts`) | Cloudflare Worker: public JSON API, telemetry ingest, password-login admin dashboard | Internet-exposed; holds admin gate |
| Durable Object `DownloadsDurable` (`downloads_do.ts`) | Singleton state machine: event buffer, telemetry queues, rate-limit buckets, audit logs | Backend; reachable only via Worker (RPC/fixed `https://do` origin) |
| D1 `SITE_CACHE_DB` | `event_archive` table (append + daily prune) | Backend storage |
| KV `SITE_SNAPSHOT_KV` | Snapshot/trends/config cache (1yr TTL) | Backend storage |
| CI/CD | GitHub Actions → Cloudflare API (Pages + Worker deploy), backups with `DO_SHARED_SECRET` + Google Sheets service account | Highest-value pivot target |

Out of scope: browser `extension/` (audited 2026-09-24), `oracle-backend/` (severed; triage only).

## 2. Trust boundaries

1. **Visitor browser → Pages**: static content only; no server state to compromise. Headers (now CSP) limit post-defacement damage.
2. **Visitor/extension → Worker public API**: unauthenticated writes (`/track`, `/api/public/website/events`, uninstall). Bounded by schema/charset/size caps, per-IP minute limits, queue caps, daily quota guard.
3. **Admin browser → Worker dashboard**: password → HMAC session cookie (+ IP/UA fingerprint binding in `optional` mode) → CSRF (Origin allowlist + `X-Requested-With`) → danger step-up cookie for raw paths. Alternative: literal `X-Admin-Secret` header (CI only).
4. **Worker ↔ DO**: fixed `https://do` RPC origin; server-side secret injection.
5. **Worker/DO → external fetches**: store scrapers (hardcoded URLs), GitHub changelog (host allowlist + https + no-redirect), optional Oracle mirror + alert webhook (env-only URLs, https-enforced).
6. **CI → Cloudflare/Google**: `CLOUDFLARE_API_TOKEN` (Pages+Worker deploy), `DO_SHARED_SECRET`, Google Sheets service account, Search Console creds.

## 3. Assets

- **Integrity of public numbers** (download totals on the live site) — *spoofable today via `/track` rollup counts (S11)*.
- **DO state** (analytics, uninstall free-text, login-attempt IPs, audit logs) — protected by admin gate + step-up on raw/export paths.
- **Secrets** (`DO_SHARED_SECRET`, `DASHBOARD_PASSWORD`, `DANGER_PASSWORD`, Cloudflare tokens, Google service account) — CI-only; none committed (verified full history).
- **Availability** — Worker daily quota guard + rate limits; site is static (CDN-scale).
- **Code/deploy pipeline** — compromise = site/Worker replacement (supply chain to every visitor and extension user).
- **Privacy** — no IPs persisted (stripped at ingest; rate-limit keys wiped daily; exception: Cloudflare log persistence holds client IPs — reconciled against PRIVACY.md as a follow-up).

## 4. Attacker capabilities (non-goals excluded)

In scope: anonymous internet attacker, malicious fork-PR author, visitor with devtools, extension user (audited separately), stolen session cookie, leaked CI token. Out: Cloudflare/GitHub insider compromise, full GitHub org takeover, physical access.

## 5. Abuse paths & disposition

| # | Path | Likelihood | Impact | Disposition |
| --- | --- | --- | --- | --- |
| A1 | Pre-auth RCE/injection via public API | Low | High | Parameterized D1, charset allowlists, bounded parsers — no known path; rate limits added (S2) |
| A2 | Admin brute force / credential stuffing | Low | High | 5-attempt lockout/15min per IP, IP allowlist option, danger step-up, binding now on (S5) |
| A3 | Stolen session cookie replay | Medium | High | Step-up on raw/export paths (S3), binding detection (S5); strict mode documented |
| A4 | Counter spoofing (integrity) | **High** | Medium | Open — S11 bead |
| A5 | Telemetry/queue flooding (DoS/cost) | Medium | Medium | Per-IP limits (S2), queue caps, quota kill-switch; D1 prune (S13) |
| A6 | XSS on site visitors | Low | High | No network-driven `{@html}`; SVG allowlist re-checked at sink (S7); CSP now bounds injected-inline risk (S1); dead `marked` sink removed (S8) |
| A7 | CI compromise → supply chain | Low | Critical | No `pull_request_target`/`workflow_run`, SHA-pinned actions, least-privilege permissions; fork-title shell injection fixed (S4); branch-protection completion is the remaining owner action |
| A8 | Secrets exfiltration from repo | Low | Critical | Full-history scan clean; `.dev.vars`/`.env` gitignored + verified uncommitted; ggshield in CI |
| A9 | SSRF via Worker | Low | Medium | All egress allowlisted/env-only (Mimosa SSRF findings triaged false-positive); consolidate into one egress helper when license API lands |
| A10 | Recon via public health detail | Medium | Low | Gated (S6) |

## 6. Key assumptions

- Cloudflare Workers log persistence (100% sampling) may retain client IPs — privacy docs should state this or sampling reduced.
- The GitHub `CLOUDFLARE_API_TOKEN` is scoped to Pages+Worker deploy (recommended); scopes are dashboard config not enforceable in-repo.
- The deployed Worker secret set matches `.dev.vars.example` (verified indirectly: local dev secret ≠ deployed secret).
- `p8tq` free-tier D1/KV quota limits shape the DoS ceiling; the quota kill-switch is the backstop.

## 7. Priority recommendations (beyond this pass)

1. P0: resolve the failing extension pipeline (S10) and add alert delivery (`ALERT_WEBHOOK_URL` is unset — `lastHealthNotifyAt` has never fired).
2. P1: counter spoof resistance (S11) before paid tiers launch — public numbers become marketing claims.
3. P1: finish branch protection + `v*` tag ruleset (owner action; JSON ready).
4. P2: centralize egress fetching into one allowlist helper before the license API adds new outbound calls (Phase 3 design: `docs/FREE_PRO_SECURITY_DESIGN.md`).
5. P3: strict session binding + Cloudflare Access in front of the dashboard when convenient.
