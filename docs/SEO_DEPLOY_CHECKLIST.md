# SEO Deploy Checklist (Website)

This file separates repository-implemented SEO work from manual operations that must be done in external platforms.

## Implemented In Repo

- Canonical and robots metadata via reusable `SeoMeta`:
  - `/overview`
  - `/privacy`
  - `/faq`
  - `/changelog`
  - `/uninstall` (`noindex`)
  - `/404` (`noindex`)
  - redirects (`/`, `/landing2`) marked `noindex` and canonicalized to `/overview`
- JSON-LD:
  - `SoftwareApplication` on `/overview`
  - `FAQPage` on `/faq`
- Crawl directives:
  - `website/src/routes/robots.txt/+server.ts` disallows `/uninstall` and `/404`
  - `website/src/routes/sitemap.xml/+server.ts` includes all indexable SEO pages
- Verification & indexing plumbing:
  - Google verification meta is emitted from `PUBLIC_GOOGLE_SITE_VERIFICATION` (with default fallback token)
  - Bing verification meta (`msvalidate.01`) is emitted from `PUBLIC_BING_SITE_VERIFICATION` when configured
  - `website/src/routes/indexnow-key.txt/+server.ts` serves the IndexNow key from `PUBLIC_INDEXNOW_KEY`
- New SEO-targeted routes added:
  - Use-case pages
  - Browser install pages
  - Trust pages (`/security`, `/support`, `/press-kit`)
  - Comparison pages
  - `/featured`
- Indexable changelog rendering improved:
  - changelog page now has server-rendered seeded manual entries before client refresh
- Credibility updates:
  - Added site-wide disclaimer: "Not affiliated with Google or Google Classroom."
  - Removed explicit open-source marketing claims from website copy where store/license mismatch could create trust issues
  - Marquee now avoids zero-social-proof display by falling back to trust copy when key counters are zero

## Automated After Deploy (When Configured)

- GitHub Actions workflow `.github/workflows/website-deploy.yml` now runs:
  - `node tools/submit-search-indexing.mjs`
- The script:
  - submits sitemap URLs to IndexNow engines (Bing plus other participating engines) when `INDEXNOW_KEY` is present
  - submits sitemap to Google Search Console API when `GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON` is present
  - prints a Brave Search manual submission URL reminder (`https://search.brave.com/submit-url`)
- Required indexing-related CI configuration:
  - secret: `INDEXNOW_KEY`
  - optional secret: `GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON`
  - optional variable: `GOOGLE_SEARCH_CONSOLE_SITE_URL` (defaults to `PUBLIC_SITE_URL/` when omitted)
  - optional variable: `PUBLIC_BING_SITE_VERIFICATION`
  - optional variable: `PUBLIC_GOOGLE_SITE_VERIFICATION`

## Manual External Actions (Still Required)

- Search Console:
  - Verify domain/property and grant the service account access if using automated submission
  - Monitor indexing and Core Web Vitals coverage
- Bing Webmaster Tools:
  - Verify domain/property (recommended for reporting and diagnostics)
- Domain strategy:
  - Decide if production canonical should stay `pages.dev` or move to custom domain
  - If custom domain is adopted, update canonical URLs and sitemap host accordingly
- Store/ASO alignment:
  - Align listing copy with website messaging (Chrome/Firefox/Edge)
  - Resolve and align license representation across store listings and repository
- Distribution/backlinks:
  - Outreach and external campaigns must be done manually

## Validation Commands

Run inside repository root:

```bash
pnpm -C website check
pnpm -C website test
pnpm -C website build
```

All three pass on the current `Not_Stable` state after these SEO changes.
