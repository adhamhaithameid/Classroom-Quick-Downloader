# SEO Weekly 10-Minute Maintenance Routine

Use this once per week (same day/time each week).

## 1) Performance Snapshot (3 minutes)
- Open Google Search Console -> `Performance` -> `Search results` -> `Last 7 days`.
- Record:
  - `Clicks`
  - `Impressions`
  - `Average CTR`
  - `Average position`
- Write top 5 queries by impressions.

## 2) Indexing Health (2 minutes)
- Open Google Search Console -> `Pages`.
- Check for new `Not indexed` reasons.
- For each new reason, classify:
  - `Expected` (for example `/uninstall`, `/404`)
  - `Unexpected` (needs fix)

## 3) Sitemap & Coverage (1 minute)
- Confirm sitemap is `Success` in:
  - Google Search Console
  - Bing Webmaster Tools
- Canonical sitemap URL:
  - `https://classroom-quick-downloader-website.pages.dev/sitemap.xml`

## 4) Critical URL Smoke Check (2 minutes)
- Open and visually verify:
  - `/overview`
  - `/privacy`
  - `/faq`
  - `/changelog`
- Confirm:
  - page loads correctly
  - no white screen
  - key content is visible
  - favicon is rendered in browser tab and metadata preview is healthy (title + description)

## 5) Content/Release Hygiene (2 minutes)
- If a release happened this week:
  - verify changelog page contains the release
  - verify release messaging matches extension/store copy
- If no release:
  - improve one FAQ answer using real query wording from Search Console

---

## Weekly Log Template (Copy/Paste)

```md
## SEO Weekly Log - YYYY-MM-DD

### Metrics (Last 7 Days)
- Clicks:
- Impressions:
- CTR:
- Avg position:

### Top Queries (Impressions)
1.
2.
3.
4.
5.

### Indexing Health
- New not-indexed reasons:
- Expected:
- Unexpected:

### Sitemap
- Google: Success / Issue
- Bing: Success / Issue

### Critical URL Smoke Check
- /overview: OK / Issue
- /privacy: OK / Issue
- /faq: OK / Issue
- /changelog: OK / Issue

### Actions
- Biggest issue found:
- Fix/task created:
- One optimization for next week:
```

## Guardrails
- Keep canonical host consistent: `classroom-quick-downloader-website.pages.dev`.
- Do not index utility pages (`/uninstall`, `/404`).
- Use exact user-language from real queries when updating FAQ/SEO pages.
- Re-run URL validation for homepage and one SEO landing page in Google Search Console after major metadata changes.
