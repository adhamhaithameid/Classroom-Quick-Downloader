# Website Page Inventory

Last verified: **2026-09-12** · Site: `website/` (SvelteKit, static adapter, prerendered)

**Totals: 29 implemented pages · 22 publicly indexable · 4 server endpoints · 2 disabled routes.**
All 29 pages share the original ambient background rendered once by `AmbientBackground.svelte`
(mounted in `+layout.svelte`): the pastel 12-orb drifting field (`orb-drift`, no hue-cycle) over
the 60px vertical/horizontal grid lines at 0.05 opacity, plus the two soft `body::before/after`
washes in `app.css`. The floating entity layer lives only on `/`, `/overview`, and
`/overview-editor` (their editor-connected `l2-page-floats` layer). Motion is disabled under
`prefers-reduced-motion`.

## How this is generated / where to change things

- Pages live in `src/routes/**/+page.svelte` (SvelteKit file routing).
- The public sitemap is driven by `src/lib/seo/site.ts` (`CORE_INDEXABLE_PATHS`,
  `VIDEO_INDEXABLE_PATHS`) plus `src/lib/content/seoPages.ts` (`seoPages`).
- `sitemap.xml` and `robots.txt` are server routes, prerendered at build time.
- The build outputs static HTML to `build/` (`npm run build`).

## Implemented pages

| # | Route | Purpose | In sitemap.xml | Built snapshot |
|---|-------|---------|:---:|:---:|
| 1 | `/` | Home — renders the full product overview page (canonical home) | ✅ | prerendered |
| 2 | `/overview` | Product overview / feature tour (same component as `/`, noindex, canonical → `/`) | — | prerendered |
| 3 | `/overview-editor` | Internal editor for overview decorative placements (floats/doodles/3D) | — | prerendered |
| 4 | `/changelog` | Release changelog | ✅ | prerendered |
| 5 | `/faq` | FAQ | ✅ | prerendered |
| 6 | `/privacy` | Privacy policy | ✅ | prerendered |
| 7 | `/security` | Security info | ✅ | prerendered |
| 8 | `/support` | Support / contact info | ✅ | prerendered |
| 9 | `/press-kit` | Press kit | ✅ | prerendered |
| 10 | `/featured` | Featured / accolades page | ✅ | prerendered |
| 11 | `/site-map` | HTML sitemap (human-readable) | ✅ | prerendered |
| 12 | `/uninstall` | Uninstall guide | — (`noindex`) | prerendered |
| 13 | `/404` | Custom not-found page (doubles as the adapter-static SPA fallback `404.html`) | — | hydration shell |
| 14 | `/landing2` | Legacy landing → redirects to `/overview` | — (`noindex`) | prerendered |
| 15 | `/install/chrome` | Install guide — Chrome | ✅ | prerendered |
| 16 | `/install/edge` | Install guide — Edge | ✅ | prerendered |
| 17 | `/install/firefox` | Install guide — Firefox | ✅ | prerendered |
| 18 | `/download-all-attachments-google-classroom` | SEO landing — download all attachments | ✅ | prerendered |
| 19 | `/bulk-download-google-classroom-assignments` | SEO landing — bulk download assignments | ✅ | prerendered |
| 20 | `/download-google-classroom-materials-fast` | SEO landing — download materials fast | ✅ | prerendered |
| 21 | `/google-drive-cant-scan-virus-warning-download` | SEO landing — Drive "can't scan for viruses" workaround | ✅ | prerendered |
| 22 | `/google-workspace-school-accounts-support` | SEO landing — Workspace school account support | ✅ | prerendered |
| 23 | `/compare/classroom-quick-downloader-vs-classfetch` | Comparison — vs ClassFetch | ✅ | prerendered |
| 24 | `/compare/classroom-quick-downloader-vs-classmate` | Comparison — vs Classmate | ✅ | prerendered |
| 25 | `/compare/classroom-quick-downloader-vs-classroom-one-click-downloader` | Comparison — vs Classroom One-Click Downloader | ✅ | prerendered |
| 26 | `/watch/cqd-demo` | Video page — CQD demo (21s, video sitemap entry) | ✅ | prerendered |
| 27 | `/watch/manual-vs-cqd` | Video page — manual vs CQD (39s, video sitemap entry) | ✅ | prerendered |
| 28 | `/emails` | Internal email-template preview tool (has `+page.server.ts`) | — | hydration shell |
| 29 | `/emails2` | Internal email-template preview tool v2 | — | prerendered |

"Hydration shell" = the prerendered HTML is a minimal client-rendered shell (pre-existing
behavior, also true for the SPA fallback); the page — including the shared background — renders
at runtime.

## Server endpoints (not pages)

| Route | Purpose |
|-------|---------|
| `/robots.txt` | Robots directives + sitemap pointer |
| `/sitemap.xml` | Page sitemap (22 URLs, image + video extensions) |
| `/llms.txt` | LLM-friendly site summary |
| `/indexnow-key.txt` | IndexNow key file |

## Static verification files (in `static/`)

- `google6c935ceb19f9ff25.html`
- `googleqoyovUKFViRL3vVnI2gPpk0kl_4TiLEdj94Co1JdrvI.html`
- `googleztz5RVR7CeToYxt4nB4AEJMFmdD0LhgLHEjgvGFII-4.html`

Google Search Console verification files — accessible URLs, not pages.

## Disabled routes (not routable)

- `/overview2` — `src/routes/overview2/+page.svelte.disabled`
- `/samples` — `src/routes/samples/+page.svelte.disabled`

SvelteKit ignores `.disabled` files entirely; rename to `+page.svelte` to re-enable.

## Verification log — 2026-09-12

- **Test suite:** `npm test` → 31 files, **999/999 tests pass** (includes
  `routes.render.test.ts` rendering every page above, `layout.shell.test.ts`,
  `overview.visual-guard.test.ts`).
- **Production build:** `npm run build` → success; 29 page HTML files in `build/`;
  27 fully prerendered (all contain the shared `.bg-aurora` layer), 2 hydration shells
  (`404.html`, `emails.html`).
- **Live render check (dev server):** `/` (home/overview), `/privacy`, `/emails2` loaded in a
  real browser; aurora layer confirmed present and animating via computed styles
  (`aurora-hue` 40s, 6 orbs, `position: fixed`, `z-index: -1`, `pointer-events: none`);
  content verified intact on each page.
- **Unified background:** the aurora hue background was applied to all pages on 2026-09-12
  (bead `Classroom-Quick-Downloader-62q`); `.site-shell` and the overview/editor `.l2` roots are
  transparent so the fixed layer shows through on every route, and the page-scoped
  `.l2-page-orbs` fields join the same hue cycle.
- **Ambient architecture (2026-09-12):** the background was extracted into
  `src/lib/components/AmbientBackground.svelte`, and the glass design system moved to
  `src/lib/styles/glass.css` (`.glass-panel` / `.glass-hover` / `.glass-icon`), consumed by all
  card families. Placement SVGs resolve through the shared `resolvePlacementSvg` in
  `src/lib/svgCatalog/placements.ts`. Guarded by `style-consistency.guard.test.ts` and
  `overview.visual-guard.test.ts`.
- **Background restored to the deployed look (2026-09-12):** per user request the ambient layer
  went back to the original design from origin/main (`b7820fe7`): the pastel 12-orb drifting
  field + the 60px grid (0.05 opacity) shared by every page via `AmbientBackground.svelte`, the
  `body::before/after` washes restored in `app.css`, no hue-cycle, and the floating entities
  scoped back to the overview routes only.
