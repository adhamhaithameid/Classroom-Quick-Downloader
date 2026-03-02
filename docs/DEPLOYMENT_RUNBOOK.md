# CQD Deployment Runbook

This runbook is the single source of truth for deploying all production systems:

- Oracle Dashboard + API (`oracle-backend`)
- Cloudflare Worker Dashboard + DO (`cloudflare-worker`)
- Public Website (`website`, Cloudflare Pages)

Use this document for both:

1. one-time setup
2. daily/manual deployments

Related operator documents:

- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_DEPLOYMENT.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_INCIDENT_RESPONSE.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DATA_FLOW_WORKER_ORACLE_WEBSITE.md`

## 1) Production Architecture

- Oracle VM runs Docker container `cqd-oracle-backend` on port `8080`.
- Cloudflare Worker (`cqd-analytics`) receives extension traffic and serves worker dashboard.
- Website is static Svelte build deployed to Cloudflare Pages.
- Website reads canonical data directly from Oracle public routes:
  - `/api/public/website/snapshot` (primary)
  - compatibility endpoints `/api/public/website/*`
- Website writes telemetry to:
  - `/api/public/website/events` (Worker edge ingest -> DO queue -> Oracle internal batch flush)

## 2) Required Accounts and Access

- GitHub repo admin (to set Actions secrets/variables)
- Cloudflare account access (Workers + Pages)
- SSH access to Oracle VM

## 3) One-Time Setup (Must Be Done Once)

### 3.1 GitHub Actions secrets

In GitHub repo:
`Settings -> Secrets and variables -> Actions -> Secrets`

Create:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `ORACLE_HOST` (example: `<oracle-host>`)
- `ORACLE_SSH_KEY` (full private key content)

Note:
- The Oracle deploy workflow currently uses username `ubuntu` by default.
- If your server user is different, update `/.github/workflows/oracle-dashboard-deploy.yml`.

CLI alternative (recommended if you are already logged in with `gh auth login`):

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo adhamhaithameid/Classroom-Quick-Downloader
gh secret set CLOUDFLARE_ACCOUNT_ID --repo adhamhaithameid/Classroom-Quick-Downloader
gh secret set ORACLE_HOST --repo adhamhaithameid/Classroom-Quick-Downloader
gh secret set ORACLE_SSH_KEY --repo adhamhaithameid/Classroom-Quick-Downloader < ~/.ssh/oracle_key
```

### 3.2 GitHub Actions variables

In GitHub repo:
`Settings -> Secrets and variables -> Actions -> Variables`

Create:

- `CLOUDFLARE_PAGES_PROJECT_NAME=classroom-quick-downloader-website`
- `PUBLIC_SITE_URL=https://<your-root-domain>`
- `PUBLIC_ORACLE_API_BASE_URL=https://<your-oracle-public-https-domain>`
- `PUBLIC_WORKER_BASE_URL=https://cqd-analytics.adhamhaithameid.workers.dev`

Important:
- `PUBLIC_ORACLE_API_BASE_URL` must point to Oracle public HTTPS endpoint (not Worker).
- `PUBLIC_WORKER_BASE_URL` must point to Worker HTTPS endpoint.
- `PUBLIC_ORACLE_API_BASE_URL` and `PUBLIC_WORKER_BASE_URL` must be different.

CLI alternative:

```bash
gh variable set CLOUDFLARE_PAGES_PROJECT_NAME --repo adhamhaithameid/Classroom-Quick-Downloader --body 'classroom-quick-downloader-website'
gh variable set PUBLIC_SITE_URL --repo adhamhaithameid/Classroom-Quick-Downloader --body 'https://<your-root-domain>'
gh variable set PUBLIC_ORACLE_API_BASE_URL --repo adhamhaithameid/Classroom-Quick-Downloader --body 'https://<your-oracle-public-https-domain>'
gh variable set PUBLIC_WORKER_BASE_URL --repo adhamhaithameid/Classroom-Quick-Downloader --body 'https://cqd-analytics.adhamhaithameid.workers.dev'
```

### 3.3 Oracle server `.env.production`

On Oracle VM:

```bash
ORACLE_HOST="<oracle-host>"
ssh -i ~/.ssh/oracle_key "ubuntu@${ORACLE_HOST}"
cd ~/Classroom-Quick-Downloader/oracle-backend
```

Ensure `.env.production` exists and contains required values:

```env
APP_ENV=production
ADDR=:8080
DB_PATH=/data/analytics.db
STATIC_DIR=/app/static

DO_SHARED_SECRET=<set>
DASHBOARD_PASSWORD=<set>
SUPER_ADMIN_PASSWORD=<set>
DANGER_PASSWORD=<optional_or_same_as_super_admin>
ARCHIVER_SHARED_SECRET=<set>
ORACLE_AUDIT_CHECKPOINT_SECRET=<set>

SESSION_COOKIE_SECURE=false

PUBLIC_WEBSITE_ALLOWED_ORIGINS=https://<your-root-domain>,https://classroom-quick-downloader-website.pages.dev,https://not-stable.classroom-quick-downloader-website.pages.dev,https://classroom-quick-downloader.pages.dev,https://adhamhaithameid.github.io,http://localhost:5173,http://127.0.0.1:5173
CLOUDFLARE_PUBLIC_SITE_METRICS_URL=https://cqd-analytics.adhamhaithameid.workers.dev/public/site-metrics
CLOUDFLARE_ANALYTICS_API_TOKEN=<set>
CLOUDFLARE_ANALYTICS_ACCOUNT_TAG=<set>
CLOUDFLARE_ANALYTICS_HOSTNAME=<your-root-domain>
ORACLE_WEBSITE_TRAFFIC_SYNC_ENABLED=false
ORACLE_WEBSITE_TRAFFIC_SYNC_INTERVAL_SECONDS=3600
ORACLE_WEBSITE_TRAFFIC_SYNC_LOOKBACK_HOURS=48
ORACLE_DEPLOYMENTS_AUTO_SYNC_ENABLED=true
ORACLE_DEPLOYMENTS_AUTO_SYNC_INTERVAL_SECONDS=900

SHEETS_ID=<google-sheet-id>
GOOGLE_CREDS_PATH=/run/secrets/google-credentials.json
GOOGLE_CREDS_PATH_HOST=/home/ubuntu/.config/cqd/google-credentials.json
ARCHIVER_API_URL=http://127.0.0.1:8080/api/stats/summary
```

Then sync:

```bash
cp .env.production .env
chmod 600 .env.production .env
```

### 3.4 Google Sheets credentials file (for backups)

If backup-to-sheets is required, place credentials on Oracle VM:

```bash
mkdir -p ~/.config/cqd
chmod 700 ~/.config/cqd
```

Upload your credentials file as:

`/home/ubuntu/.config/cqd/google-credentials.json`

and set:

```bash
chmod 600 ~/.config/cqd/google-credentials.json
```

Without this file, daily Sheets export will not work.

## 4) Cloudflare Pages Setup (Dashboard UI, Step by Step)

If project does not exist yet:

1. Open Cloudflare Dashboard.
2. Go to `Workers & Pages`.
3. Click `Create application`.
4. Select `Pages`.
5. Choose `Direct Upload` (or Git integration if you want Cloudflare-native build).
6. Project name: `classroom-quick-downloader-website`.
7. Finish creation.

If project already exists, verify:

1. `Workers & Pages -> classroom-quick-downloader-website`.
2. Confirm default production domain is active.
3. Confirm `Not_Stable` preview branch alias is available after preview deploys.
4. Attach your root custom domain (`<your-root-domain>`) as production domain.
5. Enable redirect from `classroom-quick-downloader-website.pages.dev` to your root custom domain.

CLI equivalent:

```bash
pnpm dlx wrangler pages project create classroom-quick-downloader-website --production-branch main
```

### 4.1 Cloudflare API token creation (required for GitHub auto deploy)

In Cloudflare Dashboard:

1. Go to `My Profile -> API Tokens -> Create Token`.
2. Start from `Edit Cloudflare Workers` template (or custom token).
3. Ensure token has at least:
   - `Account -> Workers Scripts:Edit`
   - `Account -> Workers Tail:Read` (optional but useful)
   - `Account -> Pages:Edit`
   - `Account -> Analytics:Read`
4. Scope token to your account (`fc9538cb362e6266eea89037f6347225`).
5. Create token and copy value once.
6. Save value to GitHub secret `CLOUDFLARE_API_TOKEN`.

### 4.2 Cloudflare account ID

You can copy account ID from Cloudflare dashboard URL or run:

```bash
pnpm dlx wrangler whoami
```

Save that as GitHub secret `CLOUDFLARE_ACCOUNT_ID`.

### 4.3 Worker CORS origins for website writes

In Cloudflare Worker settings (`cqd-analytics`), ensure `CORS_ALLOWED_ORIGINS` includes:

- `https://<your-root-domain>`
- `https://classroom-quick-downloader-website.pages.dev`
- local dev origins you still use

This is required so `POST /api/public/website/events` accepts your website origins at the Worker ingress layer.

## 5) Automatic Deploys on `main`

Configured workflows:

- `/.github/workflows/deploy-cloudflare-worker.yml`
  - triggers on every push to `main`
  - runs preflight guardrails:
    - required secrets/variables presence
    - schema compatibility check (`tools/check_schema_compat.sh`)
  - tests + validates worker
  - deploys worker
  - runs post-deploy smoke checks:
    - `/health`
    - admin auth gate (expects `401/403`)
    - website ingest path (`POST /api/public/website/events`)
    - website snapshot compatibility route (`GET /api/public/website/snapshot`) when exposed

- `/.github/workflows/oracle-dashboard-deploy.yml`
  - triggers on every push to `main`
  - runs preflight guardrails:
    - required GitHub secrets presence
    - schema compatibility check (`tools/check_schema_compat.sh`)
  - SSH into Oracle VM
  - hard-syncs repo to `origin/main`
  - validates required `.env.production` keys on the server before deployment
  - rebuilds/recreates Oracle container
  - runs post-deploy smoke checks on Oracle:
    - `/health`
    - admin auth gate (expects `401/403`)
    - public website ingest path (`POST /api/public/website/events`)
    - public website snapshot path (`GET /api/public/website/snapshot`)

- `/.github/workflows/website-deploy.yml`
  - triggers on `main` for `website/**`, `CHANGELOG.md`, `PRIVACY.md`
  - builds website
  - deploys to Cloudflare Pages

## 6) Manual Deploy Commands

### 6.1 Deploy Oracle manually

```bash
ssh -i ~/.ssh/oracle_key ubuntu@129.151.233.229
cd ~/Classroom-Quick-Downloader
git fetch --prune origin main
git checkout main
git reset --hard origin/main
cd oracle-backend
cp .env.production .env
export COMPOSE_PROJECT_NAME=oracle-backend
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.runtime.override.yml up -d --build --no-deps --force-recreate oracle-backend
curl -fsS http://127.0.0.1:8080/health
```

### 6.2 Deploy Cloudflare Worker manually

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
pnpm -C cloudflare-worker test
pnpm -C cloudflare-worker run validate
pnpm -C cloudflare-worker run deploy
```

### 6.3 Deploy website manually

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
PUBLIC_BASE_PATH='' \
PUBLIC_ORACLE_API_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
PUBLIC_SITE_URL='https://classroom-quick-downloader-website.pages.dev' \
pnpm -C website build

# Preview branch deploy:
pnpm dlx wrangler pages deploy website/build --project-name classroom-quick-downloader-website --branch Not_Stable

# Production deploy:
pnpm dlx wrangler pages deploy website/build --project-name classroom-quick-downloader-website --branch main
```

## 7) Password Rotation Commands

### 7.1 Cloudflare Worker passwords

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
printf '%s' '<new-dashboard-password>' | pnpm -C cloudflare-worker exec wrangler secret put DASHBOARD_PASSWORD
printf '%s' '<new-danger-password>' | pnpm -C cloudflare-worker exec wrangler secret put DANGER_PASSWORD
pnpm -C cloudflare-worker run deploy
```

### 7.2 Oracle dashboard passwords

```bash
ssh -i ~/.ssh/oracle_key ubuntu@129.151.233.229
cd ~/Classroom-Quick-Downloader/oracle-backend
sed -i 's#^DASHBOARD_PASSWORD=.*#DASHBOARD_PASSWORD=<new-dashboard-password>#' .env.production
sed -i 's#^SUPER_ADMIN_PASSWORD=.*#SUPER_ADMIN_PASSWORD=<new-danger-password>#' .env.production
cp .env.production .env
export COMPOSE_PROJECT_NAME=oracle-backend
docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.runtime.override.yml up -d --no-deps --force-recreate oracle-backend
```

## 8) Post-Deploy Verification Checklist

Run all:

```bash
# Worker live checks
curl -fsS https://cqd-analytics.adhamhaithameid.workers.dev/health
curl -fsS https://cqd-analytics.adhamhaithameid.workers.dev/public/site-metrics
curl -fsS https://cqd-analytics.adhamhaithameid.workers.dev/api/public/website/overview
curl -fsS https://cqd-analytics.adhamhaithameid.workers.dev/api/public/website/uninstall

# Oracle live checks
ORACLE_BASE_URL="http://<your-oracle-host>:8080"
curl -fsS "${ORACLE_BASE_URL}/health"
curl -fsS "${ORACLE_BASE_URL}/api/public/website/overview"
curl -fsS "${ORACLE_BASE_URL}/api/admin/website/state" # requires auth cookie/session

# Oracle install-sync scheduler checks (15-minute automatic sync)
docker logs --tail 300 cqd-oracle-backend | rg "deployment auto-sync enabled|deployment auto-sync completed"

# Website live checks
curl -I https://classroom-quick-downloader-website.pages.dev
curl -I https://not-stable.classroom-quick-downloader-website.pages.dev
```

## 9) CI/CD Failure Recovery

### 9.1 Oracle deploy workflow fails

1. Open failed job logs in GitHub Actions.
2. SSH to server and run manual deploy command from section 6.1.
3. Check container logs:

```bash
docker logs --tail 200 cqd-oracle-backend
```

### 9.2 Worker deploy workflow fails

1. Verify `CLOUDFLARE_API_TOKEN` and scopes.
2. Run local:

```bash
pnpm -C cloudflare-worker test
pnpm -C cloudflare-worker run validate
pnpm -C cloudflare-worker run deploy
```

### 9.3 Website deploy workflow fails

1. Confirm repo variables are set.
2. Rebuild locally with same env values.
3. Deploy manually from section 6.3.

## 10) Recommended Operations Rule

- Keep production passwords and API tokens in GitHub Secrets / server `.env.production`.
- Never commit credentials to repo.
- Always verify `/health` and one public website endpoint after each deploy.
