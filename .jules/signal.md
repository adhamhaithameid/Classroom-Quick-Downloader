
## 2025-02-12 — Added noindex to internal draft routes
**Finding:** The internal preview routes `/emails` and `/emails2` were accessible to crawlers and missing `noindex` directives, creating a risk of search engines indexing these draft pages.
**Action:** Added `noindex={true}` to the `<SeoMeta>` component in `website/src/routes/emails/+page.svelte` and `website/src/routes/emails2/+page.svelte`. Also added `Disallow: /emails` and `Disallow: /emails2` to `website/src/routes/robots.txt/+server.ts`.
**Learning:** For SvelteKit sites, utility/preview pages should explicitly declare `noindex={true}` via `<SeoMeta>` and be blocked via robots.txt to ensure they do not pollute search indexes.
