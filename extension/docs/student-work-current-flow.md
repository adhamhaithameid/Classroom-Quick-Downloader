# Student Work Tab — Current Runtime Flow

Updated: 2026-03-17

## Scope

This document describes the exact behavior currently shipped for Student Work downloads in:

- student submissions sidecar flow
- by-status board flow
- single download and download-all interactions

## Entry Points

- `extension/entrypoints/student_work_sidecar.content.ts`
- `extension/entrypoints/student_work_by_status.content.ts`
- `extension/entrypoints/student_work_resolver_bridge.content.ts`
- `extension/src/student_work/button.ts`
- `extension/src/student_work/resolver.ts`
- `extension/src/student_work/extractor.ts`

## Route Coverage

### Teacher / Student Work routes

- `.../c/{course}/a/{courseWork}/submissions...`
- by-status variant: `.../submissions/by-status/and-sort-name/...`

### Viewer bridge routes

- `https://classroom.google.com/g/tg/*`
- `https://classroom.google.com/u/*/g/tg/*`

## Button Injection Flow

1. Scan eligible anchors/elements in Student Work containers.
2. Build a per-item source URL:
   - direct Drive URL when deterministic file ID is present
   - otherwise keep Classroom `g/tg` URL with per-item `#u` hint
3. Build per-button metadata:
   - `name`, `ext`, source URL, file key
4. Inject Student Work button and register in download grouping.

## Resolver Flow (Single Source Of Truth)

When a Student Work button is clicked, resolver order is:

1. Input validation:
   - non-empty URL, valid `https`, supported Student Work/classroom attachment pattern
2. Direct query-id resolution:
   - `id` / `resourceId` / `fileId` -> Drive download URL
3. API snapshot strict resolution:
   - uses published snapshot only if top match is unique and strong
   - ambiguous/tied/multi-submission contexts are rejected
4. Silent iframe bridge:
   - hidden iframe with request nonce
   - bridge result is relayed over extension runtime messaging via background (tab-scoped)
   - waits for bridge result within stage timeout
5. Final normalization:
   - Drive / Docs / Classroom variants normalized to a final download URL with auth user hint

Important:

- No popup fallback is used in resolver execution.
- All Student Work resolution is silent (iframe only).

## Bridge Extraction Flow (`g/tg` page)

Bridge extraction order:

1. Anchors (`drive.google.com`, `docs.google.com`, classroom drive proxy)
2. Performance resources (e.g. `docs.google.com/file/d/.../grading`)
3. Strict submission-hinted script extraction (when `#u` or `userId` hint exists)
4. Generic script/query/current-url fallback (only when not in strict hinted mode)

Strict mode behavior:

- If user/submission hint exists:
  - generic low-confidence fallbacks are blocked
  - ambiguous matches return null (fail closed)
  - closest unique candidate near hinted payload is preferred

## Download-All Behavior

Download-all uses the same per-button resolver path for each file.

- Each button keeps its own source URL/hints.
- Group execution does not collapse items to a shared URL.
- Mapping protections avoid first-file reuse across different students.

## Button State Machine

Core states:

- `idle` -> `trying` (resolving) -> `loading` (download started) -> `success` or `error`

Guardrails:

- resolve abort controller per button
- watchdog timer for stuck download state
- request ID tracking for background status correlation
- explicit reset after terminal states

## Timeouts And Failure Modes

- Default resolver stage timeout: `15000ms`
- Bridge scan timeout: `10000ms`
- Common failure reasons:
  - `resolver_timeout`
  - `no_drive_url_found`
  - `invalid_resolved_url`
  - `aborted`

UI message mapping in Student Work button logic:

- timeout -> "Could not resolve file link in time."
- abort -> "Cancelled"
- other resolver failure -> "Could not resolve Student Work file link."

## Security/Correctness Posture

- Prefers strict unique mapping over permissive first-match behavior.
- Avoids popup-based resolver side effects.
- Uses extension-authenticated runtime relay for resolver terminal messages.
- Uses request-scoped nonce on final download URL to reduce collision/reuse risk.
- Normalizes Docs/Drive/Classroom URL variants before download dispatch.

## Verification Commands

From repo root:

```bash
pnpm -C extension run compile
pnpm -C extension run test
pnpm exec playwright test tests/e2e/student-work.spec.ts tests/e2e/student-work-by-status.spec.ts --project=extension-chromium
```
