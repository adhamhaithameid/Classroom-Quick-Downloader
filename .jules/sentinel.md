## 2026-02-09 - [Timing Attack Mitigation in CF Workers]
**Vulnerability:** Insecure string comparisons (===) for secrets allow timing attacks.
**Learning:** `crypto.subtle.timingSafeEqual` is available in Cloudflare Workers but not in Node.js Web Crypto implementation (used by Vitest).
**Prevention:** Use a custom constant-time comparison function or polyfill `crypto.timingSafeEqual` for cross-environment compatibility (tests vs runtime).
