# Extension defect plan — audit chat, 2026-11-18

Worktree: `/Users/adhamhaithameid/Desktop/code/CQD-wt-audit-extension`, branch
`audit/extension-defects` (from origin/main `2a37b6ce`). Baseline:
`extension/tests/audit-repro.test.ts` — 10/10 PASS = all 10 defects present.

Defects 1–9 are fixed here. Defect 10 is chat 4's lane (v3 API stack) —
documented only.

Order of work (each defect: invert test → RED → fix → GREEN → `scripts/check extension`):

1. D2, D3 — deadline semantics (same function group: `state.ts` deadline + `index.ts` hook + onChanged heartbeats)
2. D1 — premature success at filename time (same onChanged/filename region as D2)
3. D6 — reconcile settle + re-queue on worker restart
4. D4, D5 — cancel correctness (same function group: `startDownloadWithTimeout` callback + cancel handler)
5. D7 — in-flight duplicate guard
6. D8 — re-download filename
7. D9 — bridge outcome mapping

---

## D1 — Chromium reports success at filename time; later failure is silent

**Repro:** `D1` in `extension/tests/audit-repro.test.ts`.

**Root cause:** `extension/entrypoints/background/index.ts:454` — inside the
`onDeterminingFilename` listener, `sendStatusToTab(pending, 'success')` runs when
the response HEADERS arrive and Chrome asks for a filename. Bytes are not on
disk. `sendStatusToTab` sets `pending.finalized = true`
(`message-sender.ts:39`). Later, when the transfer is interrupted, the
`onChanged` handler hits the `pending.finalized` branch (`index.ts:689-695`)
which only calls `cleanup()` — no error status, no retry, no analytics fail
event, no history row. The failure is fully silent and the content-script
button already showed "Downloaded".

**Fix design:** Align Chromium with the Firefox path (`index.ts:546-549`
already documents the honest contract: "success is reported by the
onChanged 'complete' event"). Remove the premature `success` from the
filename listener; only suggest the filename there. Success stays solely in
the `complete` path (`index.ts:589` `reportSuccess`), where the item is
verified (mime, size) before reporting. `finalized` then stays false during
the transfer, so the existing interrupted taxonomy (transient retry → honest
terminal) applies.

**Risk:** The content-script button stays in "trying/progress" for the whole
transfer instead of flipping to "Downloaded" early. That is the correct
behavior, but the perceived latency until the success state grows to real
download time. The 150 s stall deadline (post-D2 heartbeat re-arm) must not
fire on long healthy transfers, so D2 is fixed first.

**Proving test (inverted D1):** at filename time no `success` status is sent;
after a `NETWORK_FAILED` interrupt and timer advance, the terminal status is
`error`/`NETWORK_FAILED`, a `fail` analytics event fires, and a history row
lands.

## D2 — The 150 s deadline cancels healthy long downloads

**Repro:** `D2`.

**Root cause:** `extension/entrypoints/background/state.ts:22`
(`PENDING_DEADLINE_MS = 150_000`) and `state.ts:31-39` — `scheduleDeadline`
arms ONE timer at `registerPending` (`state.ts:95-100`). The expiry hook
(`index.ts:326-338`) cancels the browser download and reports
`error`/`TIMEOUT`. A healthy transfer that simply lasts longer than 150 s
(large video) is cancelled by the extension itself.

**Fix design (ADR draft below):** Change the deadline from total-duration to
transfer-stall:

- Arm the deadline at first `bindDownloadId` (transfer began), not at register.
- Re-arm the timer on every activity heartbeat for that pending: any
  `onChanged` delta (bytesReceived progress, state change) and the filename
  event.
- While the pending is registered but unbound, no deadline runs: the queue
  wait is visible ("Waiting in queue…"), user-cancellable, and the 15 s start
  timeout (`download-handler.ts:39`) plus the 10 min TTL sweep
  (`state.ts:233`) remain the backstops.

Concretely: `state.ts` moves `scheduleDeadline` out of `registerPending`
into `bindDownloadId` and exports `rearmDeadline(pending)`; `index.ts`
calls `rearmDeadline` in the `onChanged` listener (progress branch and
state branch) and in the filename listener.

**Risk:** A transfer that stalls with zero deltas for 150 s is cancelled —
intended. A browser that emits no delta events for large spans (rare) could
trip the stall deadline; mitigation: every state delta also re-arms, and
Chromium emits periodic progress deltas for active transfers. Worst case the
user sees the honest TIMEOUT terminal and retries — same as today, never
worse.

**Proving test (inverted D2):** a download whose progress deltas keep firing
past 150 s is never cancelled (`chrome.downloads.cancel` not called), and the
final status is `success`.

## D3 — Queue wait counts against the deadline; a 12-file batch loses 6 files

**Repro:** `D3`.

**Root cause:** Same timer as D2. `queue.ts:37-44` admits up to
`QUEUE_CONCURRENCY = 3`; later requests sit in `snapshot.entries`. Their
deadline timer (armed at register) keeps running, so item N loses
`(N/3 - 1) * 60 s` of its budget while waiting. With 60 s transfers, items
7–12 expire before admission: 6 files time out though nothing is wrong.

**Fix design:** Covered by the D2 change — the deadline arms at first bind
(admission + start), so queue wait never consumes budget. No queue.ts change
needed.

**Risk:** A queued item whose starter is lost (queue bug) would linger until
the TTL sweep instead of timing out at 150 s. The TTL sweep (10 min,
`cleanup.ts:39-47`) still bounds it.

**Proving test (inverted D3):** the same 12×60 s batch ends with 12
`success` terminals and 0 `TIMEOUT` codes.

## ADR draft (text only; not filed)

**ADR-0010: Download deadline measures transfer stall, not total lifetime.**

- **Context:** `PENDING_DEADLINE_MS` (150 s) is armed at request time. It
  cancels healthy long transfers (D2) and queue-starved batch items (D3).
  Start stalls already have a dedicated 15 s timer
  (`DOWNLOAD_START_TIMEOUT_MS`), and orphans have a 10 min TTL sweep.
- **Decision:** The 150 s deadline is a TRANSFER-STALL deadline. It arms when
  the pending first binds to a browser download id and re-arms on every
  activity heartbeat (any onChanged delta for that pending, and the filename
  event). No deadline runs before the first bind.
- **Alternatives rejected:** (a) Scale the deadline by queue position —
  still kills genuinely slow transfers and needs per-item accounting;
  (b) remove the deadline entirely — a silently stalled transfer would hang
  the button until the TTL sweep with no honest terminal; (c) raise the
  constant — trade-off, not a fix.
- **Consequences:** Healthy transfers of any length complete. Truly stalled
  transfers (no deltas for 150 s) settle with the honest TIMEOUT terminal.
  Queue waits are unbounded by the deadline (bounded by TTL + visibility).

## D4 — Cancel during the account sweep start window leaves an orphan download

**Repro:** `D4`.

**Root cause:** The cancel handler (`index.ts:762-797`) sets
`pending.isCancelled` and cancels only `pending.currentDownloadId` — null
during the sweep window where `startNextDriveAttempt`
(`download-handler.ts:285-297`) has already called
`chrome.downloads.download` but the callback has not fired. When the late
callback arrives, `bindDownloadId` correctly rejects the bind (pending
unregistered; `state.ts:125`), but the return value is ignored
(`download-handler.ts:293`) and nothing cancels the browser download. The
download runs to completion as an orphan nobody tracks.

**Fix design:** One chokepoint: the callback inside
`startDownloadWithTimeout` (`download-handler.ts:128-144`) checks
`pending.isCancelled` before invoking `handleStart`. If cancelled and a
download id exists, add it to `cancelledByUs` and `chrome.downloads.cancel`
it. This covers every start path (initial, sweep, transient retry, single
attempt). Defense in depth: `startNextDriveAttempt`'s and
`retrySameAttempt`'s handlers treat a `bindDownloadId` return of false as
"not tracked" and cancel the stray id.

**Risk:** Minimal — the cancelled pending is already settled; we only kill a
browser download the user asked to kill. `cancelledByUs` prevents the
resulting `interrupted` delta from surfacing.

**Proving test (inverted D4):** after the cancel and the late callback,
`chrome.downloads.cancel` IS called with the new download id (1001).

## D5 — Cancel from the popup never tells the page; the button keeps spinning

**Repro:** `D5`.

**Root cause:** The cancel handler (`index.ts:762-797`) never calls
`sendStatusToTab`. A cancel that originates in the popup (no tab affinity)
leaves the originating Classroom tab's button in its "trying" state forever.
A cancel from the page itself does not need the message, but the handler
cannot distinguish originators cheaply — always notifying is correct and
idempotent for the page-originated case (the page already stopped).

**Fix design:** In the cancel handler, before `cleanup(pending)`, call
`sendStatusToTab(pending, 'cancelled')`. The bridge listener observes it too;
the D9 fix maps `cancelled` to the `cancelled` outcome so bridge requesters
settle correctly.

**Risk:** A page-originated cancel now receives a redundant `cancelled`
status; the content script's terminal-state machine treats it as the settle
it already performed. No new state is introduced.

**Proving test (inverted D5):** a popup-originated cancel produces a
`CQD_DOWNLOAD_STATUS` message with status `cancelled` for the request.

## D6 — A download that finishes while the worker sleeps is never reported; queued requests are dropped

**Repro:** `D6`.

**Root cause:** `job-persistence.ts:122-175` `reconcilePersistedJobs`:
- line 144-149: records with `currentDownloadId == null` (registered, still
  QUEUED when the worker died) are deleted — the queue's in-memory starter
  map died with the worker, so nothing ever starts them and nobody is told.
- line 158-167: only `state === 'in_progress'` rebinds. A record whose
  download reached `complete` while the worker was dead is deleted silently —
  the file is on disk but the tab never hears `success` and history gets no
  row. The completion event that woke the worker finds no pending
  (`index.ts:558-559`) because reconcile has not re-registered it (and never
  will for a completed download).

**Fix design:** Two new injected callbacks keep `job-persistence.ts`
dependency-free (mirrors `onRecovered`):

- `onComplete(pending)` — browser state is `complete`. `index.ts` supplies a
  `settleSuccess(pending)` helper (extracted from the `reportSuccess` body in
  the onChanged complete path: analytics, history, stats, `sendStatusToTab`
  success, unregister) so both paths share one success settle. Guarded by
  `isRegistered` re-check + the `finalized` duplicate-success guard.
- `onRequeue(pending)` — record never started (`currentDownloadId == null`,
  fresh enough). `download-handler.ts` exports `restartPending(pending)`:
  re-registers the pending and re-enters the queue via the same starter
  builders `handleDownloadRequest` uses (extracted, behavior-preserving), so
  the item downloads and the QUEUED status is sent.

**Risk:** A completed download's history row is written on the next wake, not
at completion time — duration fields use `pending.startTime`, so the row's
duration overcounts the sleep gap. Accepted (row still lands; magnitude is
bounded by the 10 min TTL that reconcile enforces at line 139). Double-settle
against the racing onChanged event is prevented by the `finalized` guard.

**Proving test (inverted D6):** after boot with the seeded jobs: `r6` (state
`complete`) receives a `success` status and a history row; `r6-queued` is
told its status and a new `chrome.downloads.download` call runs; the pending
mirror no longer holds `r6`.

## D7 — No guard against the same file in flight twice

**Repro:** `D7`.

**Root cause:** `handleDownloadRequest` (`download-handler.ts:319-457`)
registers and queues every request unconditionally. Nothing consults
`pendingByRequestId` for an active pending with the same Drive file id or
baseUrl. `recentDownloads` (`index.ts:605`) is only set after success and
read elsewhere; during the transfer a second click of the same file starts a
second browser download of the same bytes.

**Fix design:** In `handleDownloadRequest`, after URL normalization and
before `registerPending`: for Drive requests, scan the authoritative
registry for an active pending with the same Drive file id
(`extractDriveFileId` on both baseUrls, so authuser variants count). If
found, refuse the new request: `respondOnce({ started: false, userMessage:
'That file is already downloading.' })` and return true. No registry
mutation. Non-Drive same-URL concurrency is deliberately left alone —
`state.ts` buckets support it and
`background-download-handler.test.ts` pins it ("two concurrent non-drive
requests for the same URL are tracked independently").

**Risk:** A user who genuinely wants two concurrent copies of the same file
can no longer get them from CQD. Browsers already uniquify filenames, and
two parallel byte-streams of one Drive file waste quota — refusal is the
right default. The guard clears as soon as the first request settles
(cleanup unregisters), so retry-after-failure is unaffected.

**Proving test (inverted D7):** the second `CQD_DOWNLOAD` for the same file
produces no second `chrome.downloads.download` call and its response carries
`started: false`.

## D8 — Re-download from history saves as `classroom_download.<ext>`

**Repro:** `D8`.

**Root cause:** The `CQD_HISTORY_REDOWNLOAD` handler (`index.ts:880-893`)
passes only `{ url, requestId }` — no `fileMeta`. At filename time,
`composeSuggestedFilename` (`url-helpers.ts:105-114`, called at
`index.ts:459-464`) sees `name: undefined` and falls back to the fixed stem
`classroom_download`. The browser's own `item.filename` (server-suggested,
e.g. the original name) is ignored as a name source.

**Fix design (background-only; popup is another chat's lane):** In the
filename listener, when `pending.fileMeta?.name` is absent, derive the stem
from the wire `item.filename` and pass it as `name`. The pure helper grows an
explicit `fallbackName` input; sanitization stays centralized in
`composeSuggestedFilename`. A follow-up bead (not this fix) should have the
popup pass the history row's `name`/`ext` in the message for full parity.

**Risk:** Chromium's `item.filename` can carry a uniquified suffix
(`file (1).pdf`) on re-downloads; acceptable — the name still names the
right file. Firefox is unaffected (its `onCreated` path never suggests).

**Proving test (inverted D8):** with `item.filename = 'Lecture 5.pdf'` and
no `fileMeta`, the suggestion is `Lecture 5.pdf` (stem preserved, extension
re-derived), not `classroom_download.pdf`.

## D9 — The bridge maps user cancel and progress tick to "failed"

**Repro:** `D9`.

**Root cause:** `bridge-download-service.ts:37-63` `mapStatusToOutcome` has
no `case 'cancelled'` — it falls to `default: 'failed'`, although
`AcquireOutcomeStatus` includes `'cancelled'` (`src/contracts/topics.ts:89`).
The status observer (`bridge-download-service.ts:86`) skips only `'trying'`;
a `'progress'` tick falls through to `settleOnce` with `failed`, so a
mid-transfer progress event permanently settles a bridge request as failed.

**Fix design:** Add `case 'cancelled': outcome = 'cancelled'`. In the
observer, skip `'progress'` exactly like `'trying'` (progress never settles).
No outcome-status enum change needed.

**Risk:** None outside the bridge; legacy page flow ignores the listener.

**Proving test (inverted D9):** `mapStatusToOutcome('cancelled').status ===
'cancelled'`; a service-level check shows `progress` and `trying` ticks do
not settle the request, while `cancelled` settles it as `cancelled`.

## D10 — API client turns HTTP 401 into an empty course; course capped at 3 list pages

**NOT FIXED HERE — chat 4's lane.** Documentation only.

**Repro:** `D10` in `extension/tests/audit-repro.test.ts`.

**Root cause:**
- `extension/src/engines/v3/api/classroom-api-client.ts:248` —
  `if (!response.ok) return;` inside `listAll`. An HTTP 401 (expired token)
  silently ends pagination and the method resolves with what it collected
  (nothing). `CourseInventoryService.getInventory`
  (`src/engines/v3/api/course-inventory.ts:57-59`) only maps THROWN errors to
  `null`; a resolved empty array is treated as a good answer, cached for
  5 min (`INVENTORY_CACHE_TTL_MS = 300_000`, line 33), and the user reads
  "No downloadable files found" for a signed-out session.
- `extension/src/engines/v3/api/classroom-api-client.ts:13`
  (`MAX_LIST_PAGES = 3`) with the loop at line 232: a course with more than
  3 pages per collection is silently truncated; no boundary signal is
  surfaced.

**Suggested direction (for chat 4):** distinguish auth failures from empty
results (throw a typed AuthError on 401/403 so the inventory surfaces the
sign-in path), and either raise/remove the page cap behind the existing API
budget (`budgetAvailable`) or return a `truncated` flag the UI can render.
Tests: invert D10 in `extension/tests/` under chat 4's ownership.

---

## Grouping summary (functions touched)

| Group | Defects | Functions |
|---|---|---|
| Deadline | D2, D3, (D1 interplay) | `state.ts` scheduleDeadline/bindDownloadId, `index.ts` pendingExpiredHook + onChanged heartbeats |
| Success honesty | D1, D6 | `index.ts` onDeterminingFilename + reportSuccess (extract `settleSuccess`), `job-persistence.ts` reconcile callbacks, `download-handler.ts` restartPending |
| Cancel | D4, D5 | `download-handler.ts` startDownloadWithTimeout callback + bind-result handling, `index.ts` cancel handler |
| Guards + naming + bridge | D7, D8, D9 | `download-handler.ts` handleDownloadRequest, `url-helpers.ts` composeSuggestedFilename + `index.ts` filename listener, `bridge-download-service.ts` mapStatusToOutcome + observer |
