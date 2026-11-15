# Implicit state machine audit — 2026-11-14

> [!WARNING]
> Dated report. This census describes the code at main commit `c4889191`
> (2026-11-14). Line numbers drift. Verify a claim against the code before
> you act on it.

## Scope and method

Four parallel survey passes covered the live surfaces of the monorepo:

- Extension core logic: `extension/src/`.
- Extension surfaces: `extension/entrypoints/` (background, popup, options,
  diagnostics, content scripts).
- Worker: `cloudflare-worker/src/` (Workers API + Durable Objects).
- Website: `website/src/` (SvelteKit).

Explorers read the code; the surveyor read key modules directly. The survey
is static analysis. No claim below is runtime-proven. Three race findings
need a browser or integration test to confirm; they carry that label.

Skipped: `oracle-backend/` (severed from the live data path 2026-09),
`tools/`, the generated admin dashboard `cloudflare-worker/src/dashboard/main.ts`,
the email preview routes, and extension i18n and detector internals. See
[Not surveyed](#not-surveyed).

### What counts as an implicit state machine

An implicit state machine encodes a lifecycle, mode, or phase without one
named state type or a state-machine library. The encodings found here:

- Clusters of booleans whose combinations mean one named state.
- Status or phase strings held as bare values and compared across files.
- Counters that gate behavior: retry counts, thresholds, sequence numbers.
- Timers that drive transitions: backoff ladders, watchdogs, debounce and
  reset chains, rAF loops, cron and alarm windows.
- The DOM as the store: CSS classes and data attributes read back as state.
- Storage records as the store: mirrors, seen-maps, hand-rolled repair.
- Promise chains as locks, and module-level singletons as memory.

The repo already has an explicit house style. "Implicit" below means "not
using that style". The glossary terms for the domains are in `GLOSSARY.md`
(download pipeline, engine mode, flags, levels and milestones).

## The explicit machines (the house style)

These machines use one named state type. They are the pattern to copy.

| Machine | Location | Shape |
|---|---|---|
| Acquisition reducer | `extension/src/core/acquire/state-machine.ts:72` | `AcquireMachineState` union, pure reducer, inert effects. The `bypass-tab` phase is unreachable; its helper is Stryker-disabled scaffolding at `:151`. |
| Queue engine | `extension/src/queue/queue-engine.ts:76` | `QueueSnapshot` plus total functions; invariants P-Q3..P-Q6 pinned by tests. |
| Icon phase machine | `extension/src/icon/icon-state-machine.ts:10` | `IconPhase` union with injected timers and a zero-live-timers invariant. |
| V2 group file state | `extension/src/v2/render/download-all-controller.ts:128` | `GroupFileState` union per file; run phase derived. |
| Snapshot store | `website/src/lib/types/public.ts:146` | `WebsiteSnapshotStoreStatus` union (but see the flag duplication row). |
| Balloon run engine | `website/src/lib/celebration/balloons/types.ts:1` | `BalloonsRunState` union with cooldown. |
| Media loader | `website/src/lib/components/MediaLoader.svelte:36` | `MediaState` union plus a separate lazy-arm gate. |
| Uninstall submit | `website/src/routes/uninstall/+page.svelte:52` | `submitState` union. |
| Map prompt | `website/src/routes/overview/+page.svelte:347` | `mapInteractionState` union. |

Key insight from the survey: the acquisition reducer exists because the
entrypoint download flow was implicit (the #664 race, per its header). The
production background still runs the implicit flag machine. The explicit
reducer and the production flow agree only through the differential corpus
test and the shared `AcquireOutcome` vocabulary.

## Inventory: extension core (`extension/src/`)

| Machine | Location | Encoded by | Risk or note |
|---|---|---|---|
| Engine mode ladder | `src/v2/orchestrator/mode-controller.ts:114` | Bare string in storage plus registry field | Validity list hand-copied in three places. Popup resolves `shadow` to `v2` for display while the runtime runs shadow. |
| Auto-mode resolver | `src/v2/orchestrator/mode-controller.ts:150` | Inline ring aggregation over router stats | Re-implements `statsForRing` with different failure semantics. Two copies of one calculation. |
| Router stats ring | `src/engines/router/router-stats.ts:102` | Ring arrays, counters, op-chain mutex | Cache never refreshes on storage change. Two tabs keep independent caches; last-writer-wins drops observations. |
| Router policy | `src/engines/router/router-policy.ts:88` | Score arithmetic, 10-min switch cooldown, stickiness | Hysteresis constants live only in the code. Log-only wiring. |
| Milestone claim protocol | `src/history/download-stats.ts:372` | Nullable field plus serialized promise chain | The 1500 ms ack timeout races the chain. Under a batch storm the background can claim-and-clear after the surface gave up; the milestone is consumed and never played. |
| Download stats settle chain | `src/history/download-stats.ts:333` | `countChain` promise mutex, checksummed record | Per-context only. Cross-context writes handled ad hoc by the claim protocol. |
| History store | `src/history/history-store.ts:141` | Array, id dedupe, checksum | `recordDownloadHistory` runs outside any chain. Two settles in one tick can read-modify-write race and drop a row. |
| Settings schema ladder | `src/ui/settings/store.ts:92` | Version marker, per-key coercion, self-heal write | `saveSetting` writes a key without stamping the version. Compat is convention enforced by tests. |
| Backoff policy | `src/retry/backoff.ts:44` | Attempt counter parameter, full jitter | Its bound must agree with `MAX_TRANSIENT_ATTEMPTS` in the reducer; a corpus test holds the two together. |
| V3 API rate limiter | `src/engines/v3/api/rate-limiter.ts:30` | Timestamp array in one shared instance | Dies on service worker suspend. |
| V2 single-file controller | `src/v2/render/download-controller.ts:265` | Map membership, watchdog timer, sequence counter | The 45 s watchdog races queue admission. A request queued behind three active downloads can legitimately exceed 45 s; the button errors while the background later completes the download. Runtime race, needs a test. |
| V2 button state | `src/v2/render/button-state.ts:38` | CSS classes read back; union only for parameters | Weaker gate than V1: no hover rule. The `cancel` state is never set by anyone. |
| V2 group run machine | `src/v2/render/download-all-controller.ts:128` | Per-file union plus run flags and timers | A button re-rendered by the engine mid-run tears the run UI down while in-flight downloads continue. |
| Shared V1 group machine | `src/download-all/refresh.ts:102` | Boolean clusters, WeakMaps, dirty set | Verified divergence from the entrypoint fork: still seeds the sticky `inProgress` flag that the entrypoint fork removed as the #537 hang fix. The student-work stacks run this variant. Correction 2026-11-15: the `failed` flag was already sticky via the `someError = file.failed` seed; only the `inProgress` seeding and the missing mid-run re-flush diverged. Both fixed on PR #882 with a pinned regression suite. |
| Classroom-wide run | `src/v2/render/classroom-download-controller.ts:201` | Module `run` field, counters, request-id set | No phase between "stopping" and "stopped". Published files keep downloading after the stop click; the label is the only difference. |
| Copyright gate | `src/v2/render/copyright-reminder.ts:51` | Persisted boolean plus singleton dialog | Gate await sits after the stop-branch check, so a stop click cannot land while a gate dialog is open. |
| Keyword cache | `src/v2/decision/keyword-loader.ts:131` | Map, `lastActivity` timestamp, 60 s idle timer | A scan that runs past 60 s without touching the getters re-triggers loads. Correct, but a silent perf cliff. |
| DomPort multiplexer | `src/adapters/dom/mutation-observer-dom-port.ts:98` | Subscription map, observer counter | `SUPERSET_INIT` observes all attributes document-wide. Every subscription self-filters at dispatch. |
| Runtime bridge correlation | `src/adapters/bridge/runtime-bridge.ts:144` | Request map capped at 500, delete-on-answer | A worker restart between request and answer loses the map. The page side then waits for its own timeout. |
| Event bus | `src/bus/event-bus.ts:71` | Subscriber sets, dispatch flags | Synchronous dispatch blocks the scan cycle. Documented as intended. |
| RouteWatcher | `src/v2/context/route-classifier.ts:280` | Monkey-patched history functions, debounce timer | `stop()` restores what it captured at construction. An external monkey-patcher in between is silently overwritten. |
| Shadow comparator | `src/v2/compat/shadow-compare.ts:103` | Interval handle, report ring | The orchestrator monkey-patches an instance method to capture reports (`orchestrator.ts:381`). Fragile seam. |
| Engine registry | `src/engines/engine-registry.ts:166` | Mode-to-engines map | For `v3` without API config it returns the shadow pair while storage still says `v3`. Selection and reality disagree. |
| Diagnostics builder | `src/diagnostics/build.ts` | Pure function of inputs | No lifecycle state. Listed for completeness. |

## Inventory: extension surfaces (`extension/entrypoints/`)

| Machine | Location | Encoded by | Risk or note |
|---|---|---|---|
| Pending download lifecycle | `background/types.ts:70` | Booleans and counters (`htmlSeen`, `retryCount`, `startRetried`, `startTimedOut`, `finalized`, `isCancelled`, `attemptedAuthUsers`) | One retry budget spans two failure families. `htmlSeen` doubles as a message-shown flag. Timers die on MV3 suspend. |
| MV3 restart seam | `background/job-persistence.ts:122` | Storage mirror keyed `cqd_pending_jobs_v1`, reconcile on boot | Mirror writes are best-effort. A dropped record never settles visibly; its tab pill hangs until the content-side reset loop. |
| Queue adapter | `background/queue.ts:37` | Module snapshot plus `paused` flag | Memory-only. A restart un-pauses and forgets queued-but-unstarted requests. |
| One-shot response guard | `background/download-handler.ts:318` | `respondOnce` plus `responseSent` flag | Keeps the single-shot channel honest across retries. Sound. |
| Icon adapter | `background/icon-animation.ts:118` | `applySeq` counter, `badgeStyled` flag | Memory-only. A flash mid-restart is lost. Recovered actives re-notify via the queue listener. |
| Icon override channels | `background/icon-manager.ts:30` | Three module-level override slots plus enabled flag | Disabled state, classroom-URL state, and the update dot compose in one if-chain. Transient disagreement possible. |
| Update dot | `background/update-dot.ts:92` | Persisted record plus seen map, 12 h alarm | Popup recomputes the target independently, so two evaluators read one record. A failed check keeps a stale dot. |
| Analytics alarm | `background/analytics-alarm.ts:27` | Per-boot boolean guard | Trivial by design. |
| Milestone arbiter wiring | `background/index.ts:859` | Message-based claim over the stats chain | Both celebration surfaces order settings-before-stats by await placement in two files. Ordering is the correctness. |
| Popup view cluster | `popup/App.tsx:1239` | Roughly 15 independent booleans and counters | Illegal combinations handled by fallbacks. Queue rows poll at 600 ms, so cancel feedback can lag. Race guard is a hand-rolled request-id counter at `:553`. |
| Engine selector | `popup/App.tsx:2087` | Storage string plus local resolve | Resolves `shadow` to `v2` for display. The selector can show "New" while shadow runs. |
| Options toggles | `options/OptionsApp.tsx:64` | Optimistic write plus storage echo | Double click uses the stale render-closure value; the echo corrects it. Transient flip. |
| V1 button machine | `content/button-state.ts:39` | CSS classes are the store; `ButtonState` union is derived | The group machine writes those classes directly, mutating this machine behind its setter. `STATE_PRIORITY` map is dead code. |
| V1 group machine | `entrypoints/download_all.content.ts:539` | Booleans, WeakMaps, CSS classes, sticky per-file flags | Sticky seeding exists as the #537 fix. `currentRunId` is written but never read. Group and child machines communicate through CSS. |
| V1 mode gate | `content/mode-gate.ts:133` | Tri-state closure plus per-stack booleans | Suppression rule duplicated from mode-controller. Student-work stacks deliberately skip the gate, so the selector and the page disagree there. |
| Frame flag machines | `content/comment_frame.content.ts:283`, `content/edited_frame.content.ts:271`, `content/both-badge.ts:48` | Module booleans, DOM data attributes | The "Both" badge merges two attribute writers through copy-pasted teardown code in three places. |
| Student-work scans | `student_work_by_status.content.ts:550`, `student_work_sidecar.content.ts:274` | Debounce timers, processed markers | Route-based mutual exclusion enforced only by a check inside the sidecar. Synthetic host ids injected into foreign DOM. |
| Resolver bridge poller | `student_work_resolver_bridge.content.ts:52` | 250 ms interval, 10 s deadline | Bounded by design. A worker restart costs one failed resolution. |
| Keyboard shortcut routing | `background/index.ts:889` | Message contract plus two always-registered content listeners | In v2 mode the V1 listener answers `{ok:false}` and races the V2 listener. Harmless today because the background ignores the ack. |
| Diagnostics page | `diagnostics/DiagnosticsApp.tsx:32` | Nullable report plus copied flag | No notable risk. |

## Inventory: worker (`cloudflare-worker/src/`)

One Durable Object holds most machines. Its single alarm is a shared bus
with two incompatible arming disciplines: `scheduleAlarmAtEarliest`
(earliest-wins) and unconditional `setAlarm`.

| Machine | Location | Encoded by | Risk or note |
|---|---|---|---|
| Archive flush pipeline | `src/downloads_do.ts:7158` | `lastFlushAt`, `retryState`, batch attempts, day key | `scheduleRetry` at `:6505` arms the alarm unconditionally and can clobber the daily flush or a telemetry retry. Dead-letter ladder caps at 8 attempts; oversized payloads fast-fail past it. |
| Website telemetry queue | `src/downloads_do.ts:3823` | Head batch `attempt` plus `nextRetryAtUtc`, dead-letter cap 1000 | Head-of-line blocking on the first failing batch. A missing D1 binding counts as retryable and dead-letters permanently. |
| Pipeline health | `src/downloads_do.ts:5612` | Status assembled as a string from four threshold families | Thresholds live in four layers. This is the bug class bead ldlz fixed once. |
| Config migration ladder | `src/downloads_do.ts:2949` | Version gate plus value-equality sentinels | Two migration idioms in one hydration path. A deliberately custom 6 h threshold gets silently retuned. |
| Quota backpressure ladder | `src/downloads_do.ts:2083` | Eight named levels as bare strings, daily counters, kill switch | `VERY_HARD` (70k) sits below `HARD` (80k) by design because the gate uses the combined max. A dead duplicate, `src/downloads_do/quota.ts`, encodes different thresholds and has no importers. |
| KV cache entry | `src/cache.ts:50` | Two module maps, TTL comparisons, single-flight | Stale-on-error covers throws only. Explicit `null` from KV skips the last-good serve. |
| Snapshot freshness | `src/index.ts:3143` | Timestamps in the payload, `x-site-cache` header values, 365-day TTL | No rebuild single-flight. Concurrent stale requests race the KV put. |
| Public-data circuit breaker | `src/index.ts:573` | One module `let`, fixed 60 s window | Per-isolate. A flap is invisible across isolates. |
| Scrape health watchdog | `src/store-stats.ts:330` | Per-store failure counters, composed status string, 6 h dedupe | The dedupe keys on the composed string, so one store changing while another recovers bypasses the throttle. |
| Store stat caches | `src/index.ts:2869` | `fetchedAtUtc` timestamps in KV payloads | Stale-serve is unbounded. The site can show frozen counts indefinitely while scrapes fail. |
| Uptime ring | `src/uptime.ts:72` | 288-slot ring, 7-day rollups, consecutive-failure walk | Read-modify-write on KV is not atomic. Deleting the key resets all history. |
| Login lockout | `src/downloads_do.ts:8087` | Per-IP attempt records in a fixed 15-minute window | Not sliding. The 500-entry cap lets unique IPs evict their own records. |
| Session binding | `src/index.ts:262` | Token payload, fingerprint check, `off/optional/strict` mode | `optional` (current) makes fingerprint mismatch a legal serving state. No server-side revocation before the 1 h expiry. |
| IP allowlist | `src/downloads_do.ts:8261` | Two persisted booleans plus CIDR list | Fail-open on parse error, fail-closed on unknown IP. Enabled with an empty list behaves as disabled. |
| Rate limit buckets | `src/downloads_do.ts:3389` | Three per-minute maps plus daily caps, wiped at UTC rollover | A burst at 23:59 straddles two full budgets. |
| Ingest dedupe rings | `src/downloads_do.ts:4420` | Bounded id rings, monotonic count guard, string-keyed retry buckets | Ring eviction lets older-than-ring replays double-count. The reliability metric joins on the literal `"0"` bucket. |
| Changelog auto-sync | `src/downloads_do.ts:3682` | Interval state plus status string on the shared alarm | Another machine on the single alarm bus. |
| Archive schema latch | `src/event-archive.ts:29` | Per-isolate boolean | Each cold isolate reruns the DDL batch. Harmless but quota-consuming. |
| Reliability KV cache | `src/reliability.ts:61` | Hourly cron recompute, lifetime counters | Lifetime only. A rolling-window feature would misread it. |
| Public metrics slots | `src/downloads_do.ts:4599` | 3-hour slot key plus two booleans | Admin override replaces numbers wholesale and can diverge from live counters forever. |

## Inventory: website (`website/src/`)

Context note: commit `09de763f` (2026-10-31) deleted the footer sheet-reveal
machine (`initSheetReveal`, `magneticPin.ts`, the runway spacer). Ghosts
survive: the always-false `liveSheet` branch, a dead `paused` prop on the
ambient background and grid bend, stale comments, and CSS-less `l2-snap`
classes.

| Machine | Location | Encoded by | Risk or note |
|---|---|---|---|
| Navbar pill morph | `src/routes/+layout.svelte:414` | `scrolled` boolean, `barMode` union, viewport test, measure class | The measure state mutates live DOM and forces reflow. A scroll event landing mid-measure re-enters the sync. |
| Megamenu | `src/routes/+layout.svelte:272` | Nullable string key, one 170 ms close timer | Two panel channels driven by one key; `install` is special-cased. |
| Nav dark/light identity | `src/routes/+layout.svelte:568` | IntersectionObserver band coverage folded into one boolean | Sections mounted after the 60 ms re-scan are never observed. |
| Route loader double | `src/lib/components/LoadingScreen.svelte:12` | Two booleans plus two timers | A second channel (route-dim opacity) exists for the same transition. The two can disagree visually. |
| Footer cascade | `src/lib/components/SiteFooter.svelte:90` | Arm and go classes, `chainUntil` timestamps, settle on animationend | Dead `liveSheet` branch at `:95`. Comments still claim the reveal lives in the layout. |
| Footer wordmark field | `src/lib/components/SiteFooter.svelte:343` | Booleans, timestamps, `moveSeq` sequence guard | The `moveSeq` guard is the only thing preventing an infinite loop after `pointerleave`. |
| Section reveal | `src/routes/overview/+page.svelte:952` | Class names plus a pending set, 4 s failsafe | Fail-open by design. |
| Map prompt | `src/routes/overview/+page.svelte:578` | Union plus booleans plus an untracked typewriter timer chain | The typewriter chain is never cancelled on teardown and mutates state after unmount. |
| Celebration wrapper | `src/routes/overview/+page.svelte:426` | Page flags plus wall-clock cooldown around the explicit engine | Cooldown uses `Date.now()`. The dev route `/overview-editor` is a diverged twin still using the old flood library. |
| Marquee | `src/routes/overview/+page.svelte:676` | Drag, coast, direction booleans | The only animation loop in the codebase that never parks. It transforms at 60 fps while offscreen. |
| Media modal | `src/routes/overview/+page.svelte:1507` | Nullable media id plus `l2-media-modal-open` body class | The body class has no unmount cleanup. Navigating between `/` and `/overview` with the modal open can leave the navbar hidden site-wide. Runtime leak, needs a browser check. |
| Map modal | `src/routes/overview/+page.svelte:2129` | Boolean plus reactive body class | A failed lazy import leaves the modal on "Preparing..." forever. The rejection is swallowed. |
| Map data state | `src/routes/overview/+page.svelte:303` | Explicit three-way union plus a fourth implicit chunk state | No single owner across store status, snapshot presence, and chunk arrival. |
| Branded cursor | `src/lib/cursor/cursorStates.ts:22` | 37 `data-state` values held in a `Set<string>` | Priority table is documented and test-pinned. The state travels as a string, not a union. |
| Magnetic hover | `src/lib/actions/magnetic.ts:122` | Spring state plus phase booleans | A button that re-renders without a scroll or resize keeps a stale rect. |
| Grid bend | `src/lib/actions/gridBend.ts:30` | Active, paused, seen-pointer booleans plus influence | First pointermove activates; the `paused` branch is dead since the footer window was removed. |
| Media loader | `src/lib/components/MediaLoader.svelte:36` | Explicit `MediaState` union plus lazy-arm gate and 30 s poll | The poll timeout leaks in the lazy-video branch cleanup path. |
| Snapshot store flags | `src/lib/stores/websiteSnapshot.ts:54` | Status union plus `degraded`, `stale`, `isRefreshing` booleans | Three overlapping encodings of the same idea. Consumers must check both. |
| Analytics queue | `src/lib/analytics/websiteEvents.ts:332` | Buffer plus 15 s flush, beacon on pagehide | Error beacons dedupe by key with session caps. |
| FAQ filters | `src/routes/faq/+page.svelte:400` | Set plus nullable string plus query | Three interacting filters with no single state object. |
| Dead machines | `src/lib/actions/glassSheen.ts`, `src/lib/components/StatsTrendStrip.svelte`, `src/routes/overview/+page.svelte:316` | Unused imports and a parked constant | `scrollHeaviness = 1` parks a complete wheel hijacker one edit from live. |

## Cross-cutting patterns

These patterns explain most of the rows above.

1. **The explicit machine is the exception.** Four machines use the house
   style. The production download path still runs the flag machine the
   reducer was built to replace.
2. **Timers are the dominant transition driver.** Backoff ladders, watchdogs,
   flash resets, debounces, staggers, and flush windows all live in
   `setTimeout` or `setInterval`. MV3 suspend kills all of them.
3. **The DOM and storage are stores.** V1 button and group truth lives in CSS
   classes. Mirrors live in `chrome.storage.local` records with hand-rolled
   repair. Two machines communicate through CSS.
4. **Promise chains are locks, per context.** Three chains exist (analytics,
   stats, router). None spans contexts. Cross-context safety is ad hoc.
5. **Ordering is correctness.** The icon flash needs `notifySettled` before
   cleanup. Celebration surfaces need settings before stats. A test pins the
   cycle order. No type enforces any of these.
6. **Checksums sanitize, never error.** History, stats, and analytics each
   implement the same djb2-style checksum. Corrupt payloads become fresh
   empties.
7. **Dead states persist as scaffolding.** `bypass-tab`, the V2 `cancel`
   state, three `DownloadStatus` members, `STATE_PRIORITY`, `currentRunId`,
   `glassSheen`, `StatsTrendStrip`, and the footer-reveal ghosts.
8. **One alarm, many machines, two disciplines.** The Durable Object alarm
   multiplexes the daily flush, retry ladders, telemetry retries, and
   changelog sync. Writers mix earliest-wins and unconditional arming.

## Live issues found

Ranked by blast radius. Items 4 and 6 are runtime races; confirm them in a
browser or integration test before fixing.

1. **Fork drift in the Download All group machine (verified).**
   `src/download-all/refresh.ts:102` seeds the sticky `inProgress` flag that
   the entrypoint fork removed as the #537 hang fix
   (`entrypoints/download_all.content.ts:596`). The student-work stacks run
   the un-fixed variant.
2. **Engine selector can lie about shadow mode.** The popup resolves
   `shadow` to `v2` for display while the runtime runs shadow
   (`popup/App.tsx:2087` vs `mode-gate.ts:35`).
3. **v3 without API config shows the wrong engine.** The registry returns
   the shadow pair while storage says `v3`
   (`engine-registry.ts:166`).
4. **Media modal can hide the navbar site-wide.** The body class lacks
   unmount cleanup (`overview/+page.svelte:1507`). Needs a browser check.
5. **Worker alarm clobber.** `scheduleRetry` overwrites an armed alarm
   unconditionally (`downloads_do.ts:6505`).
6. **V2 watchdog races queue admission.** A queued request can legitimately
   exceed the 45 s watchdog (`download-controller.ts:265`). Needs a test.
7. **Milestone consumed unplayed.** The 1500 ms claim ack loses to a slow
   settle chain under a batch storm (`download-stats.ts:402`).
8. **History row drop.** `recordDownloadHistory` writes outside any chain
   (`history-store.ts:141`).

## Extraction candidates

Ranked. Each converges many rows onto one shape.

1. **Align or delete the `src/download-all` fork.** Carry the #537 fix into
   the shared fork, or route the student-work stacks through the entrypoint
   fork. Smallest change with the largest bug-shaped payoff. Landed
   2026-11-15 on PR #882: live-`inProgress` seeding plus a bounded trailing
   flush while a group is active.
2. **Converge the download lifecycle on the existing reducer.**
   `core/acquire/state-machine.ts` already models phases, authuser rotation,
   and retry bounds. Move the production background onto it and delete the
   boolean cluster.
3. **One owner for engine-mode validity.** Export the key and the valid-mode
   list from `mode-controller.ts`. Make `shadow` and the v3 fallback
   representable in the popup.
4. **One alarm-arming discipline in the Durable Object.** Route every writer
   through `scheduleAlarmAtEarliest`.
5. **Delete the dead quota duplicate.** `cloudflare-worker/src/downloads_do/quota.ts`
   encodes different thresholds and imports nothing.
6. **Give the popup one view-state union.** Replace the 15-flag tree with
   one type per view decision.

## Not surveyed

These pockets likely hold further machines. They sit outside this census.

- `extension/src/engines/v2/` internals: `budget-controller.ts` holds a
  contract-defined `ThrottleLevel` ladder; also `correction-queue.ts`,
  `deep-validator.ts`, `reconciler.ts`, `viewport-observer.ts`.
- `extension/src/engines/v3/api/`: token lifecycle with interactive-consent
  escalation (`InteractiveConsentTokenProvider`, `ChromeIdentityTokenProvider`).
- `extension/src/student_work/`: `resolver.ts`, `button.ts` (watchdog parity),
  `channel.ts`.
- `extension/src/roles/`: the S5 role state behind `publishCycleTopics`.
- `extension/src/adapters/scheduler/`, `adapters/clock/`, `adapters/identity/`.
- `cloudflare-worker/src/dashboard/main.ts`: 7,976 generated lines, grepped
  only. Client-side polling cadences unverified.
- Website routes `emails/`, `emails2/`, `watch/*`; the overview page CSS
  blocks and the globe template tail.

## How to refresh this census

Run the same four-slice survey at the current commit and diff the tables.
The encoding taxonomy in [Scope and method](#scope-and-method) and the table
columns are the stable contract; row set and line numbers are the variable
part. Update the warning banner with the new commit before filing the doc.
