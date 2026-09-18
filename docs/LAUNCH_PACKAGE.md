# Launch & Distribution Package

Everything the website/extension cannot do by itself: search-engine
submission, distribution targets, community strategy, and launch timing.
Companion documents: `STORE_LISTINGS.md` (store metadata),
`SEO_DEPLOY_CHECKLIST.md` (repo-side SEO), `SEO_WEEKLY_MAINTENANCE.md` (ops
cadence).

## 1. What is already automated (verified 2026-09-12)

- **IndexNow** — the deploy workflow (`.github/workflows/website-deploy.yml`,
  final step "Submit indexing notifications") runs
  `node tools/submit-search-indexing.mjs` after every push to `main`. The tool:
  - parses all URLs from the live `sitemap.xml` (canonical URLs only),
  - POSTs them to Bing's IndexNow endpoint **and** every engine registered in
    the indexnow.org registry (Seznam, Yandex, Naver, …),
  - authenticates with the `INDEXNOW_KEY` secret and points
    `keyLocation` at `https://classroom-quick-downloader.adhamhaithameid.is-a.dev/indexnow-key.txt`
    (verified live, HTTP 200, key served),
  - supports `DRY_RUN=1` and `INDEXING_STRICT` modes, and never submits
    legacy `pages.dev` URLs because they are not in the sitemap.
- **Google Search Console** — the same workflow submits the sitemap via a
  service account (`GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON` secret), when
  configured.

## 2. Manual: Google Search Console

Run once after the September 2026 accuracy pass deploys (bylines, corrected
copy, expanded /security, new FAQ content):

1. Confirm the canonical domain property
   (`https://classroom-quick-downloader.adhamhaithameid.is-a.dev/`) is verified
   — verification meta is already emitted site-wide.
2. Sitemaps → confirm `sitemap.xml` shows "Success" with 22 discovered URLs.
3. URL Inspection → request indexing for: `/`, `/security`,
   `/download-all-attachments-google-classroom`, `/privacy`,
   `/install/chrome`, `/faq` (the accuracy pass changed visible content on
   these — indexed copies are stale until recrawled).
4. Enhancements → watch Breadcrumbs, FAQ, and Video reports for the new
   TechArticle/FAQPage/VideoObject markup.
5. Weekly: Performance (queries driving impressions), Pages (indexing
   coverage), Core Web Vitals.

## 3. Manual: Bing Webmaster Tools

1. Verify the site (import from Google Search Console is fastest).
2. Submit `sitemap.xml`.
3. IndexNow → verify the key file URL validates and recent submissions from
   the deploy workflow appear.
4. Check crawl errors after the next deploy.

## 4. Manual: verify IndexNow by hand

```bash
curl https://classroom-quick-downloader.adhamhaithameid.is-a.dev/indexnow-key.txt
DRY_RUN=1 INDEXNOW_KEY=<key> node tools/submit-search-indexing.mjs   # preview payload
```

A real submission returns 200/202; re-submitting the same URLs is safe
(IndexNow dedupes). Do not invent keys — the key lives only in GitHub secrets
and the Pages environment.

## 5. Directory targets (quality over quantity)

Only submit where a real listing is welcome; use the canonical description
from `STORE_LISTINGS.md` verbatim and never mass-submit.

| Target | Why | Priority |
| --- | --- | --- |
| Chrome Web Store / Edge Add-ons / AMO | primary discovery surfaces | done (listings exist) — refresh metadata at v1.6.0 |
| AlternativeTo | "alternative to Classroom's built-in flow" discovery | P2 |
| Product Hunt | launch-day visibility; wait for v1.6.0 story | P2 (at launch) |
| Education-technology directories (e.g. edtech tool roundups accepting submissions) | teacher-facing discovery | P2, one at a time |
| GitHub Topics refresh | user-intent topics over infra topics | P1, manual: `google-classroom`, `google-classroom-download`, `download-attachments`, `students`, `education`, `browser-extension`, `chrome-extension`, `firefox-extension` (drop `durable-objects`, `oracle-cloud`, `distributed-systems` from public-facing intent) |

## 6. Community targets (answer-first, never spam)

Where the problem is genuinely discussed — always lead with the answer, and
mention CQD only when it is the honest recommendation. Follow each
community's self-promotion rules; one helpful appearance beats ten link drops.

- **r/googleclassroom, r/Teachers, r/edtech** — recurring "how do I download
  all files/attachments" questions; answer with the manual method first, then
  CQD as the bulk option.
- **r/chrome_extensions, r/firefox** — extension-showcase communities; the
  privacy/permission story is the angle.
- **Teacher-facing Discords/Facebook groups for Google Classroom** — share the
  flagship guide (not the store link) when someone asks.
- **GitHub** — issues and discussions are support surface; link the site's
  `/support` page in responses.

## 7. Content strategy

- The flagship guide
  (`/download-all-attachments-google-classroom`) is the canonical
  answer-first asset: it opens with the direct answer, then steps, edge cases,
  and FAQs. Point community answers at it.
- Secondary assets: Drive virus-warning fix, Workspace/IT guidance, the two
  demo videos. Video pages carry VideoObject schema.
- Do not generate thin keyword pages or per-browser duplicates; the
  use-case/install/comparison set is complete.

## 8. Launch timing

**Do not do a promotional push for 1.5.5** (a packaging-lean release with no
user-facing story). Stage the launch around **v1.6.0**:

1. Ship the release: extension stores + GitHub release + changelog.
2. Refresh store listings per `STORE_LISTINGS.md`.
3. Website changelog + homepage version bump happen automatically from the
   generated content.
4. Then: Product Hunt post, one round of community shares (spread over days,
   not hours), directory submissions.
5. Coordinate the analytics contract update (see backlog) before the launch so
   funnel data (guide CTA clicks, FAQ engagement) is measurable from day one.

## 9. Measurement

- Search: GSC queries/impressions; Bing equivalent.
- Funnel (once the extended event whitelist ships to worker + Oracle):
  `guide_cta_click` → install intent from guides, `faq_expand` → question
  demand, `guide_engaged` → content depth engagement. All aggregate-only,
  no PII, consistent with the published privacy model.
- AI visibility: monthly spot-check of the Phase-8 query set
  ("download all Google Classroom attachments", "is Classroom Quick Downloader
  safe", …) across Google AI Overviews, ChatGPT, and Perplexity; track
  citation rate over time rather than single answers.

## 10. Executable v1.6.0 checklist

### MUST happen before v1.6.0

- [ ] Oracle VM recovered and Worker 429 (error 1027) mitigated — `ORACLE_RECOVERY_RUNBOOK.md`
- [ ] Analytics contract deployed to Oracle + Worker + Website **together** — `RELEASE_SEQUENCE_V160.md`
  (run `node tools/verify-analytics-contract.mjs` in preflight)
- [ ] Extension v1.6.0 passes the Manual-QA replay suite + `EXTENSION_TESTING_RUNBOOK.md`
- [ ] Website accuracy/copy pass (license claims, permissions, bylines) deployed
- [ ] Store listings refreshed per `STORE_LISTINGS.md` at the release

### SHOULD happen during launch week

- [ ] GSC: URL-inspection requests for the pages whose copy changed
- [ ] GitHub release + changelog published with the v1.6.0 tag
- [ ] Product Hunt post (one, well-made, at launch)
- [ ] One round of community answers using the flagship guide — spread over days
- [ ] AlternativeTo listing created

### Can happen after launch

- [ ] Weekly GSC/Bing review (see `SEO_WEEKLY_MAINTENANCE.md`)
- [ ] Monthly AI-visibility spot-checks (section 9)
- [ ] Remaining directory submissions, one at a time
- [ ] Iterate content based on `faq_expand` / `guide_engaged` funnel data

### Optional experiments

- [ ] Homepage title keyword-first A/B (backlog P3)
- [ ] Homepage compact trust strip (backlog P2)
- [ ] Firefox/Edge install-guide internal links (backlog P2)
