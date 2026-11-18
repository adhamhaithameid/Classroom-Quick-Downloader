# Manual QA sweep — 2026-11-15

Scope: baseline checks, real-browser website test (built-in browser, Chromium), simulator QA journeys (Chromium, Edge, Firefox).
Not covered: live Google Classroom (needs owner sign-in), Safari, Brave, Zen, Arc, real Windows/Linux.

## Baseline (all green)

| Check | Result |
|---|---|
| extension `compile` | exit 0 |
| extension `test` | 233 files, 4636 tests pass |
| extension `build` | exit 0 |
| website `build` | exit 0 (warnings below) |
| website `test` | 51 files, 1201 tests pass |
| website `check` (svelte-check) | 0 errors, 6 warnings |
| cloudflare-worker `test` | 41 files, 1156 tests pass |
| Chromium e2e (`extension-chromium`) | 22/22 pass |
| 23 sitemap routes | all 200; one h1, title, description, canonical OK |
| 26 internal links | 0 dead; unknown route returns 404 |
| mobile 375 px | no horizontal overflow |

## Defects found

| ID | Sev | Where | Finding |
|---|---|---|---|
| D1 | Medium | `website/src/lib/testimonials/data.ts` `mergeLiveTestimonials`, key in `TestimonialsSection.svelte:175` | Dedupe compares raw text. Baseline review text has `\n`, live text has a space, so the same review merges twice. Keyed each `name+date` then throws `each_key_duplicate` (`ANAS HANYApr 1, 2026`, indexes 1 and 22). Homepage console error; carousel update aborts. Shows only when live reviews load (dev yes, preview snapshot has 0 reviews). |
| D2 | Low | `website/src/lib/components/MediaLoader.svelte` else-branch | `type="video"` with `lazyVideo` renders `<img src="…mp4">` until armed. Browser fetches both videos at once (about 4.7 MB) so lazy load is defeated, and the `<img>` can fire `error`. |
| D3 | Low | dev only, `SeoMeta.svelte` | `hydration_html_changed` x6 on every page load. |
| D4 | Low | website build | Unused CSS selectors: `.ft-col-support` (SiteFooter), `.watch-checklist li` and `.watch-steps li` (watch pages). `gamification/+page.svelte:59` a11y warning: non-interactive element has tabindex. |
| D5 | Minor | homepage footer | "Built by Adham Haitham" link is 197x15 px: below the 24 px target size (WCAG 2.2 AA 2.5.8). |
| D6 | Medium | QA harness `launchQaContext` | `beforeAll` exceeds 60 s on cold start in about 1 of 3 runs. Seen in qa-01 and qa-02 (3 failures over 3 runs; each passes on retry). Then `afterAll` throws `closeQa is not a function`, which hides the cause. Also one run: `button.cqd-download-btn` not visible in 20 s. Matches reports #818 and #546 in shape (button missing) but unproven for users. |
| D7 | Low | QA harness | Edge leg fails 4 tests: `Microsoft Edge.app` not installed on this Mac. Harness then throws `Cannot read properties of undefined (reading 'close')` instead of an environment skip. |
| D8 | Known | Firefox QA | 18 of 21 journeys skip (unsigned extension); `simulator-sanity` fails (`context` undefined). This is the subject of open PRs #906 and #907 (draft). |

## Not reproduced / not testable here

- #878 (endless PDF `download1, download2…` on latest): simulator dedup tests pass. Needs real Classroom plus the reporter's browser.
- #822 (Firefox 158, extension absent): same cause class as D8. Needs signed Firefox build.
- #820, #537, #547: no steps or console data. Need reporters' diagnostics.
- Tracker items needing the owner: bead `hvty` (expired CWS token, production deploy).

## Verification

Commands run: pnpm compile, test, build, check; Playwright projects extension-chromium, qa-chromium (3 runs), extension-edge, qa-firefox; browser-pane crawl of sitemap and links. No source file changed. No bead changed. No git write.

## Fixes applied (uncommitted, website only)

| Bead | Change | Evidence |
|---|---|---|
| 9ltz | Whitespace-normalised dedupe in `data.ts`; each key is now the index | 2 new tests red then green; console error gone in dev |
| 429c | `MediaLoader` no longer renders `<img>` for unarmed lazy video | 3 new SSR tests |
| vsyk | `SITE_URL` no longer reads `window.location.origin` (server/client mismatch) | 1 new test; hydration warnings gone |
| ybp4 | Removed 3 unused selectors, `svelte-ignore` with reason on scroll region | svelte-check 0 warnings, build clean |
| d61j | `.ft-credit` `min-height: 24px` | CSS |
| zp3g | Footer wordmark: no per-dot `Math.hypot`, squared-distance rejects, dot sprite, pre-rendered rest frame, redraw only moved dots | CPU profile: `drawAll` 532 ms to 28 ms per 3 s hover; 5 guard tests |

Suites after: website 1212 tests pass, svelte-check 0 errors 0 warnings, build exit 0.

## Open items

1. Fix D1 with a test first (normalise whitespace in dedupe key; key by unique id).
2. Fix D2 (render `<video>` placeholder, not `<img>`).
3. Raise or fix `launchQaContext` cold start; make `afterAll` null-safe.
4. File beads for D1 to D7 (owner approval; Bead Me Up report after).
