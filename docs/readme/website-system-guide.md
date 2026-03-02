# Website System Guide (Svelte)

This document is the deep technical guide for the public website package.

Package root:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website`

Audience:
- developers who need to maintain UI, data fetching, telemetry, routing, and deployment behavior.

## 1. Tech Stack and Runtime

- SvelteKit static site build (Vite)
- deployed on Cloudflare Pages
- public read API calls target Oracle public HTTPS endpoint
- public write API calls target Worker gateway domain
- browser-side caching and telemetry queueing for resilience

Main config files:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/package.json`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/config.ts`
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/svelte.config.js`

## 2. Environment and Configuration

Runtime config surface in `src/lib/config.ts`:
- `PUBLIC_SITE_URL`
- `PUBLIC_ORACLE_API_BASE_URL`
- `PUBLIC_WORKER_BASE_URL`
- `PUBLIC_APP_VERSION`
- `PUBLIC_ENABLE_FEEDBACK_NAV`

Defaults:
- site URL: `PUBLIC_SITE_URL` if set, otherwise browser origin at runtime, with fallback `https://classroom-quick-downloader-website.pages.dev`
- Oracle read base fallback: `https://oracle.classroom-quick-downloader.com` (must be overridden in production)
- Worker write base fallback: `https://cqd-analytics.adhamhaithameid.workers.dev`
- app version default: `v1.3.8`

Store links are centralized in `STORE_LINKS` and consumed across nav/footer/pages.

## 3. Route and Layout Structure

Primary shell:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/routes/+layout.svelte`

Notable routes:
- `/overview` (main landing)
- `/privacy`
- `/faq`
- `/changelog`
- `/uninstall`
- `/samples`
- `/overview2` (alternate/experimental page mode)

Layout responsibilities:
- shared header/footer/navigation
- mobile nav behavior
- optional feedback nav injection behind env flag
- global website telemetry client lifecycle init/dispose

## 4. Data Access Layer

Core API module:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/api/publicSite.ts`

Public fetch functions:
- `fetchOverview()`
- `fetchMapData()`
- `fetchUserChangelog()`
- `fetchUninstallStats()`
- `submitUninstallFeedback(body)`
- `submitWebsiteEvents(body)`

Normalization:
- all external payloads are coerced through explicit `coerce*` functions
- invalid/malformed fields are sanitized to safe defaults

Network behavior:
- request timeout wrapper (`8s`)
- `cache: 'no-store'`
- descriptive source labels for failure context

## 5. Snapshot Caching Model

Snapshot object:
- combines overview + map into a single cached payload

Storage strategy:
1. in-memory cache (fast path)
2. localStorage persistence (`cqd.website.snapshot.v1`)

Policy:
- refresh window: `3 hours`
- dedupe concurrent requests with `snapshotInFlight`
- fallback to stale memory snapshot on fetch failure

Caller usage:
- overview page `loadSiteData()` reads snapshot and updates UI state
- interval reload scheduled at `ORACLE_SNAPSHOT_REFRESH_MS`

## 6. Website Telemetry Model

Telemetry module:
- `/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website/src/lib/analytics/websiteEvents.ts`

Tracked event schema:
- `eventType`: `cta | map`
- `action`: `install_click | download_click | map_yes | map_no`
- `placement`: normalized lowercase string
- `eventId`: UUID/random fallback
- `tsUtc`: event timestamp
- `meta`: sanitized key/value payload (bounded)

Queue and flush:
- queue cap `240`
- flush batch cap `24`
- periodic flush every `15s`
- `sendBeacon` path for hidden/pagehide lifecycle
- failed flush retains queue for next retry

Lifecycle integration:
- initialized in `+layout.svelte` `onMount`
- final beacon flush on unmount/dispose

## 7. UI Data Contracts (Expected)

Overview contract (selected fields):
- totals: downloads, success, fail
- installs: usersTotal, browsers[]
- versions: github/chrome/firefox/edge
- status: systemLive, liveSinceUtc, workerHealth
- links: store/github urls

Map contract:
- country-level counts only
- totals: countries, downloads
- privacy note

Uninstall contract:
- POST requires reason plus metadata
- GET provides totals + top reasons

Events ingest contract:
- POST batch response returns accepted/rejected counts

## 8. Interaction Capture Points

Current instrumentation points:
- nav install CTA (desktop/mobile)
- footer download CTA
- hero/final install or download buttons on overview
- map yes/no prompt actions
- uninstall page reinstall links

Submit feedback flow:
- form sends structured notes payload via `buildUninstallNotesPayload`
- browser/version/source metadata are captured from query params and UA detection

## 9. Performance and UX Behavior

Key runtime optimizations already in place:
- snapshot caching + in-flight dedupe
- queued telemetry with batched flushes
- sendBeacon on unload-like events
- guarded map load states (`loading`, `ready`, `error`)
- isolated heavy visuals in components and optional reduced-motion checks

Potential pressure points to watch:
- animation-heavy sections on low-end mobile
- very large DOM in a single route file (`overview/+page.svelte`)
- high-frequency scroll/observer logic interactions

## 10. Security and Privacy Posture

Website-side controls:
- no direct raw IP handling in client code
- bounded metadata fields and lengths
- strict API coercion before rendering
- defaults and fallback values reduce malformed payload impact

Server-side protections expected downstream:
- Oracle strict JSON decoding
- write CORS/origin enforcement
- body limits and action allowlists
- idempotent event ingestion

## 11. Testing Matrix for Website Package

Commands from website root:

```bash
pnpm run test:smoke
pnpm run test:functional
pnpm run test:integration
pnpm run test:regression
pnpm run test:load
pnpm run test:stress
pnpm run test:security
pnpm run test:ui
pnpm run test:fuzz
pnpm run test:reliability
pnpm run test:unit
pnpm run test:acceptance
pnpm run test:system
pnpm run test:strict
```

Representative suites currently present:
- API coercion/snapshot/security/regression tests
- telemetry queue/reliability/fuzz tests
- component/UI tests for animated number and overlays
- uninstall feedback component and edge-case tests

## 12. Local Development and Validation

From monorepo root:

```bash
# website dev server
pnpm -C /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website dev

# typecheck
pnpm -C /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website check

# build
pnpm -C /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website build

# strict tests
pnpm -C /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website run test:strict
```

Cloudflare Pages local preview:

```bash
pnpm -C /Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader/website run dev:pages
```

## 13. Deployment Notes (Website package)

- output is static build artifacts from Vite/SvelteKit
- production API base should point to Worker gateway domain
- if using Cloudflare Pages env vars, set:
  - `PUBLIC_ORACLE_API_BASE_URL`
  - `PUBLIC_WORKER_BASE_URL`
  - `PUBLIC_SITE_URL`

## 14. Known Current Findings

Latest scan notes relevant to website package:
- behavior and integration suites are passing
- `pnpm audit` reports moderate advisories for Svelte versions `<5.53.5`

Recommended action:
- upgrade Svelte to patched range and rerun strict scan.

## 15. Change Safety Checklist for Contributors

Before merging website changes:

1. run `pnpm run check`
2. run `pnpm run test:strict`
3. run full monorepo `pnpm run scan:repo`
4. verify `/overview`, `/changelog`, `/privacy`, `/uninstall` manually
5. verify telemetry and feedback post endpoints from browser devtools
6. verify no sensitive metadata is rendered publicly
