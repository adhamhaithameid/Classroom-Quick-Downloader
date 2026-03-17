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

## Suggested Next Security Task

Add a per-request resolver nonce signature check on relay payloads as a defense-in-depth layer, even within extension-authenticated channels.
