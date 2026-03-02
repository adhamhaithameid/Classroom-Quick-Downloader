# Website Local Testing Guide

This guide explains how to run the user website locally with real API connections.

## 1) Install Workspace Dependencies

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm install
```

## 2) Start Oracle Backend (Terminal A)

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
export DO_SHARED_SECRET='dev-do-secret-strong'
export DASHBOARD_PASSWORD='dev-dashboard-strong'
export SUPER_ADMIN_PASSWORD='dev-super-strong'
export ARCHIVER_SHARED_SECRET='dev-archiver-strong'
export ORACLE_AUDIT_CHECKPOINT_SECRET='dev-audit-strong'
export ALLOW_LOOPBACK_BYPASS=true
export SESSION_COOKIE_SECURE=false
pnpm run dev:oracle
```

Open Oracle dashboard dev mode in browser:

- `http://127.0.0.1:8080`
- Login with `DASHBOARD_PASSWORD`.

## 3) Start Cloudflare Worker (Terminal B)

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm -C cloudflare-worker dev
```

## 4) Start Website Dev Server (Terminal C)

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
PUBLIC_ORACLE_API_BASE_URL=http://127.0.0.1:8080 \
pnpm -C website dev
```

## 5) Open the Website Manually

- Open `http://localhost:5173` in your browser.
- Open `http://localhost:4173` after running `pnpm -C website preview`.
- Optional Cloudflare Pages emulation: `pnpm -C website dev:pages` (after `pnpm -C website build`).

## 6) Verify Live Endpoints

```bash
curl http://127.0.0.1:8080/api/public/website/overview
curl http://127.0.0.1:8080/api/public/website/map
curl http://127.0.0.1:8080/api/public/website/changelog
curl http://127.0.0.1:8080/api/public/website/uninstall
# Optional (for Oracle cloudflare-pull scheduler/manual admin pull validation):
curl http://127.0.0.1:8787/public/site-metrics
```

Privacy page content is manual and local:
- Edit `website/src/lib/content/privacy.ts`.

## 7) Run Full Website Validation

```bash
pnpm -C website check
pnpm -C website test:unit
pnpm -C website test:integration
pnpm -C website test:acceptance
pnpm -C website test:component
pnpm -C website test:system
pnpm -C website build
```
