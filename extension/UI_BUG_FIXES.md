# UI Bug Fixes Implementation Plan

## Issues Identified

### Issue 1: Cancel Hover Not Working
**Root Cause:** Hover state logic exists (lines 702-729) but may be blocked by state priority system or timing

### Issue 2:  Cancel All Not Working  
**Root Cause:** Individual downloads continue because cancel implementation relies on button click simulation which may not propagate correctly

### Issue 3: States Stay Too Long / Never Reset
**Root Causes:**
- `FEEDBACK_SUCCESS_MS = 3000` (line 24)
- `FEEDBACK_ERROR_MS = 4000` (line 25)
- `waitForSuccessReset()` checks `button.matches(':hover')` before resetting (line 1072)
- If user is hovering, button NEVER resets
- `waitForSuccessReset()` also checks if Download All is active (line 1068)
- Error state has similar hover check (line 906)

## Fixes

### Fix 1: Shorten State Timeout Constants
```typescript
const FEEDBACK_SUCCESS_MS = 2000;  // Was 3000
const FEEDBACK_ERROR_MS = 3000;     // Was 4000
const FEEDBACK_CANCELLED_MS = 1500; // New constant
```

### Fix 2: Add Force Reset After Maximum Time
Add a maximum wait time regardless of hover state:
```typescript
const MAX_TERMINAL_STATE_MS = 8000; // Force reset after 8s no matter what
```

### Fix 3: Fix Cancel All Implementation
Instead of click simulation, directly call cancel handler:
```typescript
// In handleCancelAllClick, replace click simulation with:
await handleCancelClick(primary);
```

### Fix 4: Add ErrorBoundary Test Button (Dev Only)
Add button to popup when in dev mode to trigger test error

## Implementation Files
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/extension/entrypoints/content/index.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/extension/entrypoints/download_all.content.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/extension/entrypoints/popup/App.tsx`
