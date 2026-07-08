## 2026-07-08 — Internal email preview pages indexed
**Finding:** The internal email preview routes `/emails` and `/emails2` lack the `noindex={true}` tag in their `<SeoMeta>` component and are not blocked in `robots.txt`, risking accidental search engine indexing of internal advertisement mockups.
**Action:** Added `noindex={true}` to both pages' `<SeoMeta>` and added `Disallow: /emails` and `Disallow: /emails2` directives to `website/src/routes/robots.txt/+server.ts`.
**Learning:** Internal or draft routes (like email previews) must be explicitly disallowed in `robots.txt` and flagged with `noindex` metadata to prevent accidental search indexing.
