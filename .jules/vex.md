
## 2026-06-07 — Restrict CSP object-src to 'none'
**Finding:** The Content Security Policy in `extension/wxt.config.ts` had `object-src 'self'`, which could allow unsafe plugins to load.
**Action:** Changed the `object-src` directive to `'none'` to comply with MV3 security best practices and prevent loading unsafe plugins.
**Learning:** Always ensure `object-src` is strictly `'none'` to tighten the extension's security posture and minimize attack surface.
