# Persist Download Job Records (bead `0h4d.1.1`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An MV3 service-worker restart no longer orphans in-flight downloads — pending job records survive in `chrome.storage.local` and are reconciled back into the authoritative registry (or settled honestly) on worker boot.

**Architecture:** `state.ts` stays dependency-free; a new listener hook lets an optional persistence adapter mirror registry mutations into `chrome.storage.local` under one key (`cqd_pending_jobs_v1`). On worker start, a reconcile pass re-loads records: still-in-progress downloads are rebound into the registry with a fresh stall deadline; interrupted/missing/never-started/stale ones are dropped. Foundation for the free-plan queue (0h4d.1.2) and download history (0h4d.1.6).

**Tech Stack:** TypeScript, WXT MV3, `chrome.storage.local` (callback API), Vitest with callback-style chrome mocks (pattern: `tests/analytics-storage.test.ts`), repo-wide GLOBAL fake timers.

**Spec:** docs/ROADMAP_FREE_TO_PRO.md Phase 1; audit context in docs/PRODUCT_FREE_PRO_PLANS.md ("Persist download job records").

## Global Constraints

- `entrypoints/background/state.ts` must not import chrome.storage or the persistence module (header contract: "registry stays dependency-free").
- Registry remains the single source of truth; persistence is a best-effort mirror — storage failures must never throw into download flows.
- `PENDING_DOWNLOAD_TTL_MS` (10 min) governs record staleness, matching the existing orphan sweep.
- Tests follow `tests/background-state.test.ts` conventions (`vi.resetModules()` + dynamic import, `makePending()` factory, callback-style storage spies).
- Extension suite runs under GLOBAL fake timers (`useRealTimers` where needed).

---

### Task 1: Registry listener hook in state.ts

**Files:**
- Modify: `extension/entrypoints/background/state.ts`
- Test: `extension/tests/background-state.test.ts` (extend)

**Interfaces:**
- Produces: `setRegistryListener(l: RegistryListener | null): void` where `RegistryListener = { onRegister?(p: PendingDownload): void; onUnregister?(requestId: string): void; onBind?(p: PendingDownload): void }`.

- [ ] Add `RegistryListener` type + module-level `registryListener` + `setRegistryListener`.
- [ ] Fire `onRegister` at the end of `registerPending` (after deadline scheduling), `onBind` at the end of a successful `bindDownloadId`, `onUnregister(requestId)` inside `unregisterPending`.
- [ ] Tests: listener receives register/bind/unregister events; `null` listener is a no-op; listener throwing does not break registry mutations (wrap in try/catch).

### Task 2: job-persistence.ts module

**Files:**
- Create: `extension/entrypoints/background/job-persistence.ts`
- Test: `extension/tests/background-job-persistence.test.ts`

**Interfaces:**
- Produces: `createStoragePersistence(): RegistryListener` (persists on register/bind, drops on unregister); `reconcilePersistedJobs(deps?): Promise<{ rebound: number; dropped: number }>` with injectable `{ now?, search?, storage? }` for tests.

- [ ] `readJobs()`/`writeJobs()` callback-promise wrappers around `chrome.storage.local.get/set` on key `cqd_pending_jobs_v1`; all failures swallowed with a `console.warn`.
- [ ] `createStoragePersistence()` — `onRegister`/`onBind` upsert the plain-data pending; `onUnregister` deletes the key entry.
- [ ] `reconcilePersistedJobs()` — per record: `startTime` older than TTL → drop; `currentDownloadId` set → `chrome.downloads.search({id})`: `in_progress` → `registerPending(p)` + `bindDownloadId(p, id)` (rebound++), otherwise drop; no download id → drop. Returns counters.
- [ ] Tests: round-trip persist/unpersist via storage spy map; reconcile paths (in-progress rebind, interrupted drop, missing drop, stale drop, never-started drop); storage get/set failure tolerance; never throws.

### Task 3: Wire into the worker lifecycle

**Files:**
- Modify: `extension/entrypoints/background/index.ts`

- [ ] Import both modules; `setRegistryListener(createStoragePersistence())` at boot; `void reconcilePersistedJobs()` top-level (worker restart = reconcile point; `onStartup`/`onInstalled` both re-run top-level).
- [ ] Verify: no import from state.ts into job-persistence.ts beyond types (registry functions injected/typed loosely to avoid cycles — if a cycle appears, inject registry ops via `deps`).

### Task 4: Full-suite verification + handoff

- [ ] `pnpm -C extension run test` — all green (4,122 existing + new).
- [ ] Commit on `feat/persist-download-jobs`, PR to main, bead `0h4d.1.1` note.
