## 2026-06-11 — Security
- Identified the `shell-quote` vulnerability (GHSA-w7jw-789q-3m8p) via `pnpm audit`.
- Fixed the vulnerability by adding `"shell-quote": ">=1.8.4"` to the `pnpm.overrides` section of the root `package.json`.
- Ran `pnpm install` to apply the lockfile changes, which successfully resolved the `cloudflare-worker` audit failure that broke CI.
