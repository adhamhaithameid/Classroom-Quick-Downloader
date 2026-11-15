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

Ranked by blast radius. Status as of 2026-11-15: every item is either
fixed or reclassified as documented intent; the PR link shows where.

1. **Fork drift in the Download All group machine (verified).** Fixed
   2026-11-15 on PR #882 (live-`inProgress` seeding + bounded trailing
   flush; the `failed` flag was already sticky — see the correction above).
2. **Engine selector can lie about shadow mode.** Reclassified 2026-11-15:
   documented intent. The selector never offered shadow; the popup's
   `v2` display for a shadow install is the designed display, not a
   defect. No code change.
3. **v3 without API config shows the wrong engine.** Reclassified
   2026-11-15: documented intent — the registry's shadow-pair fallback
   keeps unconfigured v3 installs working. No code change.
4. **Media modal can hide the navbar site-wide.** Fixed 2026-11-15 on
   PR #888 (body class clears on unmount).
5. **Worker alarm clobber.** Fixed 2026-11-15 on PR #886
   (`scheduleRetry` arms earliest-wins; 3 new tests).
6. **V2 watchdog races queue admission.** Fixed 2026-11-15 on PR #891
   (two-stage watchdog: 45 s demotes to trying, 90 s of silence errors).
7. **Milestone consumed unplayed.** Fixed 2026-11-15 on PR #890 (claim
   ack window 1500 ms → 8 s, test-pinned with a 7.5 s storm ack).
8. **History row drop.** Fixed 2026-11-15 on PR #889 (writes serialize
   on a promise chain; same-tick settles both land).

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
   boolean cluster. Owner epic (engine-v4 program) — not attempted
   autonomously.
3. **One owner for engine-mode validity.** Partially landed 2026-11-15 on
   PR #887: `MODE_STORAGE_KEY` and `isValidMode` are exported from
   `mode-controller` and the mirrors are deleted. The popup-representable
   `shadow`/v3-fallback half was reclassified as documented intent.
4. **One alarm-arming discipline in the Durable Object.** Landed
   2026-11-15 on PR #886: `scheduleRetry` arms earliest-wins; the midnight
   writer already did.
5. **Delete the dead quota duplicate.** Landed 2026-11-15 on PR #886.
6. **Give the popup one view-state union.** Replace the 15-flag tree with
   one type per view decision. Open; UX-shape decision, not a mechanical
   fix — not attempted autonomously.

Addendum findings status (2026-11-15):

- **Wire or delete the reconciler/viewport pair.** Owner call (documented
  target architecture vs dead scaffolding). Not attempted autonomously.
- **Scope the deep-validator module globals.** Landed on PR #895
  (per-engine tracker; scope-only, decay semantics unchanged).
- **Consent-denial policy (per-click vs per-install).** Owner call; the
  code documents per-click intent. Not attempted autonomously.
- **Share the watchdog constants and hint helpers.** Landed on PR #893
  and PR #894.
- **Dashboard dirty-form guard + orphaned dot.** Landed 2026-11-15 on
  PR #896 (guard + dot in the live config header; dead dot markup removed).
- **Edge-optional local gate.** Landed on PR #885 (`test:e2e:edge` skips
  cleanly without Edge; the local full gate now completes end-to-end).

## Not surveyed

These pockets were surveyed on 2026-11-15; see
[Addendum 2026-11-15](#addendum-2026-11-15-previously-unsurveyed-pockets).
The overview page CSS blocks, the globe template tail, and
`website/src/routes/+layout.svelte` (84 KB) remain uncensored at the
detail level.

## Addendum 2026-11-15: previously unsurveyed pockets

Two survey passes completed the census. Everything below was verified
against the code at `c079d4f1`. Corrections to the original hints: the
v2 telemetry/repair/model modules live under `src/v2/`, not
`src/engines/v2/` (only `engine-v2.ts` sits in `engines/v2/`).

### v2 engine internals and roles (`extension/src/`)

| Machine | Location | Encoded by | Risk or note |
|---|---|---|---|
| Throttle ladder | `src/v2/telemetry/budget-controller.ts:76,437` | Explicit `ThrottleLevel` union, one-step escalation, no de-escalation except reset | Its declared purpose is dead: nothing in production reads `getDebounceMs`. One transient CPU spike pins `critical` until destroy. |
| Correction retry + instability | `src/v2/repair/correction-queue.ts:131`, `deep-validator.ts:147` | Counters, priorities, timestamp Map, unstable Set | `unstableElements` is module-global, shared by every engine instance (EngineV3 embeds a private EngineV2), and never decays. The `processing` field is write-only. |
| Reconcile diff machine | `src/v2/model/reconciler.ts:115` | Explicit op union + fingerprints | Dead in production: `engine-v2.ts` never calls it (the live model is its own `postMap`). Built and tested code nothing invokes. |
| Viewport-zone machine | `src/v2/model/viewport-observer.ts:258` | Explicit `ViewportZone` union, two observers | Also unwired: `engine-v2.ts:1118` passes `undefined` as the zone getter, so every deep-validation correction is priority LOW and the visible-first sort is a no-op. |
| S5 role cycle state | `src/roles/harden-engine.ts:123` | Edge-publish on `lastLevel` delta | Other roles are stateless verbatim publishers; irrelevant batches republish stale arrays. Mirror types in `harden-engine.ts:46` drift only structurally. |
| Targeted-vs-full scan | `src/engines/v2/engine-v2.ts:362` | Null-vs-Set return, threshold 8 | A relevant-but-unresolvable mutation silently escalates to a full page scan; the two states are implicit in a nullable return. |
| Deep-validation scheduler | `src/engines/v2/engine-v2.ts:178,1091` | One boolean + idle callback | Trivial one-shot flag; plus a details-view self-heal rescan keyed on a files-count drop memory cell. |

### v3 API token lifecycle (`extension/src/engines/v3/api/`)

| Machine | Location | Encoded by | Risk or note |
|---|---|---|---|
| Token acquisition | `token-provider.ts:55` | Null-vs-throw outcome, boolean `interactive` arg | No token-state type. The interactive escalation fires exactly once per miss and a denial throws; the thrown denial is deliberately not cached, so a denied consent re-prompts on every classroom-wide click (per-click semantics; per-install would need a denial-memory cell). |
| Snapshot + inventory caches | `cache.ts:11`, `course-inventory.ts:55` | TTL timestamps in Maps | Empty inventories cache for 5 minutes while consent denials never cache — opposite policies on the two empty-looking outcomes. |
| Rate limiter | `rate-limiter.ts:46` | Rolling timestamp array | Module singleton shared by three consumers; EngineV3 destroy resets it and also throttles the classroom-download-controller's unrelated budget. |
| Client pagination caps | `classroom-api-client.ts:157,232` | Two counters | `pageGuard < 10` for submissions vs `MAX_LIST_PAGES = 3` for classwork lists in one file. |
| Refresh re-entrancy guard | `engine-v3.ts:269` | Method-choice convention + comment | Nothing type-level prevents re-arming the snapshot loop; the invariant lives only in a comment. |

The adapter ports (`adapters/scheduler/idle-scheduler.ts`,
`adapters/clock/system-clock.ts`, `adapters/identity/`) are built and
tested but unwired in the v2 stack: production still calls raw
`requestIdleCallback` and `Date.now`. The identity port also hand-duplicates
the token provider's dual-shape result handling.

### Student-work internals (`extension/src/student_work/`)

| Machine | Location | Encoded by | Risk or note |
|---|---|---|---|
| Button lifecycle | `button.ts:282` + `entrypoints/content/button-state.ts:39` | CSS classes are the store; `ButtonState` union derived | Same CSS-as-truth pattern as V1, with `pendingButtons` plus `dataset.cqdRequestId` dual tracking and cleanup duplicated across five sites. |
| 45 s watchdog | `button.ts:31` vs `src/v2/render/download-controller.ts:49` | Timer handle in a WeakMap / Map | Parity is intentional but enforced by comments: the constant and the error message are duplicated literals. The V1 watchdog arms only after the resolve phase, so worst-case time-to-error is ~60 s under two timeout authorities; V2 auto-resets errors after 3 s while V1 runs a hover-gated loop — a real behavioral divergence. |
| Resolve cascade | `resolver.ts:360` + `channel.ts:78` | Free-form `reason` strings, one-shot done latch, sender-id auth | `reason` is not a union and `resolveMessageFromReason` (`button.ts:46`) matches substrings — fragile cross-module coupling. The BroadcastChannel fallback was removed for security audit S4; the authenticated relay is the only path. |
| Extractor ladder | `extractor.ts:467` | Source union + hint gates | The hint decode/parse/scoring helpers are verbatim-duplicated between `extractor.ts` and `resolver.ts` — the easiest extraction win in the pocket. |

### Dashboard client machines (`cloudflare-worker/src/dashboard/`)

| Machine | Location | Encoded by | Risk or note |
|---|---|---|---|
| Live WebSocket toggle | `main.ts:7690-7800` | Plain vars + `data-live-state` attr | `off → connecting → live → off`, 10-minute hard auto-close, no auto-reconnect by design (quota-load-bearing). |
| Live-indicator freshness | `main.ts:5190` | 5 s interval + `data-state` | `live/stale/cold` at 30 s/180 s; the interval runs while the tab is hidden. |
| Config dirty form | `main.ts:5712-5954` | Module boolean + status text | No `beforeunload` guard: unsaved changes are lost silently on navigation. The `unsaved-dot` indicator exists in HTML and CSS but no JS ever toggles it — orphaned UI. |
| Tab nav + card search | `main.ts:7825-7922` | Hash routing, aria attrs, 150 ms debounce | Two machines share the `hidden` property (the searching body class overrides panel hiding). |
| Raw-console unlock | `websiteConsole.ts:494` | Boolean + pill classes | The client "unlocked" state can outlive the server-side danger step-up expiry; no re-lock path except reload. |
| Minor machines | `main.ts` various | Booleans, timers, server KV | Notification dismissal (server-side KV), changelog action status, 24 h clock toggle in localStorage, and a dormant rules-engine UI kept for rollback behind null guards. Only three intervals exist by design (1 s clock, 5 s indicator, 60 s pipeline health). |

### Website routes

The `watch/` routes are static native-video pages with no state machines.
`emails/` is unreachable (unconditional 308 redirect to `emails2/`) and its
svelte page is dead code. `emails2/` is static content plus the
`AnimatedNumber` counter (pre-animation → animating → settled via rAF and an
IntersectionObserver latch — `AnimatedNumber.svelte:84-137`).

### New findings folded into the extraction list

1. **Wire or delete the reconciler and viewport-observer pair.** Two fully
   built, tested machines do nothing in production while the engine passes
   `undefined` for the zone getter. Dead architecture is worse than no
   architecture: it misleads readers and the tests pin behavior nothing uses.
2. **Scope the deep-validator's module globals.** `unstableElements` and the
   correction history leak across engine instances on one page.
3. **Decide the consent-denial policy.** Per-click re-prompting is the
   current behavior; per-install needs a denial-memory cell.
4. **Share the watchdog constants and the hint helpers.** The 45 s constant,
   its error message, and the resolver/extractor hint blocks are duplicated
   literals today.
5. **Give the dashboard's dirty config form a `beforeunload` guard**, and
   either wire the orphaned `unsaved-dot` UI or remove it.

## How to refresh this census

Run the same four-slice survey at the current commit and diff the tables.
The encoding taxonomy in [Scope and method](#scope-and-method) and the table
columns are the stable contract; row set and line numbers are the variable
part. Update the warning banner with the new commit before filing the doc.
