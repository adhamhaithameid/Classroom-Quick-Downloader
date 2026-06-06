## 2026-06-06 — Added IP spoofing test to worker security tests
**Gap Found:** Cloudflare worker `security.test.ts` was not verifying that `X-Forwarded-For` header spoofing is ignored in favor of the authentic `CF-Connecting-IP`.
**Tests Added/Improved:** Added a test to ensure the rate limiting logic extracts the authentic `CF-Connecting-IP` despite the presence of an `X-Forwarded-For` forgery.
**Learning:** Always verify that security-critical header overrides like `X-Forwarded-For` are safely ignored when a trusted proxy header like `CF-Connecting-IP` is available.
