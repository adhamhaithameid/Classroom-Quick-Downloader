# v1.6.0 Coordinated Release Sequence (Analytics Contract)

Addendum to `docs/DEPLOYMENT_RUNBOOK.md` (which stays the source of truth for
per-service mechanics). This covers the one release-specific hazard: the
funnel-event contract change (`content` type; `guide_cta_click`,
`faq_expand`, `guide_engaged`) ships across three packages that each validate
against their own whitelist. Deploy in the order below and **no event is ever
rejected in production**:

```text
1. Oracle  (accepts superset of events — old worker payloads still valid)
2. Worker  (now validates the new contract; Oracle already accepts it)
3. Website (starts emitting new events; whole chain ready)
4. Extension store release (separate, manual — no contract coupling)
```

## 0. Preflight

- [ ] Oracle VM healthy: `curl -m 5 https://oracle.classroom-quick-downloader.com/health` → 200
  (if not: `docs/ORACLE_RECOVERY_RUNBOOK.md` first — deploying analytics changes on a dead Oracle only grows the Worker backlog)
- [ ] Worker `/health` → 200 (beware free-plan 429 windows)
- [ ] Working tree clean or only intended changes; CI green on `main`
- [ ] All three suites green locally:
  - `corepack pnpm -C website test` (baseline ≥ 1072 tests)
  - `corepack pnpm -C cloudflare-worker test` (baseline ≥ 953 tests)
  - `cd oracle-backend && go test ./...`
- [ ] Contract agreement verified (see "Contract verification" below)

## 1. Deploy Oracle

```bash
ssh ubuntu@129.151.233.229
cd ~/Classroom-Quick-Downloader && git pull && cd oracle-backend
docker compose build && docker compose up -d
curl -m 5 http://localhost:8080/health   # on the VM
```

Verify from outside: `curl -m 5 https://oracle.classroom-quick-downloader.com/health` → 200.

## 2. Deploy Worker

Worker auto-deploys on push to `main` (`.github/workflows/deploy-cloudflare-worker.yml`),
or use its `workflow_dispatch`. Verify:

```bash
curl -m 10 https://cqd-analytics.adhamhaithameid.workers.dev/health   # 200
# new contract accepted end-to-end (eventId must be unique per run):
curl -s -X POST https://cqd-analytics.adhamhaithameid.workers.dev/api/public/website/events \
  -H 'Origin: https://classroom-quick-downloader.adhamhaithameid.is-a.dev' \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"schemaVersion":"1","sessionId":"release-check","pagePath":"/release-check","events":[{"eventId":"release-<run-id>","eventType":"content","action":"faq_expand","placement":"faq_item","meta":{"question":"release smoke","section":"smoke"}}]}'
# expect {"ok":true,...}
```

Repeat the same POST with `eventType:"cta", action:"guide_cta_click"` to cover
both new families. Old events (`install_click`, `map_yes`) keep working — the
existing ingest smoke in `website-deploy.yml` proves it every deploy.

## 3. Deploy Website

Auto-deploys on push to `main` (website-deploy workflow), including post-deploy
smoke checks and IndexNow/GSC submission. Verify:

- `curl https://classroom-quick-downloader.adhamhaithameid.is-a.dev/robots.txt` → 200
- `curl https://classroom-quick-downloader.adhamhaithameid.is-a.dev/sitemap.xml` → 200 (22 URLs)
- Open the site; DevTools → Network: interact with a FAQ item and a guide CTA,
  confirm `/api/public/website/events` batches return `ok: true` and no 400s.
- Oracle dashboard: new `faq_expand` / `guide_cta_click` / `guide_engaged`
  counters appear with today's date.

## 4. Extension store release (manual, separate)

Follow `docs/STORE_LISTINGS.md`. No dependency on steps 1–3; bundle with the
v1.6.0 tag.

## Rollback

Reverse order, and only if user-visible breakage appears:

1. Revert website (new events stop immediately; nothing downstream rejects).
2. Revert Worker (old whitelist returns; website already reverted so no new
   events exist).
3. Oracle needs **no rollback** — accepting a superset is backward compatible.

## Contract verification (run before deploying anything)

The three whitelists must agree. Quick grep-based check:

```bash
grep -A6 'WEBSITE_EVENT_TYPE_VALUES' cloudflare-worker/src/downloads_do.ts
grep -n 'guide_cta_click\|faq_expand\|guide_engaged\|"content"' cloudflare-worker/src/downloads_do.ts oracle-backend/internal/handlers/public_website.go website/src/lib/types/public.ts website/src/lib/analytics/websiteEvents.ts
```

All three packages must list `content`, `guide_cta_click`, `faq_expand`,
`guide_engaged`, and map each action to `content`/`cta` identically.
