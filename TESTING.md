# Testing Guide

> Update (2026-02-28): Major full-repo scan completed. Security scans are clean; known residual issue is intermittent timeout flakiness during heavy combined test runs (not deterministic functional regressions). See `/docs/MAJOR_SCAN_2026-02-28.md` for full evidence.

> Comprehensive reference for every test suite, integration test, CI workflow, and manual verification script in the **Classroom Quick Downloader** monorepo.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Latest Major Scan Snapshot (2026-02-28)](#latest-major-scan-snapshot-2026-02-28)
- [Project Structure](#project-structure)
- [Extension Tests (Vitest)](#extension-tests-vitest)
  - [Unit Tests](#unit-tests)
  - [Integration Tests](#integration-tests)
  - [Coverage Profiles](#coverage-profiles)
- [Cloudflare Worker Tests (Vitest)](#cloudflare-worker-tests-vitest)
- [Oracle Backend Tests (Go)](#oracle-backend-tests-go)
- [CI / CD Workflows](#ci--cd-workflows)
  - [CI Pipeline](#1-ci-pipeline-ciyml)
  - [CodeQL Analysis](#2-codeql-analysis-codeqlyml)
  - [Release Drafter](#3-release-drafter-release-drafteryml)
- [Manual Testing Scripts](#manual-testing-scripts)
- [Git Hooks](#git-hooks)
- [Running Everything at Once](#running-everything-at-once)
- [Phase 12 + 13 Execution](#phase-12--13-execution)

---

## Quick Start

```bash
# From the repo root – install all dependencies
pnpm install

# Run ALL automated tests across every component
pnpm -C extension test                        # Extension unit + integration
pnpm --filter cloudflare-worker test          # Cloudflare Worker tests
cd oracle-backend && go test ./...            # Oracle Backend Go tests

# Enforce coverage gates
pnpm -C extension test:coverage:all           # Critical + runtime 100 % gates
```

## Phase 12 + 13 Execution

Strict phase-12 closure:

```bash
bash tools/phase12_verify.sh
```

Phase-12 matrix reference:

- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/PHASE12_TEST_MATRIX.md`

Phase-13 rollout sequence (dry-run style validation + smoke):

```bash
WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
ORACLE_BASE_URL='https://<your-oracle-public-https-domain>' \
WEBSITE_URL='https://classroom-quick-downloader-website.pages.dev' \
bash tools/phase13_rollout.sh
```

Phase-13 rollout including deployments:

```bash
ORACLE_SSH_DEST='ubuntu@<oracle-host>' \
CLOUDFLARE_ACCOUNT_ID='<account-id>' \
CLOUDFLARE_API_TOKEN='<token>' \
CLOUDFLARE_PAGES_PROJECT_NAME='classroom-quick-downloader-website' \
PUBLIC_BASE_PATH='' \
PUBLIC_ORACLE_API_BASE_URL='https://<your-oracle-public-https-domain>' \
PUBLIC_WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
PUBLIC_SITE_URL='https://<your-root-domain>' \
WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
ORACLE_BASE_URL='https://<your-oracle-public-https-domain>' \
WEBSITE_URL='https://<your-root-domain>' \
bash tools/phase13_rollout.sh --deploy
```

24h monitoring window (lag/retry/DLQ guardrails):

```bash
WORKER_BASE_URL='https://cqd-analytics.adhamhaithameid.workers.dev' \
ORACLE_BASE_URL='https://<your-oracle-public-https-domain>' \
DURATION_HOURS=24 \
INTERVAL_SECONDS=300 \
bash tools/phase13_monitor.sh
```

## Latest Major Scan Snapshot (2026-02-28)

- `pnpm run scan:security` -> PASS
- `pnpm -C website run test:strict` -> PASS (isolated)
- `pnpm -C cloudflare-worker run test:strict` -> PASS (isolated)
- `pnpm -C oracle-backend run test:strict` -> PASS
- `pnpm -C extension run test -- --maxWorkers=1` -> PASS

Known caveat:
- Vitest timeout/hook budgets were raised to `30s` for `website`, `cloudflare-worker`, and `extension` to reduce false negatives in heavy runs.
- If a shared host is under heavy contention, rerun affected suites in isolation for deterministic signal.

---

## Project Structure

```
Classroom-Quick-Downloader/
├── extension/                  # Browser extension (TypeScript / WXT)
│   ├── tests/                  # 47 Vitest test files
│   ├── vitest.config.ts        # Vitest config with 3 coverage profiles
│   └── package.json            # Test scripts
├── cloudflare-worker/          # Edge analytics & dashboard (TypeScript)
│   ├── tests/                  # 13 Vitest test files
│   ├── vitest.config.ts        # Vitest config (Node env)
│   └── package.json            # Test scripts
├── oracle-backend/             # Analytics API (Go / Docker)
│   ├── cmd/app/
│   │   ├── main_test.go        # IP-handling tests
│   │   └── security_test.go    # Auth, session & rate-limit tests
│   └── internal/handlers/
│       └── pipeline_test.go    # Delivery/failure observability tests
├── tools/                      # Shell-based testing & validation
│   ├── validate.sh             # CI-style full validation
│   ├── test_analytics.sh       # Manual analytics pipeline test
│   ├── test_pipeline.sh        # End-to-end pipeline smoke test
│   ├── verify_oracle.sh        # Oracle backend vet + test + Docker build
│   └── deploy_manual.sh        # Manual Cloudflare + Oracle deploy commands
└── .github/workflows/          # GitHub Actions CI/CD
    ├── ci.yml                  # Main CI pipeline
    ├── codeql.yml              # SAST security scanning
    └── release-drafter.yml     # Automated release notes
```

---

## Extension Tests (Vitest)

| Config | File | Environment |
|--------|------|-------------|
| Framework | [vitest.config.ts](extension/vitest.config.ts) | `jsdom` |
| Setup | [tests/setup.ts](extension/tests/setup.ts) | Mocks `chrome.*` APIs, `fake-indexeddb`, `getComputedStyle`, `createTreeWalker`, and uses fake timers |

### Unit Tests

**42 unit test files** covering every layer of the extension:

#### Content Script Layer (UI & DOM)

| # | Test File | What It Covers |
|---|-----------|----------------|
| 1 | `content-button-factory.test.ts` | Download button creation and rendering |
| 2 | `content-button-state.test.ts` | Button state transitions (idle → loading → done → cancelled) |
| 3 | `content-download-handler.test.ts` | File download orchestration from content script |
| 4 | `content-file-meta.test.ts` | File metadata extraction from Classroom DOM |
| 5 | `content-flags.test.ts` | Feature flags and conditional logic |
| 6 | `content-i18n.test.ts` | Internationalization string resolution |
| 7 | `content-message-handler.test.ts` | Message passing between content ↔ background |
| 8 | `content-observers.test.ts` | MutationObserver setup and teardown |
| 9 | `content-pulse-effect.test.ts` | CSS pulse animation on buttons |
| 10 | `content-state.test.ts` | Content script shared state management |
| 11 | `content-styles.test.ts` | Dynamic stylesheet injection |
| 12 | `content-tab-detector.test.ts` | Classroom tab detection (Assignments, Classwork, etc.) |
| 13 | `content-theme.test.ts` | Light / dark theme detection and application |
| 14 | `content-url-utils.test.ts` | Classroom URL parsing and matching |
| 15 | `content-both-badge.test.ts` | Badge rendering on both download modes |

#### Background Script Layer

| # | Test File | What It Covers |
|---|-----------|----------------|
| 16 | `background-analytics-alarm.test.ts` | Chrome Alarms API for analytics flush scheduling |
| 17 | `background-auth-utils.test.ts` | Authentication utilities (token validation, etc.) |
| 18 | `background-cleanup.test.ts` | State cleanup on extension update / install |
| 19 | `background-download-handler.test.ts` | `chrome.downloads` API orchestration |
| 20 | `background-icon-manager.test.ts` | Dynamic icon switching (color / gray) |
| 21 | `background-index.test.ts` | Background entrypoint registration |
| 22 | `background-message-sender.test.ts` | Cross-tab message broadcasting |
| 23 | `background-state.test.ts` | Background persistent state management |
| 24 | `background-url-helpers.test.ts` | URL helpers (Drive bypass, file ID extraction) |

#### Analytics Layer

| # | Test File | What It Covers |
|---|-----------|----------------|
| 25 | `analytics-detection.test.ts` | Download event detection and classification |
| 26 | `analytics-flush.test.ts` | Batch flush logic to Cloudflare Worker |
| 27 | `analytics-flush-runtime.test.ts` | Runtime-specific flush edge cases |
| 28 | `analytics-index-runtime.test.ts` | Analytics module initialization at runtime |
| 29 | `analytics-rate-limiter.test.ts` | Client-side rate limiting |
| 30 | `analytics-storage.test.ts` | IndexedDB analytics event persistence |
| 31 | `analytics-storage-internals.test.ts` | Low-level storage internals |

#### Detection System (Universal V4)

| # | Test File | What It Covers |
|---|-----------|----------------|
| 32 | `core.test.ts` | Core detection engine (keyword matching, Unicode digits) |
| 33 | `dom.test.ts` | DOM-based material detection |
| 34 | `ui.test.ts` | UI rendering for detected materials |

#### Utilities & Cross-Cutting

| # | Test File | What It Covers |
|---|-----------|----------------|
| 35 | `cancel.test.ts` | Download cancellation flow |
| 36 | `entrypoints-smoke.test.ts` | Smoke tests for all entrypoint modules |
| 37 | `utils-analytics-reexports.test.ts` | Re-export barrel file correctness |
| 38 | `utils-changelog.test.ts` | Changelog parsing utilities |
| 39 | `utils-firefox-debug.test.ts` | Firefox-specific debug helpers |
| 40 | `utils-global-state.test.ts` | Global state singleton |
| 41 | `utils-language-controller.test.ts` | Language preference controller |
| 42 | `xss-prevention.test.ts` | XSS prevention (`escapeHtml`, sanitization) |

### Integration Tests

| # | Test File | What It Covers |
|---|-----------|----------------|
| 43 | `integration-extension-cloudflare.test.ts` | **End-to-end integration** between the extension analytics layer and the Cloudflare `DownloadsDurable` Durable Object. Uses mock `DurableObjectStorage` to simulate event tracking, buffering, and flush cycles across both systems. |

### How to Run Extension Tests

```bash
# Navigate to extension directory
cd extension

# Run all tests once
pnpm test

# Run tests in watch mode (re-runs on file changes)
pnpm test:watch

# Run a specific test file
pnpm exec vitest run tests/cancel.test.ts

# Run tests matching a pattern
pnpm exec vitest run --reporter=verbose -t "button state"
```

### Coverage Profiles

The extension vitest config defines **three coverage profiles** via the `COVERAGE_PROFILE` env var:

#### 1. Default Profile

```bash
pnpm -C extension test:coverage
```

- **Provider:** V8
- **Includes:** `entrypoints/content/**/*.ts`
- **Thresholds:** None (informational only)
- **Reporters:** `text`, `json`, `html`

#### 2. Critical Profile (`COVERAGE_PROFILE=critical`)

```bash
pnpm -C extension test:coverage:critical
```

- **Provider:** V8
- **Includes:** Core analytics and background modules
  - `entrypoints/utils/analytics/storage.ts`
  - `entrypoints/utils/analytics/flush.ts`
  - `entrypoints/utils/analytics/rate-limiter.ts`
  - `entrypoints/utils/analytics/detection.ts`
  - `entrypoints/background/download-handler.ts`
  - `entrypoints/background/message-sender.ts`
  - `entrypoints/background/state.ts`
  - `entrypoints/background/url-helpers.ts`
- **Thresholds:** 🚨 **100 % across lines, functions, branches, and statements**
- **Reporters:** `text`, `json`, `html`

#### 3. Runtime Profile (`COVERAGE_PROFILE=runtime`)

```bash
pnpm -C extension test:coverage:runtime
```

- **Provider:** V8
- **Includes:** Same modules as Critical profile
- **Excludes:** `*.d.ts`, `node_modules`, `translations/**`, `icons.ts`
- **Thresholds:** 🚨 **100 % across lines, functions, branches, and statements**
- **Reporters:** `text`, `json`, `html`

#### Run Both Coverage Gates Together

```bash
pnpm -C extension test:coverage:all
```

This runs `test:coverage:critical` followed by `test:coverage:runtime` sequentially. Both must pass for CI to succeed.

---

## Cloudflare Worker Tests (Vitest)

| Config | File | Environment |
|--------|------|-------------|
| Framework | [vitest.config.ts](cloudflare-worker/vitest.config.ts) | `node` |
| Mocks cleared | Automatically between tests (`clearMocks: true`) | |

### Test Files

| # | Test File | What It Covers |
|---|-----------|----------------|
| 1 | `security.test.ts` | **Security + reliability behaviors** — session cookie/token creation & verification, local environment detection, Durable Object login attempt locking, IP allowlist enforcement, event PII stripping (`ip_address` removal), weighted replay queue behavior, failure-rollup export, delivery-chain metrics, admin secret enforcement |
| 2 | `dashboard.test.ts` (121 lines) | **Dashboard UI rendering** — legacy toggle state (enabled/disabled), pipeline health card rendering, health-notify interval minute conversions |

### How to Run

```bash
# From repo root
pnpm --filter cloudflare-worker test

# Or from within the directory
cd cloudflare-worker
pnpm test

# Run a specific file
pnpm exec vitest run tests/security.test.ts
```

---

## Oracle Backend Tests (Go)

The Oracle backend uses the standard Go testing framework (`testing` package).

### Test Files

| # | Test File | What It Covers |
|---|-----------|----------------|
| 1 | `cmd/app/main_test.go` | **IP handling** — trusted proxy `X-Forwarded-For` extraction, untrusted proxy header rejection |
| 2 | `cmd/app/security_test.go` | **Security & auth** — SPA handler path traversal blocking, session auth middleware enforcement, archiver secret bypass, login handler secure cookie setting, insecure cookie in dev mode (`ALLOW_INSECURE_COOKIES`), auth-check endpoint session reflection, ingest batch secret validation, login rate limiting, pipeline endpoint auth enforcement |
| 3 | `internal/handlers/pipeline_test.go` | **Pipeline observability** — delivery-stage metrics persistence, structured failure sink ingestion, failure retention cleanup, committed-stage fallback behavior |

### How to Run

```bash
# From repo root
cd oracle-backend && go test ./...

# Verbose output
cd oracle-backend && go test -v ./...

# Run a specific test function
cd oracle-backend && go test -v -run TestLoginHandler_RateLimitsAfterFailures ./cmd/app/
```

---

## CI / CD Workflows

All workflows live in `.github/workflows/`.

### 1. CI Pipeline (`ci.yml`)

> **Trigger:** Push to `main`/`master`, PRs targeting `main`/`master`

This is the primary quality gate. It runs every test suite in the monorepo:

| Step | Command | What It Does |
|------|---------|--------------|
| Install Dependencies | `pnpm install` | Installs all workspace dependencies |
| Cloudflare Worker Tests | `pnpm --filter cloudflare-worker test` | Runs `security.test.ts` and `dashboard.test.ts` |
| Extension Tests | `pnpm -C extension test` | Runs all 43 extension test files |
| Extension Typecheck | `pnpm -C extension compile` | TypeScript strict compilation (`tsc --noEmit`) |
| Extension Coverage Gates | `pnpm -C extension test:coverage:all` | Enforces 100 % coverage on critical + runtime profiles |
| Oracle Backend Tests | `go test ./...` (inside `oracle-backend/`) | Runs Go unit tests for IP handling, security, and pipeline observability handlers |
| Full Validation Suite | `./tools/validate.sh` | Lints, typechecks, audits the worker, then starts a local wrangler dev server and curls `/health` |

**Environment:** Ubuntu Latest, Node 20, pnpm 10.28.2, Go 1.24.13

### 2. CodeQL Analysis (`codeql.yml`)

> **Trigger:** Push to `main`, PRs targeting `main`, weekly schedule (Monday 02:27 UTC)

| Step | What It Does |
|------|--------------|
| Initialize CodeQL | Sets up CodeQL for `javascript-typescript` |
| Autobuild | Automatically builds the codebase |
| Perform Analysis | Runs SAST (Static Application Security Testing) for vulnerabilities |

Results appear in the **Security** tab of the GitHub repository.

### Deployment Model

Production deploys are automated through GitHub Actions on `main`:

- `/.github/workflows/deploy-cloudflare-worker.yml` deploys the Worker on every `main` push (and supports manual dispatch).
- `/.github/workflows/oracle-dashboard-deploy.yml` deploys Oracle backend/dashboard to the VM on every `main` push (and supports manual dispatch).
- `/.github/workflows/website-deploy.yml` deploys Website on `main` pushes affecting website/docs paths (and supports manual dispatch).

Manual deploy scripts remain available for emergency/ops use:

```bash
# Cloudflare Worker deploy (from your local machine)
./tools/deploy_manual.sh cloudflare

# Oracle backend deploy (run on Oracle VM)
./tools/deploy_manual.sh oracle
```

### 3. Release Drafter (`release-drafter.yml`)

> **Trigger:** Push to `main`

Automatically drafts GitHub release notes based on merged PRs using labels.

---

## Manual Testing Scripts

Located in the `tools/` directory. These are used for local development and manual verification.

### 1. `validate.sh` — Full Codebase Validation

```bash
./tools/validate.sh
```

**What it does:**
1. Runs static analysis on the Cloudflare Worker (`lint`, `typecheck`, `audit`)
2. Starts a local wrangler dev server on port `8788`
3. Waits 5 seconds for the server to initialize
4. Curls the `/health` endpoint and asserts HTTP 200
5. Shuts down the server automatically on exit (trap cleanup)

> [!NOTE]
> This is the same script that runs in CI. Use it locally to verify before pushing.

### 2. `test_analytics.sh` — Analytics Pipeline Test

```bash
./tools/test_analytics.sh
```

**Prerequisites:** Both `wrangler dev` (port `8787`) and Oracle backend (port `8080`) must be running locally.

**What it does:**
1. Sends 15 test events (10 success + 5 fail) to the Cloudflare Worker `/track` endpoint
2. Checks the Durable Object state via `/stats`
3. Forces a flush to the Oracle backend via `/admin/force-flush`
4. Verifies the Oracle backend received all events via `/api/stats/summary`
5. Outputs verification checklist for manual review

### 3. `test_pipeline.sh` — End-to-End Pipeline Smoke Test

```bash
./tools/test_pipeline.sh
```

**Prerequisites:** Both `wrangler dev` (port `8787`) and Oracle backend (port `8080`) must be running locally.

**What it does:**
1. Health-checks both Oracle backend and Cloudflare Worker
2. Records initial worker stats
3. Sends 6 test events (4 success + 2 fail) individually
4. Checks worker stats after send
5. Force-flushes if pending events remain
6. Verifies Oracle backend received the data
7. Tests Oracle timeseries and breakdown API endpoints

### 4. `verify_oracle.sh` — Oracle Backend Verification

```bash
./tools/verify_oracle.sh
```

**What it does:**
1. Runs `go vet ./...` for static analysis
2. Runs `go test -v ./...` for all Go tests
3. Attempts a Docker build (`docker build . -t oracle-backend-test:latest`) to verify the Dockerfile

> [!IMPORTANT]
> Requires Docker to be installed for the build verification step (skipped gracefully if Docker is not available).

### 5. `oracle-backend/scripts/deploy_main_inplace.sh` — Oracle Production Deploy Helper

```bash
ssh ubuntu@<your-oracle-host>
bash ~/Classroom-Quick-Downloader/oracle-backend/scripts/deploy_main_inplace.sh
```

**What it does:**
1. Ensures the monorepo clone exists on the VM and checks out `origin/main` (or `TARGET_REF` override)
2. Copies legacy `.env` / `google-credentials.json` forward once (if needed)
3. Preserves the currently-running backend image under a rollback tag
4. Rebuilds and recreates only `oracle-backend` service (no global `down`, no image prune)
5. Verifies `/health` before reporting success

---

## Git Hooks

Pre-commit quality checks are enforced via [Husky](https://typicode.github.io/husky/).

| Hook | File | What It Does |
|------|------|--------------|
| `commit-msg` | `.husky/commit-msg` | Validates commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) via `commitlint` |

**Configuration:**
- `commitlint.config.js` — extends `@commitlint/config-conventional`
- Commit messages must follow: `type(scope): description` (e.g., `feat(extension): add dark mode support`)

---

## Running Everything at Once

### Run All Automated Tests (Locally)

```bash
# 1. Install dependencies
pnpm install

# 2. Extension tests + coverage gates
pnpm -C extension test
pnpm -C extension test:coverage:all

# 3. Cloudflare Worker tests
pnpm --filter cloudflare-worker test

# 4. Oracle Backend tests
cd oracle-backend && go test -v ./... && cd ..

# 5. Cloudflare Worker static analysis + health check
./tools/validate.sh

# 6. Oracle Backend verification (vet + test + Docker build)
./tools/verify_oracle.sh
```

### One-Liner (All Automated Tests)

```bash
pnpm install && \
pnpm -C extension test && \
pnpm -C extension test:coverage:all && \
pnpm --filter cloudflare-worker test && \
(cd oracle-backend && go test ./...) && \
./tools/validate.sh
```

### Run All Manual Pipeline Tests

```bash
# Requires wrangler dev (port 8787) and Oracle backend (port 8080) to be running
./tools/test_analytics.sh
./tools/test_pipeline.sh
```

---

## Test Count Summary

| Component | Unit Tests | Integration Tests | Coverage Gates | Total Files |
|-----------|-----------|-------------------|----------------|-------------|
| Extension | 42 | 1 | 2 (critical + runtime) | 43 |
| Cloudflare Worker | 2 | — | — | 2 |
| Oracle Backend | 2 | — | — | 2 |
| **Total** | **46** | **1** | **2** | **47** |

| CI Workflow | Trigger | Purpose |
|-------------|---------|---------|
| `ci.yml` | Push / PR to `main` | Full test suite + coverage gates + validation |
| `codeql.yml` | Push / PR / Weekly | Static security analysis (SAST) |
| `release-drafter.yml` | Push to `main` | Draft release notes |

| Manual Script | Purpose |
|---------------|---------|
| `validate.sh` | Lint + typecheck + audit + health check |
| `test_analytics.sh` | 15-event pipeline test |
| `test_pipeline.sh` | 6-event E2E smoke test |
| `verify_oracle.sh` | Go vet + tests + Docker build |
| `oracle-backend/scripts/deploy_main_inplace.sh` | In-place Oracle production deploy with rollback image tag |
| `deploy_manual.sh` | One-command manual deploy wrapper (`cloudflare`, `oracle`, `all`) |

---

## Runbook Validation Suite (Phase 11)

Use this section to validate that deployment/incident/data-flow runbooks are still accurate.

Related docs:

- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_DEPLOYMENT.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/RUNBOOK_INCIDENT_RESPONSE.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DATA_FLOW_WORKER_ORACLE_WEBSITE.md`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/docs/DEPLOYMENT_RUNBOOK.md`

### A. Command Accuracy Check

```bash
cd /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader
bash tools/check_schema_compat.sh
pnpm -C cloudflare-worker test:smoke
pnpm -C website test:smoke
cd oracle-backend && go test ./... && cd ..
```

Expected output:

- schema check prints `Schema compatibility check passed (version=1)`
- test suites complete with pass counts and no failures

### B. Data-Flow Smoke Check

```bash
WORKER_BASE=\"https://cqd-analytics.adhamhaithameid.workers.dev\"
SITE_ORIGIN=\"https://<your-root-domain>\"

curl -fsS \"${WORKER_BASE}/health\"
curl -fsS \"${WORKER_BASE}/api/public/website/snapshot\"
curl -fsS -X POST \"${WORKER_BASE}/api/public/website/events\" \
  -H \"Origin: ${SITE_ORIGIN}\" \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{\"schemaVersion\":\"1\",\"sessionId\":\"testing-smoke\",\"pagePath\":\"/testing\",\"events\":[{\"eventId\":\"testing-smoke-1\",\"eventType\":\"cta\",\"action\":\"install_click\",\"placement\":\"hero_install\"}]}'
```

Expected output:

- `/health` returns `200`
- snapshot response includes `schemaVersion: \"1\"`
- ingest response includes `ok: true`

### C. Replay/Recovery Procedure Check

```bash
curl -fsS https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/status \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>'
curl -fsS -X POST https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/replay-dlq \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>' \
  -d '{\"limit\":25}'
curl -fsS -X POST https://cqd-analytics.adhamhaithameid.workers.dev/admin/website/flush-now \
  -H 'X-Admin-Secret: <DO_SHARED_SECRET>'
```

Expected output:

- status payload includes queue and dead-letter fields
- replay/flush endpoints return `ok: true`

### D. Security Containment Drill (Procedure Validation)

This is a procedural test. Do not run in production without change control.

Checklist:

1. Verify runbook paths resolve and are current.
2. Verify secret rotation commands execute in staging.
3. Verify rollback commands are executable and known-good SHA is available.
4. Verify post-rollback smoke checks pass.
