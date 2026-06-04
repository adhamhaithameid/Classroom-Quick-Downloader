## 2026-03-05 — Database Migrations and Caddy Rate Limiting
**Issues Filed:**
- Oracle: add database migration version tracking — no way to know current schema version
- Oracle: Caddyfile missing rate limiting directives — DoS protection at proxy level

**Rationale:**
- Currently, migrations rely entirely on `IF NOT EXISTS` logic on startup. This leads to untracked evolutionary schema drift and blocks safe column renames, alters, and drops in production without manual SSH and CLI access. A single maintainer needs predictable automated deployments.
- The `Caddyfile` acts as a reverse proxy but has no rate limiting or DoS protection configured. Given the backend receives public-facing webhooks and telemetry traffic, this is a major security operational risk that could cause silent server exhaustion.

**Areas for Next Run:**
- The `stats.go` handler endpoints lack date-range validations in some paths.
- The `health.go` endpoints check ping but could perform deep writes to verify disk isn't full.
- The `Makefile` lacks an integrated `make dev` setup target for local iteration without Docker.
