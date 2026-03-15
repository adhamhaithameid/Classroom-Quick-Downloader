# Classroom Quick Downloader Website

Public multi-page SvelteKit website for Classroom Quick Downloader users.

This package is static (`@sveltejs/adapter-static`) and deploys to Cloudflare Pages.

## What This Website Includes

- Landing page (`/`) for users with live public metrics
- User changelog page (`/changelog`) from Oracle public API
- User privacy page (`/privacy`) from Oracle public API
- Uninstall feedback page (`/uninstall`) posting directly to Oracle
- Global map (`/map`) with country-level aggregate usage

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

## Runtime Environment Variables

- `PUBLIC_ORACLE_API_BASE_URL`: Oracle public API base URL
- `PUBLIC_SITE_URL`: canonical public website URL
- `PUBLIC_BASE_PATH`: keep empty for Cloudflare Pages root deployment
