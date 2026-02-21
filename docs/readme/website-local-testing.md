# Website Local Testing Guide

This guide explains exactly how to run and open the public website locally.

## From Repository Root

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm install
```

## Run Dev Server

```bash
pnpm -C website dev
```

Open in browser:

- `http://localhost:5173`

## Run Full Validation

```bash
pnpm -C website check
pnpm -C website test
pnpm -C website build
```

## Preview Production Build

```bash
pnpm -C website preview
```

Open in browser:

- `http://localhost:4173`

## Validate GitHub Pages Route Prefix

```bash
PUBLIC_BASE_PATH=/Classroom-Quick-Downloader pnpm -C website build
pnpm -C website preview
```

Then confirm these routes load correctly:

- `/Classroom-Quick-Downloader/`
- `/Classroom-Quick-Downloader/privacy`
- `/Classroom-Quick-Downloader/uninstall`
- `/Classroom-Quick-Downloader/map`
- `/Classroom-Quick-Downloader/changelog`
