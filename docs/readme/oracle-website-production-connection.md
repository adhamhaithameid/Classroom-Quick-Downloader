# Oracle + Worker + Website Production Connection (Manual Deploy Control)

This runbook keeps deployment under manual control for:
- Oracle backend + Oracle dashboard
- Cloudflare Worker + Cloudflare dashboard
- Svelte website on Cloudflare Pages

## 1) Deploy Oracle Backend + Oracle Dashboard (Manual)

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend

export DO_SHARED_SECRET='replace-with-strong-secret'
export DASHBOARD_PASSWORD='replace-with-strong-password'
export SUPER_ADMIN_PASSWORD='replace-with-strong-super-admin-password'
export ARCHIVER_SHARED_SECRET='replace-with-strong-archiver-secret'
export ORACLE_AUDIT_CHECKPOINT_SECRET='replace-with-strong-audit-secret'
export SESSION_COOKIE_SECURE=auto
export PUBLIC_WEBSITE_ALLOWED_ORIGINS='https://<your-root-domain>,https://classroom-quick-downloader-website.pages.dev,http://localhost:5173'
export CLOUDFLARE_PUBLIC_SITE_METRICS_URL='https://<worker-domain>/public/site-metrics'
export CLOUDFLARE_ANALYTICS_HOSTNAME='<your-root-domain>'

go run ./cmd/app
```

Oracle dashboard URL:
- `http://<oracle-host>:8080/`

New website sync Oracle admin APIs:
- `GET /api/admin/website/state`
- `POST /api/admin/website/force-push`
- `POST /api/admin/website/pull-cloudflare`
- `POST /api/admin/website/override`
- `POST /api/admin/website/one-am-toggle`

## 2) Deploy Cloudflare Worker + Cloudflare Dashboard (Manual)

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker
pnpm deploy
```

Cloudflare dashboard URL:
- `https://<worker-domain>/dashboard`

Website control APIs exposed by worker:
- `GET /admin/website/status`
- `POST /admin/website/flush-now`
- `POST /admin/website/override`
- `POST /admin/website/refresh-toggle`
- `GET /public/site-metrics`

## 3) Deploy Website to Cloudflare Pages (Manual)

Set repository vars/secrets once:
- `PUBLIC_ORACLE_API_BASE_URL=https://<oracle-domain>`
- `PUBLIC_WORKER_BASE_URL=https://<worker-domain>`
- `PUBLIC_SITE_URL=https://<your-root-domain>`
- `CLOUDFLARE_PAGES_PROJECT_NAME=<cloudflare-pages-project-name>`
- `CLOUDFLARE_API_TOKEN` (secret)
- `CLOUDFLARE_ACCOUNT_ID` (secret)

Cloudflare Pages domain strategy:
- attach your root custom domain as primary production domain
- keep `classroom-quick-downloader-website.pages.dev` enabled and redirect it to the root domain

### Option A: GitHub Actions Deploy
- Auto deploy runs on pushes to `main` that touch:
  - `website/**`
  - `CHANGELOG.md`
  - `PRIVACY.md`
  - `.github/workflows/website-deploy.yml`
- You can also trigger the same workflow manually with `workflow_dispatch` from GitHub Actions.

### Option B: Local Manual Deploy

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm install --frozen-lockfile
pnpm -C website build
pnpm -C website dev:pages
# or deploy directly:
# pnpm dlx wrangler pages deploy website/build --project-name <cloudflare-pages-project-name> --branch main
```

## 4) Scheduling Rules (UTC)

- Cloudflare Worker public website snapshot slots: `03:00`, `06:00`, `09:00`, `12:00`, `15:00`, `18:00`, `21:00`
- Website source policy:
  - Worker data outside Oracle window
  - Oracle data window: `21:00` to `02:59`
  - Oracle primary push: `01:00`

## 5) End-to-End Validation Checklist

```bash
curl https://<worker-domain>/public/site-metrics
curl https://<oracle-domain>/api/public/website/overview
curl https://<oracle-domain>/api/public/website/map
curl https://<oracle-domain>/api/public/website/changelog
curl https://<oracle-domain>/api/public/website/uninstall
```

Functional checks:
- Oracle dashboard `Website Sync` page shows:
  - last Oracle → Website batch
  - last Cloudflare → Website batch
  - last Website → Oracle batch
- Cloudflare dashboard `Data Hub` now includes website controls:
  - status refresh
  - flush now
  - refresh toggle
  - override save
- Website pages render live public data and uninstall submissions write into Oracle.

## 6) Verify Google Sheets Backup Pipeline

The Oracle backend writes backup metadata after a successful archive run.

### Trigger a manual backup run from Oracle dashboard
1. Open Oracle dashboard.
2. Go to the backup control section.
3. Run backup (step-up action required).

### Validate from API

```bash
# Requires authenticated dashboard session cookie in browser/curl context.
curl http://<oracle-host>:8080/api/admin/sheets/last-flush
```

Expected result:
- `ok: true`
- `record.status` should be `ok`
- `record.flushedAtUtc` should be a recent UTC timestamp
- `record.rowsFlushed` should be `>= 0`

If a run fails:
- check Oracle server logs for `sheets flush` errors
- verify `SHEETS_ID`, `GOOGLE_CREDS_PATH`, and service-account access to the target sheet
- verify Google Sheets API is enabled in the target Google Cloud project

## 7) Manual Deployment Commands (Copy/Paste)

### Oracle backend + dashboard

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend
go test ./...
go run ./cmd/app
```

### Cloudflare worker + dashboard

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker
pnpm test
pnpm deploy
```

### Website (Cloudflare Pages)

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm -C website test
pnpm -C website build
pnpm dlx wrangler pages deploy website/build \
  --project-name <cloudflare-pages-project-name> \
  --branch main
```
