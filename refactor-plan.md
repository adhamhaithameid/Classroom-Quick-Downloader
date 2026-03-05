# CQD V2 + V3 — Universal Download + Intelligent Flag Refactor Plan

> **Goal**: Make every downloadable file across all Google Classroom pages have a download button, build a smarter flag detection system (commented/edited/both), and wrap it in a deterministic, testable architecture — without breaking anything that works today.
>
> **V2 (extension 4.0.0)**: DOM-only engine — new orchestrator, deterministic targeting, unified flags, repair system. Ships with zero new permissions.
>
> **V3 (extension 4.2.1)**: API-enhanced engine — adds Google Classroom API integration via OAuth for complete file inventory and cross-validation. Requires `identity` permission.

---

## Table of Contents

1. [Audit of Current System](#1-audit-of-current-system)
2. [What the Existing Plan Gets Right](#2-what-the-existing-plan-gets-right)
3. [Gaps & Improvements Needed](#3-gaps--improvements-needed)
4. [Lessons from Similar Projects](#4-lessons-from-similar-projects)
5. [Target Architecture (V2)](#5-target-architecture-v2)
6. [Deterministic File Targeting System](#6-deterministic-file-targeting-system)
7. [Intelligent Flag System](#7-intelligent-flag-system)
8. [Intelligent Repair System](#8-intelligent-repair-system)
9. [Performance Optimization — Every Interaction](#9-performance-optimization--every-interaction)
10. [Phased Implementation](#10-phased-implementation)
11. [Version Bumps & File Changes](#11-version-bumps--file-changes)
12. [Website: Scroll-Based Mechanism Animation](#12-website-scroll-based-mechanism-animation)
13. [Extension Popup Height Adjustment](#13-extension-popup-height-adjustment)
14. [Pill & Changelog Page Styling](#14-pill--changelog-page-styling)
15. [Test Suite & Verification](#15-test-suite--verification)
16. [Rollout & Safety](#16-rollout--safety)
17. [Considered PRs & Optimizations](#17-considered-prs--optimizations)

---

## 1. Audit of Current System

### Architecture Snapshot

| Component | File | Lines | Role |
|-----------|------|-------|------|
| Single-file download | `content/observers.ts` + `button-factory.ts` | ~410 | Scans DOM for Drive anchors, injects buttons |
| Download All | `download_all.content.ts` | 1398 | Groups files by post, adds "Download All" |
| Comment detection | `comment_frame.content.ts` + `smart-detector-comments.ts` | ~900 | 5-layer fallback (DOM truth → Accessibility → Button → Golden selectors → Nuclear scan) |
| Edited detection | `edited_frame.content.ts` + `smart-detector.ts` | ~825 | 4-layer detection + exclusion engine |
| Both badge | `both-badge.ts` | 193 | Merges comment+edited into combined pill |
| Tab detection | `tab-detector.ts` | 114 | URL-based page classification |
| Keywords | `detection-keywords.ts` | 702 | 100+ languages, Unicode digit parsing, date parsing |
| State | `state.ts` | 96 | Selectors, constants, global mutable state |

### Critical Weaknesses Found

1. **Brittle class selectors**: `state.ts` uses `.KlRXdf`, `.z3vRcc`, `.VfPpkd-aPP78e` — Google can rename these at any deployment
2. **3 independent content scripts** (`comment_frame`, `edited_frame`, `download_all`) each spin up their own `MutationObserver` + heartbeat interval — tripling DOM observation cost
3. **No unified lifecycle**: Each script independently manages start/stop/URL-change — leading to race conditions on SPA navigation
4. **Incomplete page coverage**: `tab-detector.ts` recognizes Stream/Classwork/Topic/Details but the button injection in `observers.ts` only targets Drive anchors found via `DRIVE_ANCHOR_SELECTOR` and `ATTACHMENT_CONTAINER_SELECTOR` — misses student submission pages, announcement attachments on some views, and embedded YouTube/Forms resources
5. **Flag placement is fragile**: Comment/edited badges are placed relative to brittle class anchors; no fallback strategy when Google changes the post structure
6. **No decision trace**: When a flag is wrong, there's no way to know *why* — debugging requires reading through 5 detection layers manually
7. **Scattered exclusion logic**: Action button exclusion patterns are hardcoded regex arrays in `smart-detector-comments.ts`; edited exclusion in `smart-detector.ts` Layer 4 — no shared exclusion engine
8. **No pre/post verification workflow**: No tooling to capture DOM snapshots before changes, making regression detection manual

### What Currently Works Well

- Unicode digit/word-number parsing across all scripts (robust)
- 4-layer comment detection with confidence scoring
- Idempotent injection via `data-cqd-injected` / `data-cqd-processed` attributes
- WeakMap-based state in `download_all.content.ts` (good memory hygiene)
- Comprehensive i18n coverage (100+ languages)
- 51 test files with 100% coverage gates on critical paths

---

## 2. What the Existing Plan Gets Right

| Aspect | Verdict |
|--------|---------|
| Hybrid API+DOM discovery | ✅ Correct approach — API gives file inventory, DOM gives placement |
| Canonical entity model (`PostNode`, `FileNode`) | ✅ Essential for dedup and deterministic decisions |
| Dual-run shadow validation | ✅ Safest migration path |
| Semantic-first selectors with class fallback | ✅ Matches industry best practice |
| Phase 0 baseline inspection before code | ✅ Critical — must happen first |
| Performance budgets (p95 <6ms mutation, <120ms hydration) | ✅ Realistic and measurable |
| Decision trace / debug overlay | ✅ Solves the "why is this flag wrong?" problem |

---

## 3. Gaps & Improvements Needed

### 3.1 Missing from the Existing Plan

| Gap | Impact | Fix |
|-----|--------|-----|
| **No concrete DOM snapshot tooling** | Phase 0 says "capture snapshots" but doesn't specify how | Add a `tools/capture-classroom-snapshot.ts` Playwright script that saves HTML + screenshot per page type |
| **No pre-change issue catalog format** | "Produce baseline report" has no structure | Define a `verification/baseline/<date>/issues.json` schema with fields: page, url, issue_type, selector, screenshot_ref, expected, actual |
| **No concrete test fixture strategy** | "Real captured Classroom HTML fixtures" — but no workflow to create them | Add a `tools/extract-fixture.ts` that strips PII from saved HTML and stores under `extension/tests/fixtures/classroom/` |
| **OAuth permission UX not planned** | Plan says "add identity permission" but doesn't address the user consent flow or what happens when user denies | Add Phase 1.5: OAuth consent UI in popup, graceful degradation to DOM-only mode when denied |
| **No offline/API-failure fallback** | If API calls fail (quota, auth, network), V2 has no plan | Add explicit DOM-only fallback mode with degraded-confidence markers |
| **Student submission page selectors not documented** | Plan mentions student work pages but doesn't catalog the actual DOM structure | Add Phase 0 task: document DOM structure for `/c/{id}/a/{id}/submissions/{studentId}` |
| **No internationalization impact analysis for flags** | Keyword detection covers 100+ languages but plan doesn't address languages where "edited" concept doesn't exist or uses different date formats | Add Phase 4 task: audit all keyword tables for edited/comment coverage gaps |
| **No Chrome Web Store review risk assessment** | Adding `identity` permission triggers a full re-review — could delay publishing by weeks | Add risk mitigation: phase API features behind a flag that ships permission-less first |
| **No memory budget** | Performance section covers CPU but not memory — 702-line keyword table loaded per tab | Add: lazy-load keyword tables by detected language, cap WeakMap sizes |
| **No rollback telemetry** | Plan says "one flag flip to legacy" but doesn't track if rollback actually helped | Add: before/after mismatch rate comparison on rollback |

### 3.2 Edge Cases Not Covered

1. **Multi-account `authuser` switching** — user switches accounts mid-session; API tokens are for wrong account
2. **Classroom in iframe** — some LMS platforms embed Classroom; content script may or may not inject
3. **Google Workspace admin restrictions** — some schools disable API scopes; extension must not crash
4. **Very long posts with 50+ files** — "Download All" button placement and grouping must handle pagination/lazy-load
5. **RTL layout mirroring** — badges positioned with `right: X` need `left: X` in RTL; current code checks `getPageDirection()` but V2 placement engine must be RTL-aware from the start
6. **Dark/light theme toggle mid-session** — theme class changes must propagate to all V2-injected elements
7. **Stale tabs** — tab that's been backgrounded for hours may have expired API cache; need cache TTL + re-fetch on focus
8. **Extension update mid-session** — content script dies on extension update; need graceful reconnect or user notification
9. **Announcement-only posts** — announcements can have attachments but no `courseWork` API entry; must use `announcements.list`
10. **Google Forms/YouTube embeds** — these appear as attachments but aren't downloadable; must be explicitly excluded from download buttons but may need "Open" action instead

---

## 4. Lessons from Similar Projects

### 4.1 Refined GitHub (9.2k ⭐)

**What they do**: Feature-manager pattern where each feature registers with a lifecycle controller.

| Pattern | How They Do It | How We Apply It |
|---------|----------------|-----------------|
| Feature lifecycle | Each feature gets an `AbortController`; on SPA navigation, all features abort and re-init | V2 orchestrator gives each module an `AbortSignal`; on route change, abort all, re-init for new route |
| Selector observation | `selector-observer.tsx` wraps `MutationObserver` to fire callbacks when elements matching a selector appear/disappear | Build `ElementLifecycleObserver` that watches for post elements and file anchors |
| SPA navigation | Listen for `turbo:load` (GitHub-specific) + `popstate` + URL polling | Listen for `webNavigation.onHistoryStateUpdated` from background + `popstate` + URL polling as fallback |

### 4.2 qsa-observer (WebReflection)

| Pattern | How We Apply It |
|---------|-----------------|
| `handle(element, connected, selector)` | Use same pattern: when a post element connects, run discovery+injection; when it disconnects, clean up WeakMap entries |
| `flush()` for synchronous processing | Use `flush()` before taking DOM snapshots in tests to ensure all pending mutations are processed |
| `drop()` for manual cleanup | Use `drop()` equivalent when user navigates away from a class |

### 4.3 ClassMate Classroom Downloader

| Pattern | How We Apply It |
|---------|-----------------|
| API-first inventory via `courseWork.list`, `courseWorkMaterials.list`, `announcements.list` | Same approach for V2 discovery — build complete file inventory from API, then reconcile with DOM |
| Dedup by canonical file ID | Use `driveFile.id` as canonical key — never rely on URL alone (URLs can have different `authuser` params) |
| SPA URL-change detection mix (MutationObserver on `<title>` + `setInterval` URL check) | Use `webNavigation.onHistoryStateUpdated` as primary, `popstate` as secondary, URL polling as last resort |

### 4.4 GCR Extension (Anti-Pattern Reference)

| What They Do Wrong | Our Lesson |
|-------------------|------------|
| Full-page scroll + raw anchor scraping | Never re-scan entire document; only scan changed subtrees |
| No dedup — same file can get multiple buttons | Canonical file ID + `data-cqd-file-id` attribute prevents this |
| No SPA awareness — only works on fresh page load | Our orchestrator must handle navigation without reload |

### 4.5 Best Practices Summary (from industry research)

1. **Selector priority**: `data-*` attributes > `aria-*`/`role` > structural relationships > class names
2. **Idempotent injection**: Check `data-cqd-*` attribute before every injection, not just "is button present"
3. **Scoped observation**: Observe specific subtree containers, not `document.body` with `subtree: true`
4. **Debounced batch processing**: Collect mutation records → debounce 50-100ms → process batch → flush UI
5. **Disconnection cleanup**: When observed element is removed, clean up all associated state immediately

---

## 5. Target Architecture (V2)

### 5.1 Module Structure

```
extension/src/v2/
├── orchestrator.ts          # Per-tab lifecycle controller
├── context/
│   ├── route-classifier.ts  # URL → ViewKind enum
│   └── account-resolver.ts  # authuser detection + validation
├── discovery/
│   ├── api-client.ts        # Classroom API calls (background)
│   ├── dom-scanner.ts       # DOM-based file/post discovery
│   └── reconciler.ts        # Merge API + DOM inventories
├── model/
│   ├── entities.ts          # PostNode, FileNode, CourseContext
│   ├── evidence.ts          # FlagEvidence, CommentEvidence, EditedEvidence
│   └── decisions.ts         # PlacementDecision, FlagDecision, DecisionTrace
├── decision/
│   ├── file-placement.ts    # Where to put download buttons
│   ├── flag-scoring.ts      # Comment/edited/both scoring engine
│   ├── exclusion-engine.ts  # Unified exclusion rules
│   └── rule-registry.ts     # Versioned rule definitions + thresholds
├── render/
│   ├── button-renderer.ts   # Idempotent download button injection
│   ├── flag-renderer.ts     # Idempotent flag badge injection
│   └── download-all.ts      # "Download All" button per post group
├── repair/
│   ├── deep-validator.ts    # Idle-time DOM ↔ intended state comparison
│   ├── correction-queue.ts  # Prioritized fix queue
│   └── budget-controller.ts # CPU/memory budget enforcement
├── telemetry/
│   ├── decision-trace.ts    # Per-post decision recording
│   ├── mismatch-counter.ts  # Shadow comparison metrics
│   └── perf-metrics.ts      # Timing + memory tracking
└── compat/
    ├── legacy-adapter.ts    # Bridges legacy content scripts
    └── mode-controller.ts   # legacy/shadow/v2 mode switching
```

### 5.2 Orchestrator Design

```
┌──────────────────────────────────────────────┐
│              V2 Orchestrator                  │
│  (one instance per tab, owns all lifecycle)   │
├──────────────────────────────────────────────┤
│  1. Route classifier determines ViewKind     │
│  2. Feature modules register via manifest    │
│  3. Each module gets AbortSignal             │
│  4. On navigation: abort → reclassify → init │
│  5. Single MutationObserver for ALL modules  │
│  6. Mutation batch → dispatch to modules     │
│  7. Idle scheduler for repair pass           │
└──────────────────────────────────────────────┘
```

### 5.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| One observer vs many | **One** shared observer | 3 independent observers is the #1 current performance issue |
| API permission timing | **Defer** — ship DOM-only first, add API behind flag | Avoids Chrome Web Store re-review delay |
| Keyword table loading | **Lazy** by detected language | 702-line table loaded upfront per tab is wasteful |
| State management | **WeakMap** keyed by DOM element | Already proven in `download_all.content.ts`; GC-friendly |
| Legacy coexistence | **Shadow mode** — V2 runs alongside legacy, results compared | Zero-risk migration |

---

## 6. Deterministic File Targeting System

### 6.1 Page Coverage Matrix

| Page Type | URL Pattern | Post Selector | File Sources | Current Status |
|-----------|-------------|---------------|--------------|---------------|
| Stream | `/c/{id}` | `div[data-stream-item-id]` | Announcements, posts | ✅ Working |
| Classwork list | `/w/{id}/t/all` | `li[data-stream-item-id]` | CourseWork, Materials | ✅ Working |
| Topic classwork | `/w/{id}/tc/{topicId}` | `div[data-stream-item-id]` | CourseWork by topic | ✅ Working |
| Assignment details | `/c/{id}/a/{itemId}/details` | Detail view container | Single courseWork | ⚠️ Partial |
| Material details | `/c/{id}/m/{itemId}/details` | Detail view container | Single material | ⚠️ Partial |
| Student submissions | `/c/{id}/a/{itemId}/submissions/{studentId}` | Submission container | Student attachments | ❌ Missing |
| Student work (teacher view) | `/c/{id}/a/{itemId}/submissions` | Student list + work | All submissions | ❌ Missing |
| Announcement detail | `/c/{id}/p/{postId}` | Post detail container | Announcement attachments | ⚠️ Partial |

### 6.2 Selector Priority Chain

For each page type, the targeting system uses this priority chain:

```
1. data-* attributes (data-stream-item-id, data-drive-id, data-material-parent-id)
   → Highest confidence, set by Google's own code
   
2. aria-*/role attributes (aria-expanded, role="listitem")  
   → Semantic, accessibility-stable
   
3. Structural relationships (closest <li>, parent with specific child pattern)
   → Layout-aware but not class-dependent
   
4. jscontroller/jsaction attributes (jscontroller="yP6Lwf")
   → Google's internal controller bindings, relatively stable
   
5. Class names (.KlRXdf, .z3vRcc, .VfPpkd-aPP78e)
   → LAST RESORT only, with staleness detection
```

### 6.3 Canonical File ID Strategy

```typescript
// Priority order for deriving canonical file ID:
// 1. data-drive-id attribute (most reliable)
// 2. Drive file ID from URL (/file/d/{id}/)
// 3. data-id + data-item-id combination
// 4. URL hash (fallback for non-Drive files)

function getCanonicalFileId(element: HTMLElement): string {
  return element.getAttribute('data-drive-id')
    ?? extractDriveFileId(findDriveUrl(element))
    ?? `${element.getAttribute('data-id')}-${element.getAttribute('data-item-id')}`
    ?? hashUrl(findAnyUrl(element));
}
```

### 6.4 Placement Decision Engine

For each discovered file, the engine produces a `PlacementDecision`:

```typescript
interface PlacementDecision {
  fileId: string;
  targetElement: HTMLElement;        // Where to attach the button
  insertionPoint: 'append' | 'prepend' | 'before' | 'after';
  anchorSelector: string;           // For debugging — what selector found the target
  confidence: number;               // 0-1 score
  reasonCodes: string[];            // e.g., ['DATA_ATTR_MATCH', 'STRUCTURAL_PARENT']
  fallbackUsed: boolean;            // True if class-based selector was needed
}
```

---

## 7. Intelligent Flag System

### 7.1 Current Problems with Flag Detection

1. **Comment detection fires on action buttons**: "Add class comment" text triggers false positives — exclusion patterns are regex-based and per-language
2. **Edited detection has no ground truth**: No API field for "last edited time" — relies entirely on DOM text parsing
3. **Both badge upgrade race condition**: `comment_frame` and `edited_frame` run independently; whichever finishes second triggers `upgradeCombinedBadge` but the first badge may already be visible for a moment
4. **False positives in user-generated content**: Student post text containing "3 comments about the essay" triggers comment detection
5. **RTL text parsing failures**: Arabic/Hebrew date formats can confuse the sliding window in `executeEditedLayer3`

### 7.2 New Evidence-Based Architecture

```
┌─────────────────────────────────────────────────┐
│            Flag Decision Pipeline                │
├─────────────────────────────────────────────────┤
│                                                  │
│  Phase A: Fast Deterministic Pass (<5ms)         │
│  ├─ Layer 0: DOM Truth (Classroom's own UI)      │
│  ├─ Layer 1: Accessibility attributes            │
│  └─ Layer 2: Stable structural anchors           │
│                                                  │
│  Phase B: Intelligent Deep Pass (idle budget)    │
│  ├─ Layer 3: Text tree scan with exclusions      │
│  ├─ Layer 4: Parent-context expansion            │
│  └─ Layer 5: API cross-validation (when avail)   │
│                                                  │
│  Phase C: Repair Pass (background)               │
│  ├─ Remove stale/duplicate badges                │
│  ├─ Reconcile with API data                      │
│  └─ Update confidence scores                     │
│                                                  │
│  Exclusion Engine (runs at every phase):          │
│  ├─ Action button text filter                    │
│  ├─ User-generated content filter                │
│  ├─ Cross-post boundary filter                   │
│  └─ Placeholder/template text filter             │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 7.3 Unified Exclusion Engine

Currently exclusions are scattered. The new system centralizes them:

```typescript
interface ExclusionRule {
  id: string;                    // e.g., 'ACTION_BTN_ADD_COMMENT'
  type: 'regex' | 'selector' | 'structural';
  pattern: RegExp | string;
  applies_to: ('comment' | 'edited' | 'both')[];
  penalty: number;              // Score reduction (0-1)
  reason: string;               // Human-readable explanation
}

// Categories:
// 1. Action buttons ("Add comment", "Write comment" in all languages)
// 2. User content boundaries (text inside student-authored areas)
// 3. Cross-post leakage (text from adjacent post bleeding into scan)
// 4. Template/placeholder text (empty state UI)
// 5. Navigation elements (breadcrumb, tab labels containing "comments")
```

### 7.4 Deterministic Score Resolution

```typescript
interface FlagDecision {
  postId: string;
  commentScore: number;          // 0-100
  editedScore: number;           // 0-100
  commentCount: number | null;   // If detected
  editedDiff: string | null;     // If detected (e.g., "2d")
  exclusionPenalties: { ruleId: string; penalty: number }[];
  finalVerdict: 'comment' | 'edited' | 'both' | 'none';
  confidence: 'high' | 'medium' | 'low';
  trace: DecisionTrace;          // Full audit trail
}

// Thresholds (versioned, tunable):
const THRESHOLDS = {
  comment_show: 40,              // Minimum score to show comment badge
  comment_high_confidence: 70,
  edited_show: 35,
  edited_high_confidence: 65,
  both_minimum_each: 30,         // Both scores must exceed this for "both" badge
};
```

---

## 8. Intelligent Repair System

### 8.1 Two-Speed Execution

| Speed | When | Budget | What |
|-------|------|--------|------|
| **Fast pass** | On mutation / navigation | <6ms p95 | Selector chain → placement → inject |
| **Deep pass** | `requestIdleCallback` | ≤25ms per slice | Text analysis → API cross-check → repair |

### 8.2 Self-Repair Loop

```
1. Deep validator scans all injected elements
2. For each: compare intended state (from model) vs actual DOM
3. Divergences added to correction queue (priority: visible > off-screen)
4. Correction worker processes queue in idle slices
5. Backoff: if same element corrected 3+ times in 10s, mark as unstable and log
6. Dedup: if mutation fires during correction, skip (already being fixed)
```

### 8.3 Efficiency Controls

- **Changed-root only**: On mutation, only scan the subtree that changed — never full-document rescan unless route transition
- **WeakMap caches**: Keyed by DOM element with stable fingerprint (post ID + file ID)
- **Debounced batches**: Collect mutations for 80ms → process batch → flush
- **Dynamic throttling**: If page has 100+ posts, increase debounce to 200ms
- **Memory cap**: WeakMap entries auto-GC when DOM elements are removed; explicit size tracking with warning at 500+ entries per tab
- **Lazy keyword loading**: Only load keyword table for detected page language, not all 100+

---

## 9. Performance Optimization — Every Interaction

> **Principle**: The extension must be invisible to the user's system. Zero perceptible lag on any click, hover, scroll, or page transition. Every millisecond counts on low-end Chromebooks that students use.

### 9.1 Button Interactions

| Interaction | Current Issue | Target | Strategy |
|-------------|---------------|--------|----------|
| Button render | Each button creates 3 child elements + event listeners | <1ms per button | Pre-build button template once, `cloneNode(true)` for each instance. Attach single delegated click handler on post root instead of per-button |
| Button hover (mouseenter) | Swaps icon URL + text on every enter | <0.5ms | Use CSS-only hover state (`:hover` selector changes `background-image` and `content`) — zero JS on hover |
| Button click → download start | Calls `handleSingleDownloadClick` which extracts metadata | <2ms to visual feedback | Show spinner immediately via class toggle, extract metadata async. Use `requestAnimationFrame` for state class changes |
| Button cancel (mouseenter on loading) | Text swap + icon swap via JS | <0.5ms | CSS-only: `.cqd-loading:hover .cqd-label::after { content: 'Cancel' }` pattern |
| Download All button | Iterates all files, starts sequential downloads | <5ms to visual feedback | Show progress immediately, batch `chrome.downloads.download` calls with microtask scheduling |

### 9.2 Flag Badge Interactions

| Interaction | Current Issue | Target | Strategy |
|-------------|---------------|--------|----------|
| Badge render | Creates DOM elements + attaches click listeners per badge | <0.5ms per badge | Reuse badge template. Single delegated click handler on post container |
| Badge hover expansion | CSS transition on `.cqd-flag-text` | Already CSS-only ✅ | Keep as-is, already performant |
| Badge click → pulse effect | `triggerPulseEffect` modifies multiple elements | <1ms | Use CSS `animation` triggered by class toggle, remove class after `animationend` event |
| Both badge upgrade | Removes 2 badges, creates 1 new one, modifies overlay | <2ms | Single DOM transaction: `DocumentFragment` to batch all mutations |
| Overlay border render | Creates div, computes styles, appends | <1ms | Cache `getComputedStyle` result per post. Use CSS custom property for border-radius instead of inline style |

### 9.3 Scroll Performance

| Concern | Strategy |
|---------|----------|
| Scroll-triggered rescans | Replace `scroll` event listener with `IntersectionObserver` for lazy button injection — only inject buttons for posts entering viewport |
| MutationObserver during scroll | Debounce mutation processing to 80ms during active scroll (detect via `scroll` event + 150ms idle timer) |
| Long pages (100+ posts) | Virtual scanning: only process posts within 2× viewport height. Use `IntersectionObserver` to detect when posts enter extended viewport |
| Memory on long pages | WeakMap entries auto-GC. Explicitly nullify references to off-screen post state after 60s out of viewport |

### 9.4 Navigation Performance

| Concern | Strategy |
|---------|----------|
| SPA route transition | Cancel all pending work via `AbortController.abort()`. Cost: <1ms. No stale callbacks fire |
| Initial page hydration | Target: <120ms. Strategy: single `querySelectorAll` pass for all post roots, batch button creation, single DOM append via `DocumentFragment` |
| Re-hydration after back/forward | Cache discovered `PostNode`/`FileNode` models keyed by URL. If URL matches cache, skip discovery, go straight to placement verification |

### 9.5 Detection Performance

| Concern | Current Cost | Target | Strategy |
|---------|-------------|--------|----------|
| Keyword table loading | 702-line file loaded at import time | Lazy load | Load only the detected page language + English fallback. Use dynamic `import()` for other language tables |
| Layer 4 Nuclear Scan (TreeWalker) | O(N) text nodes per post | O(N) but no clone overhead | Already optimized by TreeWalker PR (see §17). Further: cap scan at 500 text nodes per post, skip if earlier layers found match |
| `getComputedStyle` calls in detection | Called per element in TreeWalker filter | Cache per scan pass | Build visibility cache at scan start: `Set<Element>` of hidden elements computed once via single `querySelectorAll('[style*="display: none"], [style*="visibility: hidden"], [hidden]')` |
| Exclusion pattern matching | 14 regex patterns tested per text chunk | Compile once at module load | Pre-compile all patterns into single `RegExp` using alternation: `/(pattern1|pattern2|...)/i` — single regex test instead of 14 |

### 9.6 Memory Budget

| Resource | Budget | Enforcement |
|----------|--------|-------------|
| WeakMap entries per tab | <500 posts tracked | Log warning at 500, hard cap at 1000 (stop processing new posts) |
| Keyword tables in memory | 1 language table (~3KB) | Lazy import, unload after 60s of no detection activity |
| Decision traces | 50 most recent | Ring buffer in `chrome.storage.session`, auto-evict oldest |
| DOM elements injected per page | <2000 total (buttons + badges + overlays) | Count injected elements, warn at 1500 |
| Extension heap total | <30MB per tab | Monitor via `performance.measureUserAgentSpecificMemory()` where available |

### 9.7 CPU Budget

| Activity | Budget | Enforcement |
|----------|--------|-------------|
| Fast pass (per mutation batch) | <6ms p95 | `performance.now()` timing, warn at 8ms, abort at 15ms |
| Deep repair slice | <25ms per idle callback | `IdleDeadline.timeRemaining()` check, yield if <2ms left |
| Total CPU per second (steady state) | <50ms/s (5% CPU) | Moving average tracker, throttle if exceeded |
| Detection per post | <3ms for Phase A | Bail to Phase B (deferred) if exceeded |

---

## 10. Phased Implementation

### Phase 0: Baseline Capture (MANDATORY before any code)

**Tasks:**
1. Manual Classroom inspection across all page types (8 surfaces × 3 languages minimum)
2. Run `tools/capture-classroom-snapshot.ts` (to be created) for automated DOM + screenshot capture
3. Document all current issues in `verification/baseline/2026-03-XX/issues.json`
4. Run existing test suite: `pnpm -C extension test` — save results as baseline
5. Catalog every selector currently used in `state.ts`, `tab-detector.ts`, `smart-detector-comments.ts`, `smart-detector.ts`

**Manual Testing Matrix (Before):**

| Account Type | Languages | Pages |
|-------------|-----------|-------|
| Single Google account | en, ar (RTL), es | Stream, Classwork, Topic, Assignment details, Material details, Student work |
| Dual account (personal + school) | en, fr | Same + authuser switching |
| Multi-account (3+) | en, de, ja | Same + mismatched authuser |
| Restricted school account | en, ar | All accessible pages |

**Output**: `verification/baseline/` directory with screenshots, HTML snapshots, issue catalog

### Phase 1: V2 Scaffolding + Runtime Mode Gates

- Create `extension/src/v2/` directory structure
- Implement `orchestrator.ts` with AbortController lifecycle
- Implement `mode-controller.ts` with `legacy`/`shadow`/`v2` modes via `chrome.storage`
- Implement `route-classifier.ts` covering all 8 page types
- Wire shadow hooks: V2 runs silently alongside legacy, logging decisions but not injecting
- Apply performance foundations: delegated event handlers, CSS-only hover states, `DocumentFragment` batching
- Integrate TreeWalker optimization from considered PR (see §17)
- **No user-visible changes yet**

### Phase 2: DOM Discovery + Canonical Model

- Implement `dom-scanner.ts` using the 5-level selector priority chain
- Implement `entities.ts` (`PostNode`, `FileNode`, `CourseContext`)
- Implement `reconciler.ts` (DOM-only mode first, API mode later)
- Port `url-utils.ts` canonical file ID logic to new `getCanonicalFileId`
- Build `ElementLifecycleObserver` (inspired by qsa-observer) for connected/disconnected tracking
- Replace scroll-based rescans with `IntersectionObserver` for viewport-aware lazy injection
- **Shadow compare**: log how many files V2 finds vs legacy

### Phase 3: Deterministic Button Placement Engine

- Implement `file-placement.ts` with anchor scoring
- Implement `button-renderer.ts` with idempotent injection using template cloning + delegated handlers
- Implement `download-all.ts` grouping from canonical file IDs
- Add per-view placement recipes (Stream vs Classwork vs Details vs Submissions)
- All hover states via CSS-only (zero JS on mouseenter/mouseleave for visual changes)
- **Shadow compare**: log placement decisions vs legacy button positions

### Phase 4: V2 Flag Detector + Renderer

- Implement unified `flag-scoring.ts` replacing separate `smart-detector-comments.ts` and `smart-detector.ts`
- Implement `exclusion-engine.ts` centralizing all exclusion logic with single compiled regex
- Implement `flag-renderer.ts` with idempotent badge injection
- Build visibility cache to avoid repeated `getComputedStyle` calls
- Port and audit keyword tables — lazy-load by detected language only
- Implement `DecisionTrace` recording for every flag decision
- **Shadow compare**: log flag decisions vs legacy badges

### Phase 5: Intelligent Deep Validator + Repair + Performance Enforcement

- Implement `deep-validator.ts` running in idle callbacks with `IdleDeadline.timeRemaining()` checks
- Implement `correction-queue.ts` with priority and backoff
- Implement `budget-controller.ts` with CPU/memory limits (see §9.6 and §9.7)
- Add mismatch counters and reason codes
- Add self-healing for missing/misaligned buttons and flags
- Add performance monitoring: timing trackers, memory budget warnings

### Phase 6: Shadow Validation + V2 Launch → **Extension 4.0.0**

- Run V2 in shadow mode across full manual testing matrix
- Generate diff reports: `ShadowDiffReport` comparing V2 vs legacy
- Close gaps until: button coverage ≥99.5%, flag precision ≥98%, 0 duplicate injections
- Performance validation: all budgets from §9 pass on Chromebook-class hardware
- Switch default to `v2` mode
- Keep `legacy` mode available for 2 release cycles
- Monitor mismatch counters for 1 week post-launch
- **Bump extension version to `4.0.0`**
- Update popup height (see §13)
- Update pill & changelog page styling (see §14)

### Phase 7: API Discovery Layer → **Extension 4.2.1**

- Implement `api-client.ts` in background script
- Handle OAuth consent flow in popup with graceful degradation if denied
- Implement `courseWork.list`, `courseWorkMaterials.list`, `announcements.list`, `studentSubmissions.list`
- Wire API inventory into reconciler
- Graceful fallback to DOM-only when API unavailable
- Add `identity` permission to manifest
- Submit for Chrome Web Store re-review with justification document
- **Bump extension version to `4.2.1`**

### Phase 8: Website Mechanism Animation

- Build scroll-based Classroom slice animation on website (see §12)
- Show how extension injects buttons and flags into real Classroom UI

### Phase 9: Cleanup + Documentation

- ~~Delete `plan.md`~~ ✅ Done
- Update `ARCHITECTURE.md` with V2/V3 system design
- Update `TESTING.md` with new test suites and V2 coverage profiles
- Update `DEVELOPMENT.md` with V2 development workflow
- Update `README.md` with new version info and capabilities
- Update `CHANGELOG.md` with 4.0.0 and 4.2.1 entries
- Update `user-friendly-changelog.md` for website
- Contributor docs for adding new page type support

---

## 11. Version Bumps & File Changes

### Extension 4.0.0 (V2 — DOM-Only Engine)

| What | From | To |
|------|------|----|
| `extension/package.json` version | `1.3.9` (current) | `4.0.0` |
| `wxt.config.ts` manifest permissions | unchanged | unchanged (no new permissions) |
| `CHANGELOG.md` | current | Add 4.0.0 section: V2 engine, new targeting, unified flags, performance |
| `user-friendly-changelog.md` | current | Add user-friendly 4.0.0 entry |
| `ARCHITECTURE.md` | current | Add V2 architecture section, module diagram |
| `TESTING.md` | current | Add V2 test suites, fixture tests, performance tests |
| `DEVELOPMENT.md` | current | Add V2 dev workflow, shadow mode instructions |
| `README.md` | current | Update feature list, version badge |
| `extension/entrypoints/popup/App.css` | `height: 400px` | `height: 440px` |
| `extension/entrypoints/popup/App.tsx` | current | Minor layout adjustments for new height |

### Extension 4.2.1 (V3 — API-Enhanced Engine)

| What | From | To |
|------|------|----|
| `extension/package.json` version | `4.0.0` | `4.2.1` |
| `wxt.config.ts` manifest permissions | current | Add `identity` |
| `wxt.config.ts` manifest oauth2 | none | Add `oauth2.client_id` + scopes |
| `CHANGELOG.md` | 4.0.0 | Add 4.2.1 section: API integration, OAuth, enhanced coverage |
| `PRIVACY.md` | current | Add OAuth data access disclosure |

### Documentation Files Affected

| File | Change Type | What Changes |
|------|-------------|-------------|
| `ARCHITECTURE.md` | Major update | Add V2 module diagram, orchestrator flow, selector priority chain, flag scoring |
| `ARCHITECTURE_RUNTIME_CONTRACT.md` | Update | Add V2 runtime contract, mode switching, shadow mode |
| `TESTING.md` | Major update | Add V2 test matrix, fixture tests, perf benchmarks |
| `DEVELOPMENT.md` | Update | Add V2 dev setup, shadow mode usage, fixture capture workflow |
| `README.md` | Update | Version badge, feature list, new page coverage |
| `CHANGELOG.md` | 2 entries | 4.0.0 (V2) + 4.2.1 (V3) |
| `user-friendly-changelog.md` | 2 entries | User-facing descriptions for website |
| `PRIVACY.md` | Update (4.2.1 only) | OAuth data access, what's read, what's not stored |
| `CONTRIBUTING.md` | Update | How to add a new page type in V2 |

---

## 12. Website: Scroll-Based Mechanism Animation

> **Goal**: Create a premium, scroll-driven animation on the website that shows *exactly* how the extension works — slicing a real Classroom page into layers and revealing the injection process step by step.

### 12.1 Concept

A full-width section on the overview/landing page where:
1. A screenshot of Google Classroom is displayed
2. As the user scrolls, the page "slices" into horizontal segments
3. Each slice separates with a gap, and a connecting arrow/line draws out from the gap
4. Next to each arrow, a text block explains what the extension does at that point
5. The animation progresses through the full injection pipeline:
   - **Slice 1**: Post header → "CQD identifies every post on the page"
   - **Slice 2**: File attachment area → "Scans for downloadable files using smart selectors"
   - **Slice 3**: Download button injection point → "Injects download buttons with one-click access"
   - **Slice 4**: Comment/edited indicator area → "Detects comments and edit history"
   - **Slice 5**: Flag badge position → "Shows intelligent badges with confidence scoring"
   - **Slice 6**: Download All button → "Groups files per post for batch downloading"

### 12.2 Technical Approach

- **Trigger**: `IntersectionObserver` + CSS `scroll-timeline` (progressive enhancement) or JS scroll listener with `requestAnimationFrame`
- **Slicing**: Real screenshot chopped into 6 PNG strips, positioned in a CSS Grid/Flex column
- **Separation animation**: CSS `transform: translateY()` + `opacity` transitions triggered by scroll position
- **Connecting lines**: SVG `<path>` elements animated via `stroke-dashoffset` + `stroke-dasharray` on scroll
- **Text reveals**: Fade-in from the side (LTR: from right, RTL: from left) synced with line drawing
- **Performance**: Use `will-change: transform` on slices, `contain: layout` on container, passive scroll listeners
- **Mobile**: Stack vertically with simpler fade-in instead of slice separation (touch scroll is less precise)

### 12.3 Assets Needed

1. High-res Classroom screenshot (English) — capture fresh from test account
2. Same screenshot with CQD buttons/badges visible ("after" state overlay)
3. Arrow/connector SVG designs (styled to match website design system)
4. Copy for each slice explanation (concise, punchy, benefits-focused)

### 12.4 Design Principles

- Must feel premium and state-of-the-art — not a basic slideshow
- Smooth 60fps scrolling — no jank
- Dark mode compatible
- Responsive: desktop = horizontal slices with side annotations, mobile = vertical stack with bottom annotations
- Accessible: animation should be optional (`prefers-reduced-motion: reduce` → show static version)

---

## 13. Extension Popup Height Adjustment

The popup is currently `400px` tall (`extension/entrypoints/popup/App.css` line 71). Increase to `440px` to give more breathing room for:
- Future V2/V3 status indicators
- Mode selector (legacy/v2) for power users
- Slightly more comfortable spacing in the legends/feature list

**Changes:**
- `App.css`: `.popup-container` → `height: 440px`
- Verify all child layouts flex correctly at new height
- Test that popup doesn't get clipped on small screens (minimum Chrome popup constraint: 800×600 viewport)
- Ensure scroll behavior in feature sections still works

---

## 14. Pill & Changelog Page Styling

> These improvements will be done by the developer alongside the V2 engine work.

**Pill badges (extension content scripts):**
- Refine hover expansion animation (ease curve, duration)
- Improve dark mode contrast ratios
- Add subtle shadow/glow on hover for premium feel
- Ensure consistent sizing across all badge types (comment, edited, both)

**Changelog page (website):**
- Enhanced entry cards with version badges
- Better visual hierarchy between major and minor versions
- Improved search/filter UX
- Smooth scroll-reveal animations (already using IntersectionObserver pattern from previous work)

---

## 15. Test Suite & Verification

### 15.1 Unit Tests (New)

| Category | Tests | What They Cover |
|----------|-------|-----------------|
| Route classifier | 15+ | All URL patterns → correct `ViewKind`, edge cases (query params, fragments, authuser) |
| Selector scoring | 10+ | Priority chain returns correct anchor for each page type |
| Flag scoring | 20+ | Truth table: known inputs → expected scores, threshold behavior |
| Exclusion engine | 15+ | Each exclusion rule fires correctly, no false exclusions |
| Canonical ID | 10+ | Dedup, collision resistance, different URL formats → same ID |
| Decision trace | 5+ | Trace correctly records all evidence and final decision |

### 15.2 DOM Fixture Tests (New)

- Capture real Classroom HTML for each of the 8 page types
- Strip PII, store in `extension/tests/fixtures/classroom/`
- Fixtures for: English, Arabic (RTL), Japanese (CJK), Spanish
- Mutation chaos fixtures: simulate re-render, collapse/expand, infinite scroll
- Language variants: same post structure in 4+ languages

### 15.3 Integration Tests (New)

- Content ↔ background shadow diff flow
- V2 orchestrator lifecycle (init → navigate → abort → re-init)
- Legacy vs V2 parity on fixture DOMs
- Mode switching (legacy → shadow → v2 → legacy rollback)

### 15.4 E2E Tests (Playwright)

- Stream page: buttons appear on all file attachments
- Classwork page: buttons appear on expanded + collapsed posts
- Topic page: buttons appear on all visible posts
- Details page: buttons appear on all attachments
- Student submissions: buttons appear on student-uploaded files
- Multi-account: switching authuser doesn't break buttons
- Download flow: click button → file downloads → success state
- Flag accuracy: known commented/edited posts show correct badges

### 15.5 Performance Tests

- Mutation storm: 100 rapid DOM mutations in 500ms → all processed within budget
- Long page: 200+ posts → memory stays under 50MB extension heap
- Idle repair: repair pass completes within 25ms slices, doesn't jank scroll

### 15.6 Verification Commands

```bash
# Run all V2 unit tests
pnpm -C extension test -- --reporter=verbose tests/v2/

# Run fixture tests
pnpm -C extension test -- tests/v2/fixtures/

# Run shadow comparison (requires loaded extension on real Classroom)
# 1. Load extension in dev mode: pnpm -C extension dev
# 2. Navigate to Classroom pages
# 3. Open DevTools → Console → look for [CQD-V2-SHADOW] logs

# Run E2E tests
pnpm -C extension test:e2e

# Run performance benchmarks
pnpm -C extension test -- tests/v2/perf/

# Full validation (existing + V2)
pnpm -C extension test && pnpm -C extension test:coverage:all
```

### 15.7 Manual Testing Protocol (After each phase)

1. Load extension in dev mode (`pnpm -C extension dev`)
2. Open Google Classroom with test account
3. Visit each of the 8 page types
4. Verify: download buttons appear on every file attachment
5. Verify: no duplicate buttons
6. Verify: flags show on correct posts (use known test classroom)
7. Verify: "Download All" groups files correctly
8. Switch to RTL language → verify layout
9. Switch themes → verify styling
10. Switch accounts → verify authuser propagation
11. Save screenshots to `verification/post-phase-X/`
12. Compare with baseline screenshots

---

## 16. Rollout & Safety

### Mode System

```typescript
type V2Mode = 'legacy' | 'shadow' | 'v2';

// Storage key: cqdV2.mode
// Default: 'legacy' (no change for users)
// Shadow: V2 runs alongside legacy, logs diffs, doesn't render
// V2: V2 renders, legacy disabled
```

### Rollback

- Single storage flag flip: `cqdV2.mode = 'legacy'`
- Legacy entrypoints and styles remain intact for 2 stable releases
- Rollback telemetry: log mismatch rates before and after to validate rollback helped

### Promotion Criteria

| Metric | Gate |
|--------|------|
| Button coverage on golden pages | ≥ 99.5% |
| Zero duplicate button injections | = 0 |
| Comment flag precision | ≥ 99% |
| Comment flag recall | ≥ 97% |
| Edited flag precision | ≥ 98% |
| Edited flag recall | ≥ 95% |
| p95 mutation processing | ≤ 6ms |
| Initial page hydration | ≤ 120ms |
| Deep repair slice | ≤ 25ms |
| Total CPU per second (steady state) | ≤ 50ms/s |
| Memory per tab | ≤ 30MB heap |
| Button hover latency | 0ms (CSS-only) |
| No existing test regressions | All pass |

### Chrome Web Store Strategy

1. **4.0.0 (V2)**: Ship without new permissions → no re-review needed → fast publish
2. **4.2.1 (V3)**: Add `identity` permission → triggers store re-review
3. Keep API features behind flag until review approved
4. Prepare justification document for reviewer: why `identity` is needed, what data is accessed, what's NOT accessed

### Release Timeline

```
Phase 0-5  →  Extension 4.0.0 (V2, DOM-only)
                ├─ No new permissions
                ├─ New engine, unified flags, repair system
                ├─ Popup height 440px
                ├─ Performance optimizations across all interactions
                └─ All docs updated

Phase 7    →  Extension 4.2.1 (V3, API-enhanced)
                ├─ Adds `identity` permission + OAuth
                ├─ API-based file discovery + cross-validation
                ├─ Student submissions support
                └─ Privacy doc updated

Phase 8    →  Website animation update
                └─ Scroll-based mechanism explainer
```

---

## 17. Considered PRs & Optimizations

### 17.1 TreeWalker DOM Traversal Optimization (On-Hold PR)

**Status**: On hold — to be integrated during Phase 1

**What it does**: Replaces `cloneNode(true)` with direct `TreeWalker` approach in the detection layers. This eliminates O(N) memory allocation and CPU overhead of cloning the entire post element and pruning it, instead filtering nodes in real-time during traversal.

**Changes made by the PR:**
- Refactored `executeLayer4_NuclearScan` in `smart-detector-comments.ts` → `TreeWalker` with `NodeFilter.FILTER_REJECT` for exclusions
- Refactored `executeEditedLayer3` in `smart-detector.ts` → `TreeWalker` with equivalent filtering logic
- Removed the now unused `createSanitizedClone` helper function
- All 481 tests passed with no regression

**Why consider it**: This PR aligns perfectly with our performance goals in §9. The `cloneNode(true)` approach was the most expensive single operation in the detection pipeline — cloning a post element with 200+ descendants just to traverse it is wasteful. The TreeWalker approach is:
- **Zero memory allocation** — no clone, no pruning
- **Same accuracy** — `NodeFilter.FILTER_REJECT` skips excluded subtrees just like clone+prune did
- **Faster** — single pass traversal instead of clone + prune + traverse

**Integration plan**: Merge this PR's approach into the V2 detection engine at Phase 1. The V2 `flag-scoring.ts` will use TreeWalker natively from the start. For the legacy code path, apply the PR as-is to get immediate performance wins.

> [!NOTE]
> Review of `smart-detector-comments.ts` confirms the TreeWalker optimization is already partially applied in the current Layer 4 code (lines 442-511). The V2 engine should use this pattern consistently in ALL detection layers, not just Layer 4.

### 17.2 Additional Performance Optimizations to Consider

| Optimization | Impact | Phase |
|--------------|--------|-------|
| Single compiled exclusion regex (replace 14 individual pattern tests) | ~10x faster exclusion checking | Phase 1 |
| Visibility cache per scan pass (`Set<Element>` of hidden elements) | Avoids repeated `getComputedStyle` | Phase 2 |
| Button template cloning instead of per-element creation | ~3x faster button injection | Phase 3 |
| CSS-only hover states (remove all mouseenter/mouseleave JS for visual changes) | 0ms hover latency, fewer event listeners | Phase 3 |
| Delegated click handlers (one per post root instead of per button) | Fewer event listeners, better memory | Phase 3 |
| `DocumentFragment` batching for badge upgrades | Single reflow instead of multiple | Phase 4 |
| `IntersectionObserver` replacing scroll-based rescans | Better scroll performance, lazy injection | Phase 2 |
| Lazy keyword table loading (dynamic import by language) | Smaller initial bundle, less memory | Phase 4 |

---

## Success Criteria Summary

> Every downloadable file across every Google Classroom page has a download button. Comment/edited/both flags are accurate, deterministic, and debuggable. The system is fast (0ms hover, <6ms mutation processing, <120ms hydration, <30MB memory), self-repairing, and can be safely rolled back with a single flag flip. All changes are validated by automated tests and manual inspection before and after. The website showcases the extension's mechanism through a premium scroll-based animation. Extension ships as 4.0.0 (DOM-only) and 4.2.1 (API-enhanced).
