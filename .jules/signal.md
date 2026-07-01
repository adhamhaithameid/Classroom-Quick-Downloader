## 2024-03-04 — Blocked internal/draft emails pages from being indexed
**Finding:** Internal draft pages `/emails` and `/emails2` lacked `noindex` directives and were missing from `robots.txt` Disallow list, risking accidental search engine discovery and duplicate content indexing.
**Action:** Added `noindex={true}` to the `<SeoMeta>` component in both `website/src/routes/emails/+page.svelte` and `website/src/routes/emails2/+page.svelte`. Also added `Disallow: /emails` and `Disallow: /emails2` to `website/src/routes/robots.txt/+server.ts`.
**Learning:** Always ensure that internal UI preview pages or drafts explicitly use `noindex={true}` and are added to `robots.txt` since crawler discovery might leak internal tools or hurt overall SEO scores via thin/duplicate content.
