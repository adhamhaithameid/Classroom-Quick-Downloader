# Classroom API Assist (v3, beta) — Owner Setup Guide

Sprint: Engine V4 S13 (api-assist). Related: #398 (privacy/consent model),
#770 (parallel-adjacent `wxt.config.ts` work — see the coordination note in
step 2).

The API assist is Google Classroom API corroboration layered on top of the
V2 DOM engine (`engine-v3`). It ships **inactive**: no install can run it
until the extension owner (you) completes a one-time OAuth setup, and no
user can trigger it until they explicitly select the **API (beta)** Engine
Mode in the popup. This doc covers the owner steps, how activation is
verified end-to-end, and the privacy model.

---

## 1. What the setup gate is

Everything keys off one probe: `isApiConfigured()`
(`extension/src/engines/v3/api/config.ts`). It returns true only when BOTH:

1. the manifest grants the `identity` permission
   (`chrome.identity.getAuthToken` exists), and
2. the manifest declares an OAuth2 client id (`oauth2.client_id`).

Until both hold, the probe reads false and the feature is fully inert — the
registry refuses to activate `engine-v3`, and the popup renders the API
option disabled.

## 2. Owner steps

### 2a. Create the OAuth client in Google Cloud

1. Open <https://console.cloud.google.com/> → create (or pick) a project for
   Classroom Quick Downloader.
2. Enable the **Google Classroom API** (APIs & Services → Library).
3. APIs & Services → Credentials → **Create credentials → OAuth client ID**
   → Application type: **Chrome extension**.
4. For **Application ID**, enter your extension ID:
   - While developing (load unpacked): the ID shown on
     `chrome://extensions` (it derives from the key/public path — keep the
     load path stable or pin a `key` in the manifest to fix the ID).
   - For store builds: the store-assigned extension ID per browser store.
5. Copy the generated client id (ends in `.apps.googleusercontent.com`).

No OAuth consent screen publishing review is needed while the extension is
unlisted/internal for testing; for public store distribution, finish the
consent-screen configuration in the same project.

### 2b. Add the manifest fields (wxt.config.ts)

> **Coordination note:** `extension/wxt.config.ts` is currently
> **parallel-adjacent** to active work (bead #770, pending). Do NOT stack
> this edit until that lands. The exact JSON below is the complete change —
> nothing else in the file moves.

Inside `defineConfig({ manifest: { ... } })`, add:

```ts
permissions: [
  'downloads',
  'storage',
  'alarms',
  'identity',                       // ← add
],
oauth2: {                           // ← add (new top-level manifest key)
  client_id: '<CLIENT_ID>.apps.googleusercontent.com',
  scopes: [
    'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
  ],
},
```

Notes:

- The `scopes` list is what `chrome.identity.getAuthToken` requests when the
  scopes argument is empty (which is how the v3 stack calls it). The
  `classroom.student-submissions.me.readonly` scope is the minimum that
  covers the one call the assist makes:
  `GET classroom.googleapis.com/v1/courses/{id}/courseWork/{id}/studentSubmissions`.
  Add `https://www.googleapis.com/auth/classroom.courses.readonly` only if a
  future phase needs course metadata.
- No CSP change is required: `connect-src` already allows
  `https://*.googleapis.com`.
- Firefox: `identity` + oauth2 is Chrome-specific; the Firefox adapter path
  resolves no token (null) and the assist silently stays DOM-only.

## 3. How activation is verified (the full chain)

With a fresh build after step 2, verify in order:

1. **Probe** — `isApiConfigured()` returns true in an extension context
   (devtools on any extension page: the popup now renders the API option
   enabled).
2. **Registry** — set Engine Mode to API (beta) (popup) → the content
   console logs the registry summary with `engine-v3` active
   (`[CQD Registry] Registered engine: engine-v3`). Before the setup, the
   same selection logs the fallback warning
   (`Mode "v3" unavailable: manifest lacks identity permission or oauth2
   client_id. Falling back to shadow.`) and V1+V2 run instead.
3. **Engine Mode UI** — unconfigured installs see the option rendered
   disabled with the tooltip "Requires OAuth setup (see docs)"; configured
   installs see it enabled with the privacy tooltip (below).
4. **Runtime** — open a teacher student-work view (assignment → student
   submissions). With v3 active the engine fetches the submissions snapshot
   (`[Engine V3] Initialized for view: student_work_teacher (API assist:
   snapshot ready)`); `getApiCorroborationTrace(postId)` exposes the
   `api-corroboration` layer trace for inspected posts.

Unit pins for this chain: `tests/v3-api-config.test.ts`,
`tests/v2-engine-registry.test.ts` (configured + fallback paths),
`tests/popup-engine-mode.test.ts` (both UI states),
`tests/v3-engine-api-corroboration.test.ts` (wiring + privacy).

## 4. Integration depth (honest scoping)

What runs today, end-to-end: token acquisition, snapshot fetch, cache
warm-up on view change, and a real `ApiDetector.observe` pass over V2's
tracked posts on student-work views, publishing the `api-corroboration`
LayerTrace on the debug/explanation surface.

What does **not** change yet: rendered flags/buttons. V2's per-post
decision pipeline (`ingestPost → detectFlags → scoreFlagsForPost`) is
decision-shaped and private; injecting the observation-shaped detector into
it without rewriting its semantics is the documented follow-up once the
owner credential step (this doc, step 2) has shipped and real snapshots can
be observed in the wild. The corroboration floor it will apply is additive
only (D12 precedent): never creates, lowers, or rewrites a finding.

## 5. Privacy model (#398)

- **Explicit consent:** the assist runs only when the user selects API
  (beta) — an explicit Engine Mode choice persisted as `cqdV2Mode: 'v3'`.
  It is never a default and never implied by another mode.
- **No background token acquisition:** tokens are requested non-interactively
  (`chrome.identity.getAuthToken({ interactive: false })`) and ONLY while v3
  is active AND the current view is a student-work view
  (`STUDENT_WORK_TEACHER` / `STUDENT_SUBMISSIONS`). Any other view, any other
  mode: zero identity calls.
- **Scope of data:** the single studentSubmissions read for the route the
  user is already looking at. No comment text, no edited-history facts, and
  no page text ever leave the page; the API snapshot contains submission ids,
  states, and attachment metadata.
- **Silent degradation:** a denied/absent token, a stale snapshot, or a route
  mismatch makes the assist vanish — detection is then exactly the DOM
  engine's output, unchanged.
- **Reverting:** switching the Engine Mode back to Legacy/New stops all API
  activity immediately; the assist holds no token cache beyond the active
  view lifecycle (`destroy()` clears it).
