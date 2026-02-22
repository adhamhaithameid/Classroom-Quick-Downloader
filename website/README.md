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

- Worker metrics refresh windows: `03:00`, `06:00`, `09:00`, `12:00`, `15:00`, `18:00`, `21:00`
- Oracle metrics window: `21:00` through `02:59`
- Primary Oracle refresh target hour: `01:00`

`Total Downloads` and map country counts follow the schedule above.

## Requirements

- Node.js 20+
- pnpm 10+
- Monorepo dependencies installed from repo root

## Quick Start (From Repo Root)

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm install
PUBLIC_ORACLE_API_BASE_URL=http://127.0.0.1:8080 PUBLIC_WORKER_BASE_URL=http://127.0.0.1:8787 pnpm -C website dev
```

Open:

- `http://localhost:5173`

## Local Validation Commands

```bash
pnpm -C website check
pnpm -C website test:unit
pnpm -C website test:integration
pnpm -C website test:acceptance
pnpm -C website test:component
pnpm -C website test:system
pnpm -C website build
pnpm -C website preview
```

Preview URL:

- `http://localhost:4173`

## Cloudflare Pages Deployment

Workflow file:

- `.github/workflows/website-deploy.yml`

Required GitHub repository configuration:

- Variable: `CLOUDFLARE_PAGES_PROJECT_NAME`
- Variable: `PUBLIC_ORACLE_API_BASE_URL`
- Variable: `PUBLIC_WORKER_BASE_URL`
- Variable: `PUBLIC_SITE_URL`
- Secret: `CLOUDFLARE_API_TOKEN`
- Secret: `CLOUDFLARE_ACCOUNT_ID`

## Runtime Environment Variables

- `PUBLIC_ORACLE_API_BASE_URL`: Oracle public API base URL
- `PUBLIC_WORKER_BASE_URL`: Cloudflare Worker base URL
- `PUBLIC_SITE_URL`: canonical public website URL
- `PUBLIC_BASE_PATH`: keep empty for Cloudflare Pages root deployment
