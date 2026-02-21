# Classroom Quick Downloader Website

Public, multi-page SvelteKit website for Classroom Quick Downloader.

This package is static (`@sveltejs/adapter-static`) and deploys to GitHub Pages.

## What This Website Includes

- Landing page (`/`) for users
- Privacy page (`/privacy`)
- Uninstall page (`/uninstall`)
- Global map page (`/map`) with country-level aggregation
- Changelog page (`/changelog`)

## Requirements

- Node.js 20+
- pnpm 10+
- Monorepo dependencies installed from repo root

## Quick Start (From Repo Root)

```bash
pnpm install
pnpm -C website dev
```

Then open:

- `http://localhost:5173`

## Manual Local Testing Commands

### 1) Typecheck

```bash
pnpm -C website check
```

### 2) Unit tests

```bash
pnpm -C website test:unit
```

### 3) Integration tests

```bash
pnpm -C website test:integration
```

### 4) Acceptance tests

```bash
pnpm -C website test:acceptance
```

### 5) Production build (default local base path)

```bash
pnpm -C website build
```

### 6) Preview production output

```bash
pnpm -C website preview
```

Then open:

- `http://localhost:4173`

## Testing GitHub Pages Base Path Locally

GitHub Pages serves this repo under:

- `/Classroom-Quick-Downloader`

To emulate this behavior locally during build:

```bash
PUBLIC_BASE_PATH=/Classroom-Quick-Downloader pnpm -C website build
pnpm -C website preview
```

## Runtime Environment Variables

- `PUBLIC_BASE_PATH`
  - Base path for SvelteKit routes/assets.
  - Empty in local dev.
  - Set to `/${REPO_NAME}` in GitHub Pages deploy.
- `PUBLIC_ORACLE_API_BASE_URL`
  - Oracle backend base URL for public website API.
  - Defaults to `http://localhost:8080` for local development.
- `PUBLIC_WORKER_BASE_URL`
  - Cloudflare Worker base URL for changelog feed.
- `PUBLIC_SITE_URL`
  - Canonical public site URL used for links.

## Notes

- This website intentionally consumes sanitized public endpoints.
- Country map is aggregate-only; no raw IP data is shown.
- `/changelog` is rendered directly from repository `CHANGELOG.md`.
- `/privacy` is rendered directly from repository `PRIVACY.md`.
