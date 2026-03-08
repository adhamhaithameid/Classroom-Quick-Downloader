# Extension Plan 2 — Core Reliability, Performance, Security, and Smarter Detection

Last updated: 2026-03-08

## Purpose

This plan is the extension-only execution track for the CQD core product.
It focuses on:

1. extension-only priority work,
2. security hardening,
3. smarter download detection,
4. smarter flag detection.

This file is meant to be practical, not aspirational. The goal is to improve
the main user value of the extension: detecting downloadable files correctly,
injecting the right controls once, and surfacing comment/edited flags with
high confidence and low CPU cost.

## Current State Summary

The repo already contains a strong V2 architecture direction:

1. a shared orchestrator,
2. a canonical DOM scanner,
3. selector scoring,
4. a unified render pipeline,
5. repair and budget-control modules.

The main remaining problem is not lack of ideas. It is incomplete migration.
Legacy content scripts still carry real production behavior while V2 remains
partly validation-oriented and conservative.

That means the highest-value work is architectural consolidation around the
extension core, not more dashboard work.

---

## Track A — Extension-Only Priority Plan

### Goal

Make the extension reliable across all supported Classroom surfaces while
reducing DOM cost and making failures explainable.

### Priority Order

#### A1. Phase 0 baseline capture and fixture workflow

Deliverables:

1. reproducible snapshot capture,
2. sanitized fixture extraction,
3. selector catalog,
4. issue catalog,
5. test baseline.

Why first:

Without a baseline, every future selector or detection change becomes guesswork.

#### A2. Finish the V2 runtime migration

Target:

1. one orchestrator,
2. one lifecycle,
3. one mutation feed,
4. one canonical post/file model,
5. one shadow-validation path.

What to do:

1. move remaining legacy scan responsibilities behind V2-compatible modules,
2. stop maintaining duplicate behavior in multiple content scripts,
3. keep legacy mode as rollback only, not as the long-term normal path.

#### A3. Expand page coverage to all real download surfaces

Required surfaces:

1. stream,
2. classwork list,
3. topic classwork,
4. assignment details,
5. material details,
6. student submissions,
7. teacher student-work view,
8. announcement details.

Success criteria:

1. every downloadable file gets a control,
2. open-only resources are explicitly classified as non-downloadable,
3. unsupported resources are excluded deterministically.

#### A4. Make V2 the source of truth in shadow first, then primary

Rollout:

1. legacy default with V2 shadow evidence,
2. compare coverage and mismatch rate,
3. promote V2 to primary when coverage/precision thresholds are met,
4. keep legacy rollback available for two release cycles.

#### A5. Build a debugging surface for wrong decisions

Required output per post:

1. discovered files,
2. chosen placement target,
3. final flag verdict,
4. evidence sources,
5. exclusions applied,
6. fallback usage,
7. mismatch against legacy.

This must exist before broad rollout, otherwise every regression is expensive to explain.

---

## Track B — Security Hardening Plan

### Goal

Keep the extension secure by default while improving detection capability.

### Rules

#### B1. Prefer least-privilege permissions

1. do not add new permissions unless they unlock a measurable detection gap,
2. gate risky capabilities behind flags,
3. document the exact user-facing reason for every new permission.

#### B2. Validate download targets aggressively

For every derived download:

1. validate allowed host,
2. validate expected URL shape,
3. reject malformed redirect chains,
4. reject unsupported schemes,
5. reject ambiguous targets that cannot be tied to a canonical file identity.

#### B3. Keep API-assisted discovery opt-in until proven

If OAuth or API discovery is introduced later:

1. ship DOM-only first,
2. add explicit user consent UX,
3. degrade safely when auth is denied,
4. never break base downloads when API mode fails.

#### B4. Protect baseline and fixture data

1. no raw classroom HTML checked in without sanitization,
2. strip emails, names, IDs, image URLs, and auth hints,
3. mark all fixture files as processed artifacts only.

#### B5. Standardize extension-side security checks

Add or maintain tests for:

1. XSS prevention,
2. unsafe URL rejection,
3. state corruption fallback,
4. stale analytics replay prevention,
5. malformed message handling,
6. hostile DOM text injection edge cases.

#### B6. Treat DOM-derived evidence as untrusted

That means:

1. no blind use of visible text for navigation or privileged behavior,
2. no trust in arbitrary attributes unless they match expected patterns,
3. no feature state tied to mutable user content without exclusion rules.

---

## Track C — Smarter Download Detection Design

### Goal

Find more real files with fewer false positives and better resilience to Google Classroom DOM changes.

### Design

#### C1. Use a layered discovery model

Each file candidate should come from one or more of:

1. direct Drive/docs/sheets URL evidence,
2. stable data attributes,
3. semantic attachment structures,
4. Classroom viewer/network-derived metadata,
5. future Classroom API inventory.

Each candidate gets a confidence score and source list.

#### C2. Canonical file identity

Every file must resolve to a canonical ID using priority:

1. `data-drive-id`,
2. direct Drive file ID,
3. known docs/sheets/slides ID,
4. normalized viewer-derived file ID,
5. hashed normalized URL only as lowest-confidence fallback.

This is mandatory for dedupe and stable Download All grouping.

#### C3. Explicit file classification

Every discovered attachment should be classified as:

1. downloadable file,
2. open-only resource,
3. unsupported resource,
4. unknown candidate.

Examples:

1. Drive PDF/docx/pptx => downloadable,
2. Google Form => open-only,
3. embedded YouTube => open-only,
4. opaque Classroom tg viewer without resolved file ID => unknown until promoted by another evidence source.

#### C4. Student Work gap closure

Short term:

1. intercept the Classroom viewer/network path for student work,
2. extract real file identifiers from observed payloads,
3. map them into canonical download URLs.

Long term:

1. add Classroom API mode behind a flag,
2. cross-check DOM findings against API inventory,
3. reconcile mismatches instead of trusting either side blindly.

#### C5. Better placement strategy

Placement should be based on:

1. semantic attachment block,
2. stable header/footer anchor,
3. per-view placement recipes,
4. exclusion of action bars and menu containers,
5. confidence-weighted fallback targets.

This avoids accidentally attaching controls to the three-dots menu region or decorative wrappers.

#### C6. Performance rules for download detection

1. scan changed subtrees only,
2. skip unchanged posts using fingerprints,
3. use viewport-aware preloading on long pages,
4. batch DOM writes,
5. keep hover behavior CSS-only.

---

## Track D — Smarter Flag Detection Design

### Goal

Make comment/edited/both flags more accurate, explainable, and language-safe.

### Design

#### D1. Replace ad-hoc layered scripts with one evidence engine

The unified flag engine should score:

1. semantic labels and titles,
2. stable structural containers,
3. localized keywords,
4. date/timestamp containers,
5. text-tree evidence,
6. negative evidence and exclusions.

The result should be:

1. `none`,
2. `comment`,
3. `edited`,
4. `both`.

#### D2. Add a strong exclusion engine

The system must explicitly exclude:

1. add-comment buttons,
2. action menus,
3. hidden nodes,
4. editable areas,
5. text from adjacent posts,
6. show more/less toggles,
7. known non-content controls.

This is where many false positives come from today.

#### D3. Language-aware keyword loading

1. detect page language,
2. lazy-load only relevant keyword packs,
3. keep a fallback neutral pack,
4. audit edited/comment wording gaps for RTL and non-Latin locales.

#### D4. Decision trace per verdict

Each final flag decision should include:

1. evidence hits,
2. evidence weights,
3. exclusions triggered,
4. fallback used or not,
5. final confidence,
6. mismatch with legacy.

This is required for fast debugging.

#### D5. Confidence thresholds

Suggested thresholds:

1. high-confidence render immediately,
2. medium-confidence render only if corroborated by second evidence source,
3. low-confidence hold back unless deep validation confirms.

#### D6. Deep validation and repair

Idle-time repair should verify:

1. duplicate badges,
2. wrong badge placement,
3. missing overlays,
4. stale verdict attributes,
5. contradictory comment/edited states.

---

## Execution Sequence

### Phase 0

1. baseline capture,
2. fixture workflow,
3. selector catalog,
4. issue catalog,
5. extension test baseline.

### Phase 1

1. finish shared V2 lifecycle path,
2. unify observer ownership,
3. keep shadow mode safe.

### Phase 2

1. smarter download discovery,
2. student work coverage,
3. canonical file model hardening.

### Phase 3

1. unified flag scoring,
2. exclusion engine,
3. decision tracing.

### Phase 4

1. shadow validation,
2. metrics review,
3. V2 promotion,
4. rollback safety.

---

## Acceptance Criteria

The plan is successful when:

1. downloadable file coverage is near-complete on all supported surfaces,
2. student work no longer behaves like a blind spot,
3. duplicate or misplaced controls are effectively eliminated,
4. false-positive comment/edited flags are measurably reduced,
5. every wrong decision can be explained through a decision trace,
6. legacy mode becomes a rollback path, not the main implementation,
7. security posture stays least-privilege and validated.

---

## Not In Scope Yet

1. LLM or AI-powered DOM reasoning inside the extension runtime,
2. broad new permissions without evidence they are necessary,
3. website/dashboard work that does not improve the extension’s core download/flag behavior.

---

## Immediate Next Action

Implement Phase 0 completely and keep it reproducible:

1. capture live snapshots,
2. sanitize fixtures,
3. catalog selectors,
4. record known issues,
5. lock in a clean baseline before deeper V2 work.
