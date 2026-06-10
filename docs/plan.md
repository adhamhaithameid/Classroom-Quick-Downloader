# Active Plan — Website Reviews Section (Oracle-Sourced, Browser-Aggregated)

Last updated: 2026-03-08

## Summary
Add a new **Reviews** section to the website overview page (directly under the Solution block) that shows real browser-store review data with:
- star rating,
- review text,
- reviewer first name,
- source browser (Chrome/Firefox/Edge).

Locked decisions:
- Source strategy: **Hybrid + fallback**.
- Plan file target: **this file (`plan.md`) is now the active plan source**.

## Implementation Changes

### 1) Oracle data pipeline (source of truth)
- Extend browser sync to collect review entries where available (Firefox/Edge APIs or parsable pages), and keep a fallback cache/manual source for gaps (especially Chrome text coverage).
- Persist normalized reviews in Oracle with dedupe key (`browser + externalReviewId/hash`).
- Add freshness metadata: `lastFetchedAtUtc`, `source`, `isFallback`, `stale`.
- Add public response contract for website reviews.
- Preferred: include reviews in canonical snapshot so website continues using one fetch path.

### 2) Public contract additions
- Add `reviews` object to website snapshot response:
  - `summary`: `totalReviews`, `averageRating`, `byBrowser` counts.
  - `items`: normalized review cards.
  - `meta`: `generatedAt`, `sourceCoverage`, `staleBrowsers`.
- Normalize each review item to:
  - `id`, `browser`, `stars`, `reviewText`, `reviewerFirstName`, `reviewedAtUtc`, `reviewUrl?`, `sourceType`.

### 3) Cloudflare edge passthrough/cache
- Ensure `/api/site/v1/snapshot` includes Oracle reviews payload unchanged.
- Keep existing cache/session-pinned snapshot behavior (no mid-session mutation).

### 4) Website UI (Overview page)
- Insert “Reviews” section in:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/routes/overview/+page.svelte`
- Placement: immediately below the Solution summary section.
- Required behavior:
  - collapsed by default,
  - bottom-to-top gradient opacity mask when collapsed,
  - smooth expand/collapse transition,
  - fixed-height container with internal scroll wheel,
  - on expand: show real review count and full list.
- Required styling:
  - own background section/card,
  - typography/colors/motion aligned with current Landing 2 design language,
  - browser badge per review,
  - star renderer consistent with current site components.
- Accessibility:
  - keyboard-toggleable collapse,
  - `aria-expanded` and `aria-controls` wiring,
  - explicit empty/degraded states.

### 5) Fallback and reliability rules
- If a browser source lacks review text, keep the browser in summary with `coverage=partial`.
- Never inject fabricated review text.
- Preserve last-good review set in snapshot generation until fresh data arrives.
- Show a coverage note only when partial/missing sources exist.

## Important API / Interface / Type Changes
- Update `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/types/public.ts` with:
  - `WebsiteReviewItem`
  - `WebsiteReviewsSummary`
  - `WebsiteReviewsPayload`
- Extend website snapshot type to include `reviews`.
- Extend Oracle public snapshot schema version (or add backward-compatible optional field with strict coercion defaults).
- Update normalization/coercion in:
  - `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/api/publicSite.ts`

## Test Cases and Scenarios

### Oracle tests
- Review ingestion normalization (first-name extraction, stars bounds, text sanitization).
- Deduplication/idempotency behavior.
- Partial-source handling and fallback marker correctness.
- Snapshot contract includes valid `reviews` payload.

### Cloudflare tests
- Snapshot passthrough preserves `reviews` payload.
- Cache envelope includes `reviews` and freshness metadata.
- No contract regression for existing fields.

### Website tests
- Collapsed-by-default rendering.
- Gradient mask appears only while collapsed.
- Expand reveals full count and list.
- Fixed-height + overflow scroll behavior.
- Empty/degraded states render correctly.
- No fake `0` placeholder flicker on first paint.

### UI/E2E
- Reviews section appears under Solution.
- Collapse/expand works via mouse + keyboard.
- Browser badge + stars + first name + text shown per row.
- Visual snapshots for collapsed and expanded states.

## Acceptance Criteria
- Reviews section is visible under Solution and matches site design language.
- Section starts collapsed with gradient fade, and expands smoothly.
- Expanded state shows real review count and scrollable review list.
- Data comes from Oracle snapshot pipeline, not hardcoded mock text.
- Partial browser coverage is handled transparently without fake values.

## Assumptions and Defaults
- “Pull from all browsers” means all three browsers appear in coverage/summary, with hybrid source + fallback if a store doesn’t reliably expose full review text.
- Website remains single-snapshot-driven and session-pinned (no manual refresh button, no mid-session metric mutation).
- No extension behavior changes are required for this reviews section.
