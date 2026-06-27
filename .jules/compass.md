
## 2023-10-28 — Added og:image absolute URL test
**Gap Found:** The `routes.render.test.ts` test did not assert that the `og:image` meta tag is an absolute URL, leading to potential silent SEO failures for social sharing.
**Tests Added/Improved:** `website/src/routes/routes.render.test.ts` now covers absolute `og:image` URL checking on standard pages like `FaqPage`.
**Learning:** We need to explicitly check that SEO meta properties are rendered as expected and are completely valid URLs (especially absolute ones), instead of just checking for existence.
