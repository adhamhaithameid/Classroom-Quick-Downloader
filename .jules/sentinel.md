## 2026-02-13 - Timing Attack on Password Verification
**Vulnerability:** Simple string comparison (`!==`) was used for checking `DASHBOARD_PASSWORD` and `DANGER_PASSWORD` in `cloudflare-worker/src/index.ts`. This allows an attacker to deduce the password length and content by measuring the time it takes for the comparison to fail.
**Learning:** Standard equality operators in JavaScript fail early on the first mismatched character, leaking timing information.
**Prevention:** Always use `timingSafeStringEqual` (or `crypto.timingSafeEqual`) for comparing secrets, passwords, or HMACs. This ensures the comparison always takes the same amount of time regardless of where the mismatch occurs.
