# Changelog

> Last updated: 2026-02-19 (v1.3.5).

All notable changes to **Classroom Quick Downloader** will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Oracle Hub v4 reference document at `docs/ORACLE_HUB_V4.md` consolidating:
  - architecture and reliability model,
  - security baseline and hardening controls,
  - observability and feature flags,
  - admin API map and verification commands.
- Backend README now links directly to the Oracle Hub v4 reference.
- Added extension coverage test for analytics storage migration fallback path to keep CI coverage gates at 100%.

### Changed
- Popup stats loading now guards against out-of-order async updates to prevent stale UI state from winning race conditions.
- Oracle dashboard fetch helper now throws structured HTTP errors (`status`, `code`, `payload`) for deterministic client error handling.
- Oracle dashboard manual refresh now forces fresh overview summary fetches instead of reusing local cache.
- Auth and middleware API error responses are now normalized through a shared JSON error writer.

### Fixed
- Step-up verification no longer retries through the auth modal flow on `401`, preventing challenge-consumption conflicts.
- Step-up modal now maps failures via structured API error codes instead of brittle string matching.
- CI workflow YAML parsing issue in `oracle-backend-ci.yml` (`govulncheck` step scalar) is corrected.
- Extension CI coverage regression caused by an uncovered migration fallback branch is fixed.

### Tests
- `pnpm -C extension test:coverage:all` now passes at 100% for both critical and runtime coverage profiles.
- Verified targeted backend and extension checks after each auth/storage hardening change.

## [1.3.5] - 2026-02-19

### Added
- Extension CSP hardening tests now include integration coverage for WXT manifest wiring (`extension/tests/wxt-config-security.integration.test.ts`).
- Added edge-case unit tests for manifest security helpers (`resolveWorkerOrigin('')`, `resolveWorkerOrigin(undefined)`, and localhost worker host-permissions).

### Changed
- Extension package version bumped to `1.3.5`.
- Extension pages CSP now includes `default-src 'self'` as a defense-in-depth fallback.

### Fixed
- Security config helper placement was finalized under `extension/config/` to avoid leaking config helpers into extension build assets.

## [1.3.0] - 2026-02-09

### Added
- Extension analytics now use UTC for scheduling and timestamps, with daily window jitter and 24‑hour stale flush protection.
- End‑to‑end ACK metadata from Worker → Extension (accepted IDs, duplicates, invalids, committed sequence).
- Worker `/config` now returns `serverTimeUtc` and schema version; extension stores a drift offset.
- Cloudflare dashboard Remote Config section with editable limits, daily window controls, and tooltips.
- UTC clock in the dashboard sidebar with click‑to‑toggle 24h/12h display.
- Oracle dashboard authentication is enforced by default (password required unless explicitly overridden).

### Changed
- Worker `/track` now validates payload structure, enforces per‑event size limits, and applies per‑IP rate limiting.
- Extension config is normalized/migrated with schema versioning and clamped ranges.
- Retry logic respects `maxRetry` and drops invalid/duplicate events immediately on ACK.
- Path traversal checks for Oracle static file handler are hardened.

### Fixed
- Remote config values now apply to `maxDailyRequests`, `maxRetry`, `maxEventsPerRequest`, and daily window scheduling.
- Extension time‑based flush now uses elapsed time logic instead of always falling through.
- Queue integrity mismatches no longer drop data; queues are preserved and re‑hashed.

### Tests
- Added/expanded unit tests for worker security validation and extension flush behavior.
- Added backend auth rate‑limit tests.
