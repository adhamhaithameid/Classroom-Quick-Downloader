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
  - `website/static/robots.txt` disallows `/uninstall` and `/404`
  - `website/static/sitemap.xml` created and includes all indexable SEO pages
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

## Manual External Actions (Required)

- Search Console:
  - Verify domain/property
  - Submit sitemap: `https://classroom-quick-downloader-website.pages.dev/sitemap.xml`
  - Monitor indexing and Core Web Vitals coverage
- Bing Webmaster Tools:
  - Verify domain/property
  - Submit same sitemap URL
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

