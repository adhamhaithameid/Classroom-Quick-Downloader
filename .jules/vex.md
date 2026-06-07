
## 2026-06-07 — Restrict CSP object-src to 'none'
**Finding:** The Content Security Policy in `extension/wxt.config.ts` had `object-src 'self'`, which could allow unsafe plugins to load.
**Action:** Changed the `object-src` directive to `'none'` to comply with MV3 security best practices and prevent loading unsafe plugins.
**Learning:** Always ensure `object-src` is strictly `'none'` to tighten the extension's security posture and minimize attack surface.

## 2026-06-07 — tmp path traversal vulnerability
**Finding:** The `tmp` dependency in `extension/wxt.config.ts` > `web-ext-run` > `tmp` has a high severity Path Traversal vulnerability (CVE-2026-44705, GHSA-ph9p-34f9-6g65).
**Action:** Logged finding but skipped fixing because Vex is not allowed to modify `node_modules/` or `pnpm-lock.yaml` or dependencies according to Hard Rules.
**Learning:** Vulnerabilities in WXT build dependencies exist but modifying the lockfile is outside of Vex's jurisdiction.
