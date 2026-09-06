# Session Log — 2026-08-22: Engine & Detection Deep Read

## Goal

User request (verbatim intent): focus on the engines — how they operate, interact, detect, present — to enhance the whole experience and push detection toward 100% accuracy as the prerequisite for building more features. Read the extension code, understand the engines, and survey GitHub issues whose root cause lives in engine function.

This was a **research-only session**: no production code was changed.

## Method

1. `graphify query` against the existing knowledge graph (`graphify-out/graph.json`, 5,559 nodes) for the architecture map.
2. Two parallel explore agents:
   - Engines layer: `extension/src/engines/**` (types, registry, v1/v2/v3), orchestrator, mode-controller.
   - Detection pipeline: `src/detect/**`, `src/detection/**`, `entrypoints/content/**`, `src/v2/model|decision|repair|selectors`, plus tests in `extension/tests/detect/`.
3. GitHub issue review via `gh`: epic #685 + phases #673–#684, closed bug #664, survey bugs #537/#541/#546/#547, feature issues #614/#616, request #550.
4. Verified one contradiction by grep: default engine mode.

## Key findings

### Architecture
- Three engine generations coexist behind `CQDEngine` (`extension/src/engines/types.ts:272`): V1 legacy adapter (`engines/v1/engine-v1.ts`), V2 detection-only (`engines/v2/engine-v2.ts`), V3 stub (`engines/v3/engine-v3.ts`).
- `EngineMode = 'legacy'|'shadow'|'v2'|'v3'`; registry map at `engine-registry.ts:164`. Default is `'legacy'` (`mode-controller.ts:72`) — changed BACK from `'shadow'` in 2026-08 (comment at line 58). Stale docs claiming shadow-default: `v2_bootstrap.content.ts:62` comment and epic #685 body.
- V1 is a thin wrapper; real logic lives in self-starting content scripts (comment_frame, edited_frame, download_all, content/observers) with ~8+ MutationObservers and 4 heartbeats total.
- V2 computes PostNode/FileNode/FlagDecision/PlacementDecision + DecisionTrace every scan but **renders nothing** (`engine-v2.ts:384–386` "V2 is detection-only"). In pure `'v2'` mode no UI appears because V1 is not running either.
- `EngineEvent` bus vocabulary declared (`types.ts:338–344`) but emitted/consumed nowhere — Phase 1 of the refactor.
- V3 requires `identity` permission absent from manifest (`wxt.config.ts:34–38`); registry refuses it and falls back to shadow.
- Both engines converge on the shared background download pipeline (security gate → chrome.downloads → authuser cycling 0..9 → Drive bypass tab).

### Detection accuracy machinery
- Post identity: `[data-stream-item-id]` golden source + jscontroller ignore set (`post-card-utils.ts:26–30`).
- File identity: canonical-ID chain drive-id → URL /d/{id}/ → data-id+item-id → url-hash (`entities.ts:223–276`).
- Flags: 5-layer comment / 4-layer edited keyword scoring; thresholds 40/35/30, high-conf 70/65 (`decide/thresholds.ts:12–18`); 33-rule exclusion engine; language-free StructuralDetector cross-check; deep validator repairs model↔DOM drift with 3-strikes instability breaker.

### Concrete defects found (accuracy gaps)
1. Corrupted Armenian keywords (`detection-keywords.ts:431,524` contain literal `'delays'` fragments) — Armenian detection dead.
2. Word-number FP: `parseWordNumber` substring-matches `'un'` → any text containing "un…" parses as count 1.
3. ACTION_BUTTON_PATTERNS triplicated across exclusion-engine / keyword-scoring / smart-detector-comments — drift risk.
4. Count ceilings inconsistent: <1000 vs <10000 vs MAX_PLAUSIBLE_COUNT=100000.
5. L0 DOM-truth short-circuits everything on any numeral inside `.qCWAqb .huI6Cb`.
6. Substring keyword matching ('comment' ⊂ 'commentary'; generic Arabic classComment substring).
7. No Arabic diacritic (tashkeel) folding in normalization — why `ردّ`/`رد` both listed.
8. Pure `'v2'` mode renders zero UI.
9. Stale default-mode comments (bootstrap + epic).

### Issue-to-root-cause mapping
- #546 (Download All missing on assignment view): placement recipes per ViewKind + MIN_FILES_FOR_DOWNLOAD_ALL=2; assignment_details path fragile.
- #541 (filename corruption, Hungarian): `cleanAttachmentName` GARBAGE_LABELS list is English-centric; localized type labels get appended to filenames.
- #537/#547 (downloads always fail): Drive HTML interstitial/authuser handling; zen/Firefox-family browsers rely on bypass-tab path.
- #664 (closed): pendingByUrl race in background download handler.
- #616: replace polling/heartbeats with single MutationObserver — matches V2/orchestrator design, blocked on refactor.
- #614: scope detection to metadata zone — partially implemented via userContentExclusions/golden selectors; nuclear TreeWalker layer still scans wide.
- Epic #685 gate metrics: ≥99.5% coverage / 98% precision, 1 observer, 0 heartbeats — repo's own accuracy target is NOT 100%.

## Verification performed

- Grep-verified `DEFAULT_MODE = 'legacy'` at `mode-controller.ts:72` and stale comments elsewhere.
- All other claims carry file:line citations from the two explorer reports (spot-checked quotes consistent across both agents where they overlap: thresholds, golden selectors, canonical ID chain, render-disabled lines).

## Blast radius / risk of this session

None — read-only research plus this log file. No code, config, or git state touched. No beads filed yet; candidate next actions are listed below.

## Suggested next steps (not executed)

1. Phase 0 safety net (#673/#396, priority:urgent): freeze fixtures + V1 characterization tests BEFORE any engine change.
2. Quick wins independent of refactor: fix corrupted Armenian keywords, unify count ceilings, de-duplicate action-button patterns, fix stale default-mode comments, word-number FP guard.
3. Decide the accuracy contract honestly: repo gate is 99.5%/98%, not 100%; golden-fixture harness is how that gets measured.
