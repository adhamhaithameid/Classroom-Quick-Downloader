# Extension Core Strategy Snapshot — 2026-03-08

This note preserves the extension strategy discussion that led to `plan2.md`.
It is intentionally short, direct, and implementation-oriented so it can be
used later without searching chat history.

## What the repo scan showed

The project already has strong ideas for the extension core:

1. V2 orchestrator,
2. canonical DOM scanner,
3. selector scoring,
4. repair and performance budgeting,
5. shadow validation.

The problem is not lack of architecture. The problem is that the extension
still relies heavily on legacy runtime behavior in production-critical areas.

That means the biggest leverage is extension-core consolidation, not more
dashboard or website work.

## Main conclusions

### 1. The extension is the real bottleneck

The main user value is:

1. detect downloadable files correctly,
2. place controls correctly,
3. detect flags accurately,
4. avoid duplicates and false positives.

Everything else is secondary.

### 2. Smarter does not mean AI first

The better immediate path is:

1. better evidence modeling,
2. stronger exclusions,
3. clearer canonical IDs,
4. unified lifecycle,
5. decision tracing.

That is faster, safer, more debuggable, and more store-review-friendly than
adding vague AI logic to the extension runtime.

### 3. The biggest current functional gap is Student Work

The Student Work pages use Classroom viewer URLs instead of direct Drive URLs.
That means files can exist on the page while remaining invisible to the current
download engine.

Short-term fix:

1. network/viewer-based resolution.

Long-term fix:

1. optional Classroom API reconciliation behind a flag.

### 4. The best speed win is architectural

The repo already identifies the top optimization:

1. replace multiple observers and independent scanners with one orchestrator,
2. scan changed subtrees only,
3. keep a canonical post/file model,
4. use viewport-aware lazy work,
5. batch writes and keep hover CSS-only.

### 5. The best security win is restraint

The extension should remain least-privilege by default.

If more power is needed:

1. gate it,
2. document it,
3. make it optional,
4. degrade safely when unavailable.

## What to prioritize next

1. Phase 0 baseline capture and fixtures.
2. V2 shadow validation with reproducible evidence.
3. Student Work coverage.
4. Unified flag-scoring engine with decision traces.
5. V2 promotion after mismatch/coverage thresholds are met.

## Companion files

1. `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/plan2.md`
2. `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/refactor-plan.md`
3. `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/extension/docs/student-work-api-plan.md`
