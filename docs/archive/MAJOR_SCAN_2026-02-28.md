# Major Repository Scan Report (2026-02-28)

Scope: `extension`, `website`, `cloudflare-worker`, `oracle-backend`, runtime config verification, and deployment docs.

## Executive Summary

- Full strict + security scan run is green.
- No critical/high vulnerabilities found.
- Dependency audits are clean across all package roots.
- Oracle security scanners are clean (`gosec: 0`, `govulncheck: none`).
- Cloudflare traffic sync implementation is active and verified in production Oracle runtime.

## Commands and Outcomes

- `pnpm run scan:repo` -> PASS
- `pnpm run scan:security` -> PASS
- `pnpm -C website run check` -> PASS (`svelte-check` 0 errors / 0 warnings)
- `pnpm -C extension run compile` -> PASS
- `pnpm -C extension run test -- --maxWorkers=1` -> PASS (47 files / 481 tests)
- `pnpm -C website audit` -> no known vulnerabilities
- `pnpm -C cloudflare-worker audit` -> no known vulnerabilities
- `pnpm -C oracle-backend audit` -> no known vulnerabilities
- `pnpm -C extension audit` -> no known vulnerabilities
- `oracle-backend/scripts/full-scan.sh` -> PASS (`gosec` issues `0`, `govulncheck` none)

## Findings Status

No open scan findings remain after fixes and reruns.

Historical fixed items in this cycle:

- test timeout hardening in Vitest configs (`website`, `cloudflare-worker`, `extension`)
- `@sveltejs/kit` advisory remediation (`GHSA-fpg4-jhqr-589c`)
- Oracle strict ingest test contract alignment (`admin_ops_test.go`)

## Cloudflare Traffic + Oracle Dashboard Status

### Completed

- Oracle DB traffic table and idempotent upsert sync path are implemented.
- Scheduler and manual refresh endpoint are implemented:
  - `POST /api/admin/website/traffic/refresh`
- Analytics payload is extended with `traffic` and `trafficDaily`.
- Oracle dashboard renders traffic cards/table and supports manual sync.
- Production runtime verification completed:
  - manual refresh returned success
  - `website_traffic_hourly` rows exist
  - sync audit entries exist for `cloudflare_traffic_to_oracle`

### Platform Verification (Cloudflare API)

- Pages project: `classroom-quick-downloader-website`
- Current attached domains: `classroom-quick-downloader-website.pages.dev` only
- Custom Pages domains endpoint currently returns empty list
- Worker `cqd-analytics` binding `CORS_ALLOWED_ORIGINS` currently includes Pages + local origins

### Remaining External Blocker

- Root-domain migration is still pending because no custom Pages domain is currently attached.
- After root domain is available/attached, apply final cutover:
  - enable `pages.dev -> root-domain` redirect
  - set `PUBLIC_SITE_URL=https://<root-domain>`
  - include root domain in `PUBLIC_WEBSITE_ALLOWED_ORIGINS`
  - include root domain in Worker `CORS_ALLOWED_ORIGINS`
  - set Oracle `CLOUDFLARE_ANALYTICS_HOSTNAME=<root-domain>`
