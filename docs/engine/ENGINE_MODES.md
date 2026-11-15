# Engine Modes — capabilities map

Current as of 2026-10-03 (verified against `extension/src`; anchors are
`file:line` in that tree). Setup steps and OAuth details live in
[api-assist-setup.md](api-assist-setup.md) — this page is the what-exists map.

## Modes

`EngineMode = 'legacy' | 'shadow' | 'v2' | 'v3'` (`src/engines/types.ts:102`).
Stored under key `cqdV2Mode` in `chrome.storage.local` (per-device by design —
`src/v2/orchestrator/mode-controller.ts:13-17,53`). Default `'v2'`
(`mode-controller.ts:86`). User-facing via the popup's segmented control
(`entrypoints/popup/App.tsx:1802-1831`); live-switch pings the tab
(`'cqd-set-mode'`) and cross-tab sync rides `storage.onChanged`
(`mode-controller.ts:177-199`). The debug panel (Ctrl+Shift+D) is read-only
(`src/v2/debug/debug-panel.ts:343-353`). `'shadow'` is code-real but not
offered in the popup — storage/debug-level only (`App.tsx:1701`).

## Engines

| Mode | Engines active | First = renderer | Definition |
|---|---|---|---|
| `legacy` | engine-v1 (1.3.9) | v1 | `src/engines/v1/engine-v1.ts:70` |
| `shadow` | v1 + v2 | v1 renders, v2 compares silently | `src/engines/engine-registry.ts:173` |
| `v2` (default) | engine-v2 (4.0.0-alpha) | v2 | `src/engines/v2/engine-v2.ts:115` |
| `v3` | engine-v3 (4.2.1-stub) — **only if `isApiConfigured()`**, else falls back to v1+v2 shadow | v3 | `src/engines/v3/engine-v3.ts:88`; fallback `engine-registry.ts:178-192` |

All three implement `CQDEngine` (`src/engines/types.ts:288-341`) and are
registered in the content-script bootstrap (`entrypoints/v2_bootstrap.content.ts:55-58`,
dynamic imports so a V2 crash can't break legacy). The registry's
`getActiveEngines()` maps mode→engines (`engine-registry.ts:166-199`); unknown
mode → legacy fallback.

## What v3 adds over v2

V3 wraps an internal EngineV2 for all DOM functionality and layers a
Classroom-API assist on top (`engine-v3.ts:18-36,115`):

- **Corroboration snapshots** on student-work views only (`isStudentWorkView()`,
  `engine-v3.ts:288-291`): fetches
  `courses/{id}/courseWork/{id}/studentSubmissions` via
  `ClassroomApiDiscoveryService` + `ClassroomApiClient`, caches them, and
  republishes for the resolver (`runtime-bridge.ts`, window global
  `__CQD_SW_API_SNAPSHOT_V1`; consumer `src/student_work/resolver.ts:246`).
- **D12 floor** — the only way API data changes detection today: a real DOM
  comment numeral whose score died sub-threshold is floored to `comment_show`
  (`src/strategies/detect/api-detector.ts:141-166`). Corroboration otherwise
  does **not** alter rendered flags/buttons (honest scoping: `engine-v3.ts:29-36`,
  [api-assist-setup.md](api-assist-setup.md) §4).
- **"Download All Classroom" button** (csaa.6, v3-only — the gate is
  EngineV3 calling `ensureClassroomButton`, `src/v2/render/classroom-download-controller.ts:15-24,119-135`):
  click enumerates the course's Drive files via `CourseInventoryService`
  (5-min cache) and publishes staggered download requests on the page bus —
  rides the existing browser-session bridge, **zero API quota per file**.
- API work is content-script only; the background never calls into v3
  (`engine-v3.ts:41-44`).

## Gates, in order

1. **Page gate**: orchestrator runs engines only on `classroom.google.com/*`
   URLs with a known view; UNKNOWN view → abort, engines destroyed
   (`src/v2/orchestrator/orchestrator.ts:258-262`,
   `src/v2/context/route-classifier.ts:179-212`).
2. **Install gate**: `isApiConfigured()` — true only with BOTH the `identity`
   permission and a non-empty `oauth2.client_id` in the manifest
   (`src/engines/v3/api/config.ts:42-54`; both landed in `wxt.config.ts:52-56`,
   scope `classroom.readonly`). True means *capable*, not *consented*.
3. **Consent gate**: the user must select `v3` in the popup (issue #398);
   enforced structurally by the registry (`engine-registry.ts:178-192`) and a
   disabled popup option on unconfigured installs (`App.tsx:1806-1811`).
4. **Route gate**: API routes resolve only for
   `/c/{course}/a/{courseWork}/submissions[/{student}]` and classwork
   `/w/{course}/t[/{topic}]` (`src/engines/v3/api/route-context.ts:5-10,29-75`).
5. **Freshness gate**: a usable snapshot needs cached token + snapshot +
   matching viewKind + age ≤ 120s (`api-detector.ts:93,169-179`).
6. **Quota gate**: shared rolling limiter, 30 calls / 60s
   (`src/engines/v3/api/rate-limiter.ts:21-22`); over budget → skip fetch
   silently (`classroom-api-client.ts:142-159`).

## Degradation guarantees (silent by construction)

Every failure below the consent gate degrades to exact baseline behavior,
never to an error surface or worse detection:

- v3 selected without OAuth config → registry falls back to the v1+v2 shadow
  pair with a console warn; "v3 never silently renders nothing"
  (`engine-registry.ts:185-192`).
- Token denied/absent → `null` token (`token-provider.ts:16-25`), empty
  submission/file lists (`classroom-api-client.ts:150-151,208-209`).
- Snapshot missing/stale/route-mismatch → ApiDetector returns the base
  observation verbatim; "the API layer can never make detection worse"
  (`api-detector.ts:7-13`).
- Discovery/inventory failures → warn + DOM untouched
  (`engine-v3.ts:141-143,238-241`; `course-inventory.ts:10-13`).
- Reverting to legacy/v2 stops all API activity immediately and clears
  token/snapshot caches ([api-assist-setup.md](api-assist-setup.md) §5).

## Known comment/UI drift (2026-10-03)

- `mode-controller.ts:20` and `v2_bootstrap.content.ts:83-84` comments claimed
  default `'legacy'`; code default is `'v2'` — comments fixed this same day.
  The popup's fresh-install display fallback (`App.tsx:755`, `|| 'legacy'`)
  still shows "Legacy" before first storage write; runtime runs v2.
- `engine-v3`'s `4.2.1-stub` version string understates reality: the
  corroboration pipeline is real end-to-end; only its effect on rendered
  flags is pending.

## Auto mode + shadow router (beads hhpa.1–.3, 2026-10-28)

The popup engine selector offers **Auto**. Auto is a per-device opt-in
stored as `cqdV2Mode='auto'`; the mode controller resolves it to a concrete
mode from local outcome stats before the registry sees it. With no data,
Auto resolves to the factory default `v2`. `v2` remains the shipped
default for everyone; default-on Auto awaits owner review of shadow data.

Plumbing (all under `extension/src/engines/router/`):

- `router-stats.ts` — rolling per-mode × page-view outcome store
  (`cqd_engine_router_stats_v1` in chrome.storage.local; ring cap 50 per
  mode, total cap 400; cancelled settles excluded; burst-safe op chain).
- `router-policy.ts` — pure scoring: success rate + sample confidence −
  failure-streak penalty + stickiness bonus, a 10-minute switch cooldown,
  and hysteresis (a healthy current mode is never demoted on a marginal
  score). v3 is a candidate only when `isApiConfigured()`.
- `router-shadow.ts` — page-bus wiring. HARD GATE: it logs decisions and
  never calls `setMode`; decision records ride `/track` on signature
  changes only (`file_type: engine_router_decision`).
