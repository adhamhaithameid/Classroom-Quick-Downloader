# Engine V4 S13 — API Assist Engine (1yf.13) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The ApiDetector exists as a real `Detector` strategy behind the port (the owner's "API engine"), OAuth token access flows through a port (not raw chrome.identity), consent + fallback is honest (token denial/failure → silent DOM-only detection), and 'v3' mode activates the real engine path when credentials exist — with everything testable via fakes so the owner's later client-id creation is a config step, not a code step.

**Architecture:** Reuse the implemented V3 api stack (`src/engines/v3/api/`: classroom-api-client fetchStudentSubmissions, token-provider, discovery-service, runtime-bridge — all existing + tested). New: `IdentityTokenPort` on BrowserPort (getAuthToken wrapper) + adapter + fake; `src/strategies/detect/api-detector.ts` implementing `Detector` (contracts/detection.ts) mapping API submissions data → PostObservation signals; combine-policy entry so API observations corroborate DOM observations (never replace — post-G4 promotion rules); registry 'v3' stops falling back to [V1,V2] when identity+client-id are present. OWNER-BLOCKED (documented, non-blocking): real OAuth client id in Google Cloud + `identity`/`oauth2` manifest fields — the code gates on their presence at runtime.

**Tech Stack:** TypeScript, Vitest + fakes, chrome.identity (adapter only).

**Spec:** master plan §6 S13 row + R7 (post-G4 — met, G4 closed 2026-09-18), bead `1yf.13`, gh #679 #398 (consent/privacy), ENGINE_TASK_LIST §A API engine row.

## Global Constraints

- R7 honored: this is assist/corroborate, never a replacement for DOM detection; promotion stays manual.
- Consent/privacy (#398): no token acquisition without explicit user activation of 'v3' (Engine Mode API option); fallback silent; no token caching beyond chrome.identity's own.
- Fitness rules: strategies/ imports follow the new-layer rules; adapters import only contracts/bus.
- Full verification per §11. Pathspec-limited commits, ≤100-char headers, Write/Edit tools, no pushes.
- Never touch website/*, cloudflare-worker/*, root package.json verify:contract. wxt.config: ONLY if clean of parallel edits (the 770 default_locale is still pending the same file — coordinate: if homepage_url still uncommitted, manifest identity/oauth2 fields are ALSO blocked → document, gate at runtime).

## Tasks

### Task 1: IdentityTokenPort + adapter + fake
1. contracts/ports.ts: extend BrowserPort with optional `getIdentityToken?(details: { scopes: string[] }): Promise<string | null>` (null = denied/unavailable) — additive optional keeps all existing fakes/adapters conforming; OR a standalone IdentityPort — read the existing port conformance test and choose the smaller seam.
2. adapters: chrome.identity.getAuthToken wrapper (interactive:false; null on any error) + fake (scriptable token/denial). Conformance test in ports-conformance.
3. Commit: `feat(engine): identity token port + adapter + fake (S13)`

### Task 2: ApiDetector strategy
1. src/strategies/detect/api-detector.ts implementing Detector (name 'api'): constructor takes (tokenPort, runtimeBridge-or-client, routeContext) — reuse engines/v3/api modules; observe(post, ctx) returns PostObservation enriched ONLY when an API snapshot for the current route exists AND a token was granted; otherwise returns the DOM-only observation it wraps (decorator pattern — ApiDetector WRAPS a base detector, falling back verbatim). No token acquisition inside observe — token comes from the orchestrator's consent flow.
2. Unit tests: with token+snapshot → API-corroborated signals; token null → identical to base detector output (deep equality); snapshot stale → fallback; detector conformance suite passes for it (same suite as keyword/structural).
3. Commit: `feat(engine): api-detector strategy with silent dom fallback (S13)`

### Task 3: Consent flow + registry v3 activation
1. Engine Mode UI: the hidden API option (S6 left it out) — render 'API (beta)' disabled-with-tooltip when identity/client-id absent (runtime probe via the token port + a isApiConfigured() helper), enabled when present; selecting it = explicit consent (sets cqdV2Mode 'v3'); reverting revokes nothing (chrome.identity handles tokens) but documents the privacy note (#398: no background token acquisition — token fetched only on student-work views when v3 active).
2. engine-registry: 'v3' → [EngineV3] when isApiConfigured(), else the current fallback [V1,V2] + warn (keep the existing tests, add the configured path).
3. Commit: `feat(engine): v3 consent gating + registry activation (S13)`

### Task 4: Closeout
Full verification (unit/golden/accuracy/compile; qa 16/0/1 headless). Session log docs/session-logs/<date>-engine-v4-s13-api-assist.md; ENGINE_TASK_LIST S13 row; bd close 1yf.13 (documenting the owner action: create Google Cloud OAuth client id for the extension ID + add identity/oauth2 manifest via wxt.config when clean — OR keep v3 dormant, which the epic permits: "V3 either shipped behind OAuth or explicitly deferred" — the code ships, activation is the owner's config step).

## Self-Review

- G6 ("V3 either shipped behind OAuth or explicitly deferred"): satisfied by shipping the strategy + consent + activation path, dormant without owner credentials.
- All prior sprints' parked minors that belong to S13: none — they live on their beads.
