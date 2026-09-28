# Plan: Download Queue Engine (bead `0h4d.1.2`)

**Date:** 2026-09-28 · **Owner:** Adham Haitham · **Tracker:** bd `Classroom-Quick-Downloader-0h4d.1.2`
**Depends on:** `0h4d.1.1` (persisted job records, merged via #787) · **Blocks:** `0h4d.1.11` (gate), `0h4d.3.2/.3.4/.3.5` (Pro consumers)
**UI decision (owner, 2026-09-28):** BOTH surfaces — popup Queue section + in-page progress pill per button.

## Goal

Replace stagger-and-pray with a real queue: every download request is admitted by a bounded scheduler, per-file state is visible (queued → downloading → settled), the queue pauses, and a service-worker restart restores non-terminal work. Concurrency cap default **3**.

## Architecture

```
CQD_DOWNLOAD / bridge ──► handleDownloadRequest (single chokepoint)
                              │ registerPending (existing)
                              ▼
                     queue-engine.selectNext(queue, active, cap, paused)   ← PURE, src/queue/
                              │ admits ≤ cap
                              ▼
              startSingleAttempt / attemptDriveStart  (startDownloadWithTimeout unchanged)
```

- **Pure core:** `extension/src/queue/queue-engine.ts` — `createQueueEngine()` with `selectNext(queue, activeIds, cap, paused)`; no chrome APIs, no timers.
- **Queue state lives on PendingDownload:** `queueState?: 'queued' | 'active'`, `queuedAt?: number`, `priority?: number` (reserved for 3.5). New fields ride the verbatim `cqd_pending_jobs_v1` serialization in `job-persistence.ts` for free.
- **Admission:** `handleDownloadRequest` (download-handler.ts:227–351) registers the pending, then asks the engine whether it may start now; if not, it returns before any `chrome.downloads.download` call and the respondOnce contract gains a `queued` payload (content + bridge handle it — see UI).
- **Promotion:** the engine re-selects on every settlement. Hook point: `setDownloadStatusListener` (message-sender.ts:23) already observes every settle for the bridge — the queue registers its own listener composition (a single multiplexer keeps the single-slot contract).
- **Progress:** `chrome.downloads.onProgress` (bytesReceived/totalBytes) — currently unread anywhere — relays per-file progress into `sendStatusToTab` as a `progress` payload only when `currentDownloadId` is bound and `totalBytes > 0`.
- **Pause:** engine flag; running downloads continue to terminal; queued stay queued.
- **Restart:** `reconcilePersistedJobs` (job-persistence.ts:120–172) re-binds in-progress records via `registerPending` → the queue re-marks them `active`; records admitted-but-never-started (`currentDownloadId == null`) return to `queued`.

## UI

- **Popup:** new Queue section in `entrypoints/popup/App.tsx` (section pattern = existing settings/changelog sections; plain hooks, `chrome.runtime.sendMessage` port for queue snapshot + pause/cancel actions).
- **In-page pill:** `entrypoints/content/message-handler.ts` + `button-state.ts` — `CQD_DOWNLOAD_STATUS` already drives trying/success/pill states; add `queued` state (pill "Waiting · position n") and live progress pill (`setPillProgress` with received/total).

## TDD Tasks

1. **Red:** `extension/tests/queue-engine.test.ts` — fast-check properties: never exceeds cap; FIFO tie-break; `paused` freezes selection; cancel removes; priority reserved (equal priorities = FIFO). **Green:** `src/queue/queue-engine.ts`.
2. **Red:** `extension/tests/background-queue.test.ts` (background-flow harness) — 10 rapid `requestDownload` calls: ≤ 3 `chrome.downloads.download` calls before settlements; each settlement admits the next. **Green:** gating in `handleDownloadRequest` + engine wiring in `index.ts` (both CQD_DOWNLOAD and bridge paths converge — bridge needs zero changes).
3. **Red:** restart hydration — persisted queued/active records restore states via reconcile. **Green:** reconcile path marks states; never-started records re-queue.
4. **Red:** popup Queue section render (rows, pause, cancel) via existing popup test patterns. **Green:** App.tsx section + message port.
5. **Red:** in-page `queued` + progress pill (message-handler tests). **Green:** button-state extension; status payloads gain `queuePosition`, `bytesReceived`, `totalBytes`.
6. **Verify:** `pnpm -C extension test && pnpm -C extension run compile && pnpm -C extension run test:coverage:critical` (critical profile covers `entrypoints/background/*` at 100% — new background code needs full-branch coverage, same bar as S2).

## Out of scope

Byte-progress for Drive interstitial flows before a downloadId exists (honest "waiting"); in-page tray UI; priority reordering (3.5).
