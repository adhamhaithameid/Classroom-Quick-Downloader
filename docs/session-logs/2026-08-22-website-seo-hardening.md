# Website SEO Hardening — 2026-08-22

## Goal

Improve organic and AI-answer visibility for the CQD website so it ranks first
for brand queries ("classroom quick downloader") and problem queries
("download all google classroom attachments").

## Starting state

The site already had a mature SEO base: a shared `SeoMeta` component with
canonical + hreflang + Open Graph + Twitter cards, a prerendered
`sitemap.xml` with image and video extensions, `robots.txt`, Google Search
Console verification, IndexNow key route, breadcrumb + FAQPage + VideoObject +
SoftwareApplication JSON-LD, and 15 keyword-targeted landing pages.

Audit score before: **72/100**. The gaps were on-page and AI-visibility, not
infrastructure.

## Changes

### 1. AI crawler policy — `src/routes/robots.txt/+server.ts`

Added explicit `Allow: /` blocks for 14 answer-engine agents (GPTBot,
OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot,
anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended,
Applebot-Extended, DuckAssistBot, cohere-ai, Meta-ExternalAgent).

**Also removed every `Disallow` rule.** This is the non-obvious part. The old
file disallowed `/uninstall`, `/404`, `/overview-editor`, `/landing2` — all of
which *already* serve `<meta name="robots" content="noindex, nofollow">`.
Those two mechanisms conflict: a `Disallow` stops the crawler from fetching the
page, so it never reads the `noindex`, and the URL can still be indexed
bare (URL-only, no snippet). Crawl access **plus** `noindex` is the combination
that actually removes a page from the index. A comment in the file records why,
so nobody re-adds the rules.

### 2. `llms.txt` — new route `src/routes/llms.txt/+server.ts`

The emerging convention answer engines read for a clean, link-annotated site
summary. Generated from the same `seoPages` source as the sitemap so the two
cannot drift. Contains the product summary, key facts, store links, core pages,
guides, and comparisons.

### 3. Honest sitemap `lastmod` — `src/lib/seo/site.ts`, `src/routes/sitemap.xml/+server.ts`

The sitemap stamped `new Date()` on **every** URL on **every** build, so all 22
URLs claimed to change daily. Google discounts sitemaps that do this. Replaced
with a curated `SITE_PATH_LASTMOD` map plus `lastModForPath()`; dates were taken
from real `git log` commit dates per route.

### 4. Title and meta description optimization — `src/lib/content/seoPages.ts`, `src/routes/overview/+page.svelte`

Every one of the 16 pages was outside the useful SERP range.

- Titles: 5 pages were 68–71 chars (Google truncates past ~60); 6 pages were
  29–46 chars (wasted keyword space). All 16 now sit at 46–59 chars.
- Descriptions: all were 98–136 chars against a ~155-char display budget. All
  16 now sit at 146–153 chars, keyword-front-loaded, each ending on a concrete
  differentiator (free / open source / no account).
- Homepage title went from `Classroom Quick Downloader | Bulk Download Google
  Classroom Files` (65, truncated) to `Classroom Quick Downloader — Google
  Classroom Bulk Download` (59) — keeps brand name first for brand queries and
  keeps both head terms.

### 5. Internal link clusters — `src/lib/content/seoPages.ts`, `src/lib/components/SeoContentPage.svelte`

Biggest ranking gap. The 15 keyword pages linked only *outward* to the store
listings and `/faq` — no page linked to another, so each was effectively an
orphan and no link equity circulated.

Added a curated `RELATED_PATHS` map (topical clusters, not random links) and a
`relatedPagesFor()` helper. `SeoContentPage` now renders a "Related Guides"
section and emits matching `ItemList` JSON-LD. Every keyword page now has 3–4
inbound internal links.

### 6. `/emails2` de-indexed

`/emails` and `/emails2` are internal email previews that were fully indexable —
no `noindex`, not in robots, not in the sitemap. Added `noindex` to
`/emails2`. `/emails` needs nothing: `+page.server.ts` throws a 308 redirect, so
its page body never renders (I added a `noindex` there first, then reverted it
as dead code).

## Verification

```
pnpm run check      → 1027 files, 0 errors, 0 warnings
pnpm run test       → 30 files, 989 tests passed
pnpm run test:routes→ 2 files, 20 tests passed
pnpm run build      → built, prerendered
```

Build output spot-checked: `build/robots.txt` has the AI agent blocks and zero
`Disallow` lines; `build/llms.txt` (6.4 KB) generated; `build/sitemap.xml` shows
per-path real dates (`/privacy` 2026-03-04, `/faq` 2026-06-07, `/site-map`
2026-03-22); `build/emails2.html` carries `noindex, nofollow`;
`build/install/chrome.html` renders "Related Guides" plus `"@type":"ItemList"`.

## Test changes

Three assertions in `src/routes/routes.render.test.ts` were updated, not
weakened:

- 2× pinned homepage title → new title string.
- The robots block asserted the four `Disallow` lines. Replaced with
  `expect(robotsText).not.toContain('Disallow:')` plus three AI-agent
  assertions, and a comment explaining the noindex-vs-Disallow reasoning so the
  intent survives.

## Blast radius

- **What could break:** nothing functional. All changes are `<head>` metadata,
  two prerendered text routes, and one new visual section on the 15 SEO pages.
  The "Related Guides" block is the only visible UI change.
- **Who is affected:** search crawlers, AI answer engines, and anyone landing on
  a keyword page. No change to the extension, the worker, or the Oracle backend.
- **Ranking risk:** title/description rewrites reset CTR history for those
  pages. Expect 2–4 weeks of noise before the new versions settle. This is
  normal and the old titles were being truncated anyway.
- **Rollback:** `git checkout -- website/src` — everything is source-level, no
  migrations, no state.

## Not done — needs your input (filed as beads)

| ID | Item | Blocker |
|---|---|---|
| `-6dq` (P1) | `AggregateRating` on `SoftwareApplication` → star rich results | Needs the **real** store rating + review count. Fabricated review data risks a Google manual action. |
| `-0iy` (P2) | Per-page FAQ blocks + `FAQPage` schema on the 15 keyword pages | Needs factual Q&A written per page. |
| `-l8q` (P2) | Bing Webmaster verification | `PUBLIC_BING_SITE_VERIFICATION` is empty, so the `msvalidate.01` tag never renders. Bing's index backs ChatGPT search. |
| `-qwj` (P2) | Confirm `INDEXNOW_KEY` / GSC secrets are set | The deploy step exists and runs `tools/submit-search-indexing.mjs`, but `INDEXING_STRICT: "0"` means it cannot fail — if the secrets are unset it silently no-ops. |

Also noted but not filed: the homepage `<h1>` ("The free extension that
supercharges Google Classroom.") does not contain "download". Adding it would
help the head term, but the H1 is pinned by `overview.visual-guard.test.ts` and
is a brand/design call, not a mechanical fix.
