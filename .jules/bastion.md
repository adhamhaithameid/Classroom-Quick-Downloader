## 2026-06-13 — Added X-Forwarded-For spoofing test
**Gap Found:** Cloudflare Worker security tests did not verify that a forged `X-Forwarded-For` header is ignored in favor of the authoritative `CF-Connecting-IP` header during login attempts.
**Tests Added/Improved:** Added a test in `cloudflare-worker/tests/security.test.ts` to ensure that `login-attempt` rate limiting keys off of `CF-Connecting-IP` even when `X-Forwarded-For` is present.
**Learning:** The Durable Object stores login attempt state tracking as timestamps using objects `{ attempts: number, firstAttemptAt: number }` rather than plain numbers or strings.
