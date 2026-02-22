# Oracle + Worker + Website Production Connection

This is the production wiring for the public Svelte website using Oracle and Cloudflare Worker public APIs.

## 1) Deploy Oracle Backend

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/oracle-backend

export DO_SHARED_SECRET='replace-with-strong-secret'
export DASHBOARD_PASSWORD='replace-with-strong-password'
export SUPER_ADMIN_PASSWORD='replace-with-strong-super-admin-password'
export ARCHIVER_SHARED_SECRET='replace-with-strong-archiver-secret'
export ORACLE_AUDIT_CHECKPOINT_SECRET='replace-with-strong-audit-secret'
export SESSION_COOKIE_SECURE=true

go run ./cmd/app
```

## 2) Deploy Cloudflare Worker

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/cloudflare-worker
pnpm deploy
```

Ensure this endpoint responds:

- `https://<worker-domain>/public/site-metrics`

## 3) Configure Website Build Variables

Set GitHub repository variables:

- `PUBLIC_ORACLE_API_BASE_URL=https://<oracle-domain>`
- `PUBLIC_WORKER_BASE_URL=https://<worker-domain>`
- `PUBLIC_SITE_URL=https://<your-cloudflare-pages-domain>`
- `CLOUDFLARE_PAGES_PROJECT_NAME=<cloudflare-pages-project-name>`

Set Oracle runtime allowlist:

- `PUBLIC_WEBSITE_ALLOWED_ORIGINS=https://<your-cloudflare-pages-domain>,http://localhost:5173`

Set GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 4) Cloudflare Pages Deployment

Push to `main` and let workflow deploy:

- `.github/workflows/website-deploy.yml`

The workflow builds `website/` and deploys with `wrangler pages deploy`.

## 5) Source Scheduling Rules (UTC)

- Worker snapshots refresh at: `03:00`, `06:00`, `09:00`, `12:00`, `15:00`, `18:00`, `21:00`
- Website uses Oracle overview/map during: `21:00` to `02:59`
- Primary Oracle refresh target hour: `01:00`

## 6) Validate End-to-End

Open your Cloudflare Pages site and verify:

- Landing page loads total downloads
- Map page loads country-level counts
- Changelog and privacy pages load Oracle user content
- Uninstall page submits feedback to Oracle
