# Major Extension Scan — 2026-03-17

## Executive Summary

The extension is broadly healthy and releasable for Student Work flows after the silent-resolver fixes.

- Full extension test suite passed: **3233/3233**
- TypeScript compile passed
- Dependency audit found no known vulnerabilities
- Student Work e2e suite passed

One medium security hardening item remains open (BroadcastChannel trust boundary), and one low security hardening issue was fixed in this pass.

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

### [MS-001] Medium — Open

**Title:** Student Work resolver result channel trusts same-origin BroadcastChannel messages without sender authentication.

**Location:**

- `extension/src/student_work/channel.ts:14`
- `extension/src/student_work/channel.ts:79`

**Evidence:**  
The resolver accepts any message matching shape + `requestId` on a fixed BroadcastChannel name and does not verify publisher identity.

**Impact:**  
If malicious script execution occurs on `classroom.google.com` (compromised page/XSS scenario), attacker code could race a forged resolve message for a live request and force wrong URL resolution.

**Recommended Fix:**  
Move resolve-result transport to an extension-authenticated channel (content script -> runtime -> background -> tab-scoped forward) so page scripts cannot inject resolver results.

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

### [MS-003] Low — Open

**Title:** Student Work constants still include popup mode symbols after resolver moved to silent iframe-only execution.

**Location:**

- `extension/src/student_work/constants.ts:7`
- `extension/src/student_work/constants.ts:13`
- `extension/entrypoints/student_work_resolver_bridge.content.ts:74`

**Impact:**  
No direct runtime exploit, but stale mode surface increases maintenance risk and can cause future behavior drift if reintroduced accidentally.

**Recommended Fix:**  
Either remove dead popup mode symbols or document them as compatibility-only and add a regression guard asserting resolver never calls popup.

## Release Readiness

- Student Work silent resolver: **ready**
- Mapping correctness protections: **ready**
- Popup behavior removed from resolver path: **ready**

## Suggested Next Security Task

Implement `MS-001` by introducing a runtime-relayed, tab-scoped resolver message path and deprecating direct BroadcastChannel trust for terminal resolve messages.
