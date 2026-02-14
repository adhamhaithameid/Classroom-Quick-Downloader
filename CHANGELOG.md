# Changelog

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
