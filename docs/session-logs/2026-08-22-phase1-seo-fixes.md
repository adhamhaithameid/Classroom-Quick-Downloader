# Session Log — 2026-08-22 — Phase 1 + Phase 2 SEO (beads `-f3w`, `-0iy`, `-2xb`)

## What this session was

Continuation of the SEO audit session. The audit's Phase 1 (fully unblocked items) was approved
mid-session ("continue and do not stop until you finish"). Scope: SSR AnimatedNumber values,
`/changelog` heading order, `/watch/*` content depth. Phase 2 (long-form keyword pages) remains
**open and gated on the user's draft-vs-write decision**.

## Corrections to the prior audit report (verified against source)

1. **"Social proof reads 0 downloads/users" was a false positive.** Those slots are behind
   `{#if metricsReady}` and prerender `—` (`l2-metric-pending`). The "—" in the audit's own quote
   was that intentional fallback, not a bug.
2. **`overview-editor` duplication is moot for SEO** — it is noindexed (`noindex, nofollow`
   asserted in render test); robots.txt intentionally carries no Disallow so crawlers can read the
   noindex. The component fix covers it anyway.
3. **New finding: the animation itself was broken before this fix.** `onMount` assigned the final
   value to `displayValue` *before* the in-view observer fired, so `animateTo(value)` computed
   `delta = 0` → no-op. Users saw "0" until hydration, then an instant jump. The SSR fix and the
   animation fix are the same change.

## Changes (6 files modified, 1 created; +143/−16)

| File | Change |
|---|---|
| `website/src/lib/components/AnimatedNumber.svelte` | Default `displayValue` is now the final `value` (SSR/prerender emits real numbers for crawlers/no-JS). In `onMount`, animated instances reset to the animation start (`initialValue` if provided, else `0`) client-side, then animate on view. Non-animated and `stableInitial` behavior preserved byte-for-byte in output. |
| `website/src/lib/components/AnimatedNumber.ui.test.ts` (**new**) | 3 SSR assertions: final value renders (`>30<`), suffix renders (`>100+<`), `initialValue` overrides display. |
| `website/src/routes/changelog/+page.svelte` | Sidebar label `<h3 class="cl-sidebar-label">Versions</h3>` → `<h2>`; fixes h1→h3 skip. `.cl-sidebar-label` CSS sets margin/size/weight explicitly → zero visual drift. Hierarchy now h1 → h2 (label + versions) → h3 (sections). |
| `website/src/routes/watch/cqd-demo/+page.svelte` | ~67 → **351 visible words**: step-by-step demo walkthrough, time-cost framing, browser/account support, CTAs to install/guide pages. No fabricated transcript (videos are silent screen recordings). |
| `website/src/routes/watch/manual-vs-cqd/+page.svelte` | ~67 → **359 visible words**: manual pain breakdown, CQD contrast, what-to-watch-for list, honest "when manual still makes sense" section. |
| `website/src/routes/routes.render.test.ts` | New test: overview server-renders `30 files…`, `100+ Languages`, `over 100 more languages`, and NOT `uploads 0 files`. Changelog test: h2 label present, h3 label absent. Watch tests: ≥300-word floors + internal-link presence guards. |
| `website/package.json` | Registered `AnimatedNumber.ui.test.ts` in `test:ui` script. |

Both watch pages got matching scoped styles (h2/list/marker) consistent with existing design tokens.

## Verification (all commands run from `website/`)

- `pnpm run check` → **0 errors, 0 warnings** (after fixing 2 CSS-prune warnings by splitting a shared `ol, ul` rule per file)
- `pnpm test:ui` → 10/10 pass · `pnpm test:routes` → 21/21 pass
- `pnpm test` (full suite) → **993/993 pass across 31 files**
- `pnpm build` → success; audited actual prerendered HTML:
  - `build/overview.html`: `uploads <span class="animated-number …">30</span> files for one assignment`; `>100+</span> Languages`; `>100</span> more languages` ✅
  - `build/overview-editor.html`, `build/emails2.html` (renders `96+`): no residual `">0<"` animated values ✅
  - `build/changelog.html`: `<h2 class="cl-sidebar-label svelte-c3nf25">Versions</h2>` ✅
  - Word counts via tag-strip: cqd-demo 351 / manual-vs-cqd 359 ✅
  - All new internal link targets exist as built pages ✅

## Issues hit along the way (transparency)

1. **Self-inflicted parallel-edit race:** two simultaneous edits to the same file
   (`AnimatedNumber.svelte`) — the second write was based on pre-first-edit content and silently
   reverted the line-19 change while tests were red with pre-fix symptoms. Re-applied serially.
   Lesson applied: never batch multiple edits to one file.
2. **Stale-transform confusion:** after the changelog fix was on disk, a failing assertion made it
   look unfixed; root cause was my exact-match assertion not accounting for Svelte's injected scope
   class (`svelte-c3nf25`). Assertions loosened to prefix matches.
3. One nonsense ternary written into a test line was caught and removed immediately.
4. `bd update --claim` errored ("already claimed by agent") because `bd create -a agent`
   auto-claims — treated as claimed; bead closed at end.

## Impact / blast radius

- **Who's affected:** AI answer engines (GPTBot/ClaudeBot/PerplexityBot) now read real problem/
  reach numbers; Googlebot gets correct first-pass HTML; users regain an actual count-up animation
  (it was silently broken). No visual/layout changes anywhere (heading swap is style-neutral).
- **What could break:** any consumer relying on AnimatedNumber rendering `0` pre-hydration (none
  found; full suite green). Client flash pattern: prerendered value shows briefly before the
  client reset for above-fold animated numbers — standard tradeoff, all fixed-value instances are
  below-fold sections.
- **Rollback:** revert the 7 files (`git checkout -- <paths>`); single-component change means one
  file reverts the behavior everywhere.

## Open items

- **Phase 2 (largest ROI, needs user):** expand 15 keyword pages (~200w → 900–1200w) + FAQ blocks
  (`-0iy`). Awaiting decision: agent drafts for user edit, or user writes with agent on structure/schema.
- `-6dq` AggregateRating (needs real store numbers) · `-l8q` Bing token · `-qwj` IndexNow/GSC secrets
- Custom domain cutover + backlink plan (Phase 4)
- Working tree contains extensive **pre-existing drift** unrelated to this session (tracked by `-mml`);
  nothing committed or pushed this session, per policy.

---

# Phase 2 (same session, user authorized full autonomy)

## Architecture discovery

All 11 SEO pages are thin wrappers around `SeoContentPage.svelte` + a central
`src/lib/content/seoPages.ts` data module — so the entire build-out landed in two files
plus tests. No per-route page edits were needed.

## Changes

| File | Change |
|---|---|
| `website/src/lib/content/seoPages.ts` | Added `SeoFaq` type + optional `faqs?: SeoFaq[]`; made `paragraphs` optional on sections; rewrote all 11 page configs to long-form (~650–950 words each) with grounded steps, edge cases, honest caveats, and 4–5 FAQs per page. Comparison pages deliberately criteria-based — no fabricated competitor claims. |
| `website/src/lib/components/SeoContentPage.svelte` | FAQ section rendering (h2 → h3 questions, no heading skips) + `FAQPage` JSON-LD merged into existing structured-data array; guarded `{#each section.paragraphs ?? []}`. |
| `website/src/routes/routes.render.test.ts` | Imported the 8 previously-untested route wrappers; added table-driven depth floors (600–800 words) + FAQPage-schema assertion across all 11 pages. |

## Verification

- `pnpm run check` → 0 errors / 0 warnings · `pnpm test` → **994/994** · `pnpm build` ✓
- Built HTML audit: 936 / 948 / 769 / 829 / 800w (five core pages), 703 / 687 / 652w (installs),
  692 / 691 / 689w (compares) — **8,396 words total vs ~1,600 before**; FAQPage + Question entities
  present on all 11; every internal link target exists as a built page.
- Depth guard caught real shortfalls during development (751→expanded bulk page, 581→materials,
  467→firefox, 460→edge, etc.) — each was expanded with substantive content, never floor-lowered.

## Mistakes hit (transparency)

- Duplicate `paragraphs` key in one section object → svelte-check error; fixed by restructuring
  (paragraphs-before-bullets only). Took two rounds because I mis-reconstructed instead of reading
  the file first.
- Audit script false alarm: non-greedy `<article>` regex truncated at first nested card article,
  reporting ~90w pages that were actually fine. Corrected method confirmed real counts above.

## Beads closed

- `-f3w` Phase 1 fixes · `-0iy` per-page FAQ blocks + FAQPage schema · `-2xb` long-form expansion

## Still blocked on user/ops (not executable by agent)

- `-6dq` AggregateRating — needs real store rating + count
- `-l8q` Bing verification — needs token from Bing Webmaster portal (plumbing exists in config.ts)
- `-qwj` IndexNow/GSC secrets — plumbing exists (`PUBLIC_INDEXNOW_KEY`); actual values live in CI env
- Custom domain cutover + backlink plan (Phase 4); screenshots for guides are a user-side asset task
