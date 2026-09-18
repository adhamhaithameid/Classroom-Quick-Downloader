# Website SEO & Typography Enhancements Plan

Destination: implement the 7 approved SEO/typography enhancements for `website/`
(S2, S3, T1, T2, T3, T4, S1 from the audit), batched into 4 tasks, each TDD'd.

## Global Constraints

- Only `website/` files may change. Never stage or commit pre-existing dirty
  files: `website/src/routes/overview-editor/+page.svelte` (has unrelated
  uncommitted work), `extension/*`, `workflows/*`, `.beads/*`.
- Do not push. Commit per task on the current branch with
  `fix(website): ...` / `feat(website): ...` messages.
- Plus Jakarta Sans stays the primary UI font (visual-guarded). Test updates
  that accompany an explicit, reviewed font-loading change are sanctioned.
- TDD: guard tests follow the repo's existing string-assertion style
  (`overview.visual-guard.test.ts`). Write/adjust test first, watch it fail,
  implement, watch it pass.
- No new dependencies. No design-system rewrite; refinement preserves the
  incumbent identity.
- Run `npm run test` (website dir) before reporting a task done; full suite at
  the end.

## Task 1: Font delivery overhaul (S2 + S3)

Files: `website/src/app.html`, `website/src/app.css`,
`website/src/routes/overview.visual-guard.test.ts`.

1. RED: update/extend `overview.visual-guard.test.ts`:
   - app.html must contain `preconnect` to `fonts.googleapis.com` and
     `fonts.gstatic.com`, and a stylesheet `link` whose href contains
     `Plus+Jakarta+Sans` with `display=swap`.
   - app.css must NOT contain `@import url('https://fonts.googleapis.com`.
   - app.css must declare a metric-adjusted fallback face
     (`Plus Jakarta Sans Fallback`) using `size-adjust`/`ascent-override`-style
     descriptors, and `--font-ui` must list `'Plus Jakarta Sans'` before
     `'Plus Jakarta Sans Fallback'`.
   - Existing assertions that must keep passing or be updated explicitly:
     `css` contains `Plus+Jakarta+Sans` (can remain satisfied via the fallback
     family name or be rewritten to the new invariants) and
     `--font-ui: 'Plus Jakarta Sans'`.
2. GREEN:
   - app.html: add `<link rel="preconnect" href="https://fonts.googleapis.com">`,
     `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
     and `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap">`
     (rel="preconnect"/dns-prefetch before the stylesheet so discovery starts
     at HTML parse on every route).
   - app.css: remove the `@import url('https://fonts.googleapis.com/...')`
     line; keep the visual-identity-guard comment (update wording to point at
     app.html). Add `@font-face` fallback family sized to Plus Jakarta Sans
     metrics (e.g. src: local('Arial') with size-adjust ~105%, ascent-override
     ~96%, descent-override ~26%, line-gap-override 0% — implementer verifies
     rough metric match) and extend `--font-ui`:
     `'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', -apple-system, ...`.
   - Do NOT touch `overview/+page.svelte` or `overview-editor/+page.svelte`
     (their duplicate same-URL stylesheet links are browser-deduped and the
     overview one is visual-guarded; overview-editor has unrelated uncommitted
     work).
3. Verify: run website vitest.

## Task 2: Restyle SeoContentPage to brand (T2)

Files: `website/src/lib/components/SeoContentPage.svelte` (+ test if adding).

1. RED: add a guard test (new `src/lib/components/SeoContentPage.guard.test.ts`
   or similar, vitest + `svelte/server` render like layout.shell.test.ts)
   asserting the rendered component/CSS uses the site tokens
   (`--gc-green`/`var(--green)` family, `var(--font-ui)`), and that off-brand
   hexes `#047857` and `#0f766e` are gone from the component.
2. GREEN: restyle ONLY the `<style>` block, preserving markup, copy, and
   structure:
   - Replace teal/slate palette with site green tokens (`--gc-green`,
     `--gc-green-dark`, `--gc-green-bg`) and neutral text tokens
     (`--text`, `--text-secondary`, `--muted`).
   - Type scale: h1 `clamp(2.1rem, 4.5vw, 3.4rem)`, weight 800,
     letter-spacing -0.03em, line-height 1.08; section h2 ~`clamp(1.35rem, 2.2vw, 1.6rem)`
     weight 800; FAQ h3 ~1.05rem weight 700; body 1rem/1.7 with `max-width: 70ch`;
     eyebrow keeps uppercase letterspaced treatment in green.
   - Cards: `var(--border-subtle)` borders, `var(--radius)` radii, soft shadow
     language matching `.card` in app.css; hero gradient from `--bg`/`--bg-deep`.
   - Buttons match site language (green primary like nav CTA, white secondary).
   - Add `text-wrap: balance` on h1/h2/h3 within this component only if global
     rule (Task 3) won't cover it — prefer relying on Task 3's global rule.
3. Verify: website vitest; run
   `node /Users/adhamhaithameid/.agents/skills/impeccable/scripts/detect.mjs --json src/lib/components/SeoContentPage.svelte`
   once and address Critical/Important findings.

## Task 3: Typography micro-pass (T1 + T3 + T4)

Files: `website/src/routes/+error.svelte`, `website/src/routes/privacy/+page.svelte`,
`website/src/routes/changelog/+page.svelte`, `website/src/routes/faq/+page.svelte`,
`website/src/routes/uninstall/+page.svelte`, `website/src/routes/overview/+page.svelte`,
`website/src/app.css`, `website/src/lib/components/AnimatedNumber.svelte`,
`website/src/lib/components/AnimatedNumericText.svelte`.

1. RED: add string-guard tests asserting:
   - No `font-weight: 9` (i.e. 900) remains in the listed route files
     (the font loads wght 200..800, so 900 silently clamps to 800).
   - app.css contains `text-wrap: balance` scoped to headings and
     `text-wrap: pretty` scoped to body copy.
   - `.metric-value` and both AnimatedNumber components use
     `font-variant-numeric: tabular-nums`.
2. GREEN:
   - Normalize `font-weight: 900` → `800` in the listed files. Skip
     `overview-editor/+page.svelte` (noindex tool page, dirty file).
   - app.css: `h1, h2, h3 { text-wrap: balance; }` and
     `p { text-wrap: pretty; }` (progressive enhancement; place near base
     styles with a one-line comment).
   - Add `font-variant-numeric: tabular-nums` to `.metric-value` and to the
     number-displaying elements of AnimatedNumber/AnimatedNumericText (check
     their existing styles; `.l2-gh-stat` already has it).
3. Verify: website vitest.

## Task 4: Security headers in Cloudflare worker (S1)

Files: `website/static/_worker.js`, plus new
`website/src/routes/worker.headers.guard.test.ts` (or similar) asserting the
worker source sets the headers.

1. RED: guard test asserting `_worker.js` response for normal asset fetches
   includes `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: strict-origin-when-cross-origin`,
   `Permissions-Policy` header.
2. GREEN: in `_worker.js`, wrap `env.ASSETS.fetch(request)` result and append
   headers on the returned Response (clone if needed). Keep redirects as-is
   (301/308 do not need the headers). No CSP (would break inline scripts).
3. Verify: website vitest; sanity-run `npx wrangler pages dev build` only if
   trivial, otherwise skip (headers are static strings).

## Final Verification

- `cd website && npm run test` full suite, `npm run check` (svelte-check).
- Whole-branch review dispatch (most capable model).
