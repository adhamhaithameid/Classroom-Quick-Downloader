# Major Extension Scan — 2026-03-17

## Executive Summary

The extension is broadly healthy and releasable for Student Work flows after the silent-resolver fixes.

- Full extension test suite passed: **3233/3233**
- TypeScript compile passed
- Dependency audit found no known vulnerabilities
- Student Work e2e suite passed

The previously open medium trust-boundary item and popup-surface cleanup item are now fixed.

## Scope

- `extension/*` runtime code
- Student Work resolver/extractor/button flows
- Background/content messaging paths
- Popup/debug surfaces

## Commands Executed

```bash
pnpm -C extension run test
pnpm -C extension run compile
pnpm -C extension audit --prod
pnpm exec playwright test tests/e2e/student-work.spec.ts tests/e2e/student-work-by-status.spec.ts --project=extension-chromium
```

## Findings

### [MS-001] Medium — Fixed

**Title:** Student Work resolver result channel trusts same-origin BroadcastChannel messages without sender authentication.

**Location:**

- `extension/src/student_work/channel.ts`
- `extension/entrypoints/background/index.ts`

**Evidence:**  
Resolver results are now published from bridge content scripts through `chrome.runtime.sendMessage`, relayed by background to the originating tab only, and consumed by resolver listeners via runtime relay type.

**Impact:**  
Same-origin page scripts can no longer forge terminal resolver messages through `BroadcastChannel` in normal extension runtime flow.

**Fix Applied:**  
Implemented extension-authenticated resolver transport:

- bridge -> background: `CQD_SW_RESOLVE_RESULT_PUBLISH`
- background -> tab relay: `CQD_SW_RESOLVE_RESULT_RELAY`
- resolver waits on runtime relay when available; `BroadcastChannel` is fallback-only for environments without runtime APIs.

---

### [MS-002] Low — Fixed

**Title:** Debug panel HTML rendering accepted runtime strings without escaping.

**Location (fixed):**

- `extension/src/v2/debug/debug-panel.ts:130`
- `extension/src/v2/debug/debug-panel.ts:297`

**Evidence:**  
Debug panel used `innerHTML` with runtime fields directly interpolated into template strings.

**Fix Applied:**  
Added `escapeHtml(...)` and applied escaping for dynamic values rendered inside debug panel HTML.

---

### [MS-003] Low — Fixed

**Title:** Student Work constants still include popup mode symbols after resolver moved to silent iframe-only execution.

**Fix Applied:**  

- removed popup-only constants and stale popup-mode type surface
- resolver bridge now accepts iframe mode only (`cqd_sw_mode=iframe`)

## Release Readiness

- Student Work silent resolver: **ready**
- Mapping correctness protections: **ready**
- Popup behavior removed from resolver path: **ready**
- Resolver trust-boundary hardening: **ready**
- Regex route matching hardened against CodeQL ReDoS concern: **ready**
- Website changelog tests decoupled from stale hardcoded release numbers: **ready**
- Root patch mapping consistency (`eslint@10.0.3`) restored: **ready**
- GitHub workflow Node setup moved to `actions/setup-node@v5` + Node 22: **ready**

## Suggested Next Security Task

Add a per-request resolver nonce signature check on relay payloads as a defense-in-depth layer, even within extension-authenticated channels.

## Rescan Addendum (2026-03-17)

### Fixes Applied In This Pass

1. **CodeQL regex hardening (High)**
   - Replaced Student Work submissions route regex matching with deterministic path-segment parsing in:
     - `extension/src/student_work/url-classifier.ts`
     - `tests/e2e/student-work.spec.ts` helper matcher
2. **Website test stability (Medium)**
   - Removed brittle top-version assertions (`1.5.0`) and switched to generated manual changelog source-of-truth in:
     - `website/src/lib/api/changelog.test.ts`
     - `website/src/lib/api/publicSite.test.ts`
     - `website/src/lib/api/publicSite.integration.test.ts`
     - `website/src/lib/api/publicSite.acceptance.test.ts`
     - `website/src/lib/api/publicSite.regression.test.ts`
3. **Patch mapping consistency (Low)**
   - Updated root `package.json` patched dependency mapping to:
     - `eslint@10.0.3 -> patches/eslint@10.0.3.patch`
   - Synced lockfile via `pnpm install --no-frozen-lockfile`.
4. **Workflow deprecation hygiene (Low)**
   - Updated workflow Node setup from `actions/setup-node@v4` to `@v5` and Node runtime from `20` to `22` across workflow files.

### Verification Run Results

- `pnpm -C extension run compile` ✅
- `pnpm -C extension run test` ✅ (3236/3236)
- `pnpm -C extension audit --prod` ✅
- `pnpm -C website run check` ✅
- `pnpm -C website run test` ✅ (969/969)
- `pnpm -C website run build` ✅
- `pnpm -C website audit --prod` ✅
- `pnpm -C cloudflare-worker run validate` ✅
- `pnpm -C cloudflare-worker run test` ✅ (934/934)
- `pnpm -C cloudflare-worker audit --prod` ✅
- `pnpm -C oracle-backend run validate` ✅
- `pnpm -C oracle-backend run test` ✅
- `pnpm -C oracle-backend audit --prod` ✅
- `pnpm run scan:security` ✅ (`gosec` issues: 0, `govulncheck`: no vulnerabilities)
- `pnpm exec playwright test tests/e2e/student-work.spec.ts tests/e2e/student-work-by-status.spec.ts --project=extension-chromium` ✅ (10/10)

### CI/CD Watch Snapshot

- Current PR checks still show historical failures from previous head SHA.
- No workflows are currently in progress.
- A fresh push is required to trigger reruns with the fixes above.
