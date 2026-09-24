# Classroom Quick Downloader Website

Public multi-page SvelteKit website for Classroom Quick Downloader users.

This package is static (`@sveltejs/adapter-static`) and deploys to Cloudflare Pages.

## What This Website Includes

- Landing page (`/`) for users with live public metrics
- User changelog page (`/changelog`) from Oracle public API
- User privacy page (`/privacy`) from Oracle public API
- Uninstall feedback page (`/uninstall`) posting directly to Oracle
- Global map (`/map`) with country-level aggregate usage

## Magnetic CTA Micro-Interaction

Primary green CTAs subtly follow the cursor when it comes near, then glide
home (approved "Subtle" feel from `prototype-magnetic.html`: 70px attraction
radius, max 6px pull, near-critically damped spring, −2px hover lift while
engaged).

**Where the code lives**

- `src/lib/motion/magneticField.ts` — pure motion math + the locked feel
  constants (`MAGNETIC_DEFAULTS`, `HOVER_LIFT_PX`, `HOVER_SCALE`). This is
  the only place the feel is defined; tweak here, never per page.
- `src/lib/actions/magnetic.ts` — `use:magnetic` Svelte action. One shared
  passive `pointermove` listener for the whole page, cached rects, and a
  self-stopping rAF loop (zero idle cost, even when the cursor parks on a
  button).
- `src/app.css` — the `.magnetic-live` rule. While the spring drives a
  button it drops `transform` from the CSS transition list; without it the
  per-frame writes lag a frame behind.
- `prototype-magnetic.html` — the approved feel reference. A guard test
  keeps its numbers in sync with `MAGNETIC_DEFAULTS`.

**Scope rules (enforced by `src/lib/motion/magnetic.guard.test.ts`)**

- Wired only to green primary CTAs: overview hero + playful install buttons
  (and the editor copy), `SeoContentPage` primary (covers all guide pages),
  privacy, FAQ, uninstall (detected-browser reinstall + submit), 404, and
  error page CTAs.
- Never the navbar, never the footer, never secondary/ghost buttons. Adding
  `use:magnetic` anywhere else fails the guard suite.
- Conditional wiring is intentional: hero buttons pass
  `b === detectedBrowser`, uninstall reinstall passes `isDetected`, and the
  submit button passes `submitState !== 'sending'` so a disabled button
  never pulls.

**Behavior contract**

- Fully disabled unless `(pointer: fine)` and not
  `prefers-reduced-motion: reduce`; reacts live if the user changes either
  setting. CSS `:hover` states remain the fallback in those cases.
- While engaged the action owns the button's inline transform (including
  the −2px lift), so CSS `:hover` transforms are suppressed — the action
  reproduces them. On release the spring glides home, inline styles clear,
  and normal CSS hover resumes.
- Tests: `src/lib/motion/magneticField.test.ts` (math, 14 tests) and
  `src/lib/motion/magnetic.guard.test.ts` (scope/contract guards, 7 tests).

## Data Source Schedule (UTC)

- Oracle traffic sync from Cloudflare is scheduler-driven and configurable:
  - `ORACLE_WEBSITE_TRAFFIC_SYNC_ENABLED` (default `false`)
  - `ORACLE_WEBSITE_TRAFFIC_SYNC_INTERVAL_SECONDS` (default `3600`)
  - `ORACLE_WEBSITE_TRAFFIC_SYNC_LOOKBACK_HOURS` (default `48`)
- An immediate manual sync can be triggered from Oracle dashboard via `POST /api/admin/website/traffic/refresh` (step-up required).
- The website reads overview/map/changelog/uninstall data from Oracle public APIs.

## Requirements

- Node.js 20+
- pnpm 10+
- Monorepo dependencies installed from repo root

## Quick Start (From Repo Root)

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm install
PUBLIC_ORACLE_API_BASE_URL=http://127.0.0.1:8080 pnpm -C website dev
```

Open:

- `http://localhost:5173`

## Local Validation Commands

```bash
pnpm -C website check
pnpm -C website test:visual-guards
pnpm -C website test:unit
pnpm -C website test:integration
pnpm -C website test:acceptance
pnpm -C website test:component
pnpm -C website test:system
pnpm -C website build
pnpm -C website preview
```

## Visual Guardrails

The website has explicit visual guardrails to prevent accidental regressions in:

- primary font baseline (`Plus Jakarta Sans`)
- decorative floating + 3D placement layers on overview pages

See:

- `docs/VISUAL_GUARDRAILS.md`

Preview URL:

- `http://localhost:4173`
- `pnpm -C website dev:pages` can emulate the built output through Wrangler Pages locally.

## Cloudflare Pages Deployment

Workflow file:

- `.github/workflows/website-deploy.yml`

Required GitHub repository configuration:

- Variable: `CLOUDFLARE_PAGES_PROJECT_NAME`
- Variable: `PUBLIC_ORACLE_API_BASE_URL`
- Variable: `PUBLIC_SITE_URL`
- Secret: `CLOUDFLARE_API_TOKEN`
- Secret: `CLOUDFLARE_ACCOUNT_ID`

Optional for automated indexing:

- Secret: `INDEXNOW_KEY`
- Secret: `GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON`
- Variable: `GOOGLE_SEARCH_CONSOLE_SITE_URL`
- Variable: `PUBLIC_GOOGLE_SITE_VERIFICATION`
- Variable: `PUBLIC_BING_SITE_VERIFICATION`

## Runtime Environment Variables

- `PUBLIC_ORACLE_API_BASE_URL`: Oracle public API base URL
- `PUBLIC_SITE_URL`: canonical public website URL
- `PUBLIC_BASE_PATH`: keep empty for Cloudflare Pages root deployment
- `PUBLIC_GOOGLE_SITE_VERIFICATION` (optional): Google verification token for `<meta name="google-site-verification">`
- `PUBLIC_BING_SITE_VERIFICATION` (optional): Bing verification token for `<meta name="msvalidate.01">`
- `PUBLIC_INDEXNOW_KEY` (optional): key served at `/indexnow-key.txt` for IndexNow submissions
