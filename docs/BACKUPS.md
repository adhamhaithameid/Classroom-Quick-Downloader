# Backups & Data Portability

Last updated: 2026-09-21
Owner: CQD platform maintainers

This is the canonical document for how the project's analytics data is backed
up, where every copy lives, how the Google Sheet integration works, and how to
restore or export everything. The data plane is fully Cloudflare-resident
(D1 + Durable Object + KV); this document exists so that a Cloudflare incident
— billing lapse, account lockout, accidental deletion — cannot take the data
history with it.

---

## 1. What data exists, and where

| Data | Primary store | Backed up daily? |
| --- | --- | --- |
| Extension download analytics (aggregated batch envelopes) | D1 `SITE_CACHE_DB` → `event_archive` table | ✅ `backups/latest/event-archive.{json,csv}` |
| Live counters (downloads, countries, browser/OS/language breakdowns) | Durable Object state | ✅ `backups/latest/do-storage.json` |
| Website telemetry (CTA/map/error events) | Durable Object queue → D1 archive | ✅ (kind `website-events` rows) |
| Uninstall feedback | Durable Object (`analytics_uninstall` shard) | ✅ (inside `do-storage.json`) |
| Public website snapshot (last-good) | KV `site:v1:snapshot` | ✅ `backups/latest/public-snapshot.json` |
| Store stats + scrape health + trends | KV `site:v1:store-stats` / `scrape-health` / `trends` | ❌ regenerable — scraper rebuilds these automatically |
| Bootstrap snapshot (first-paint fallback) | Git: `website/static/data/bootstrap-snapshot.json` | ✅ by definition (committed) |

Nothing analytics-related lives outside Cloudflare *except* the backups
described here.

---

## 2. The daily backup workflow

`.github/workflows/data-backups.yml` — runs daily at **04:17 UTC** (and on
demand via `workflow_dispatch`).

Steps:

1. **D1 export** — `wrangler d1 execute SITE_CACHE_DB --remote --json` selects
   every row of `event_archive`. If the table does not exist yet (fresh
   deployment), the step degrades to an empty sheet instead of failing.
2. **Sheet build** — `tools/backup-to-sheet.mjs` converts the rows to
   `event-archive.csv` plus a per-kind `backup-summary.csv`.
3. **DO state dump** — `GET /admin/storage-export` with the
   `DO_SHARED_SECRET` secret; writes `do-storage.json` (8 MB cap, truncated
   flag set if hit). Skips with a warning if the secret is absent.
4. **Public snapshot** — fetches `/api/public/website/snapshot` (no auth).
5. **Commit** — everything lands under `backups/latest/` on the default
   branch with `[skip ci]`. Git history is the versioned archive: any past
   day's state is `git show <rev>:backups/latest/event-archive.csv`.
6. **Google Sheets push (optional)** — overwrites the configured Google Sheet
   with the full archive (see §3). Skipped unless credentials are configured.

### Files committed

| File | Contents |
| --- | --- |
| `backups/latest/event-archive.json` | Raw `wrangler d1 execute --json` output |
| `backups/latest/event-archive.csv` | One row per batch: batch_id, kind, created_at_utc (+ISO), event_count, weighted_count, archived_at_utc (+ISO) |
| `backups/latest/backup-summary.csv` | Per-kind totals (batches / events / weighted) |
| `backups/latest/do-storage.json` | Full Durable Object state (all storage keys) |
| `backups/latest/public-snapshot.json` | Last public website snapshot |

### Manual triggers

```bash
# Full pipeline (D1 export + sheet + DO dump + Google push):
gh workflow run data-backups.yml --repo adhamhaithameid/Classroom-Quick-Downloader

# Local sheet build only (no Cloudflare auth needed for the CSV step):
wrangler d1 execute SITE_CACHE_DB --remote --json \
  "SELECT batch_id, kind, created_at_utc, event_count, weighted_count, archived_at_utc FROM event_archive ORDER BY created_at_utc ASC" \
  > /tmp/event-archive.json
node tools/backup-to-sheet.mjs /tmp/event-archive.json /tmp/backups
```

---

## 3. Google Sheets integration

The daily workflow also overwrites the project's Google Sheet with the full
archive, restoring the export the retired Oracle backend used to perform.

- **Sheet:** https://docs.google.com/spreadsheets/d/1ptzLKUVnAkyXnT635Zgb1C6Img9aeAZ1se3nRz_QZmI
- **Range:** `Sheet1!A1` (override with the `GOOGLE_SHEETS_RANGE` Actions
  variable). The write is a full `values.update` from A1 — the sheet always
  mirrors the whole archive; stale rows below the data range are not cleared.
- **Auth:** Google service account, RS256 JWT → OAuth2 token → Sheets API v4.
  Implemented with Node built-ins only (`tools/backup-to-sheet.mjs`) — no
  googleapis dependency.

### Configuration (GitHub secrets/vars, all set as of 2026-09-21)

| Name | Kind | Value |
| --- | --- | --- |
| `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` | Secret | Full service-account JSON key (`sheet-archiver@gen-lang-client-0718938725.iam.gserviceaccount.com`) |
| `GOOGLE_SHEETS_ID` | Secret | `1ptzLKUVnAkyXnT635Zgb1C6Img9aeAZ1se3nRz_QZmI` |
| `GOOGLE_SHEETS_RANGE` | Optional var | Defaults to `Sheet1!A1` |

**Access requirement:** the spreadsheet must be shared with the service
account's `client_email` (Editor role). The integration was verified
end-to-end on 2026-09-21 (live write + read-back).

**Rotation:** to rotate the key, create a new service-account key in Google
Cloud Console, then `gh secret set GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON < new-key.json`.
The private key file is kept locally outside the repo (never commit it).

---

## 4. Restore procedures

**Archive rows → D1:** the CSV/JSON is a faithful copy of `event_archive`.
Re-import via `wrangler d1 execute SITE_CACHE_DB --remote --file=<dump>` if a
database is ever recreated (the table schema lives in
`cloudflare-worker/src/event-archive.ts`).

**DO state:** `do-storage.json` is a key→value map of the DO's entire storage.
Restoring means re-seeding a fresh DO from it — feasible because all large
collections are sharded under stable keys (`analytics_state`,
`analytics_buffer`, `analytics_pending_batches`, `analytics_processed_ids`,
`analytics_website_telemetry`, `analytics_changelog`,
`analytics_uninstall`). Note the DO **rebuilds its live counters from its own
state**, so restoring the DO restores the website's numbers too.

**Website numbers with no Cloudflare at all:** the static site bundle carries
`bootstrap-snapshot.json`; serving `build/` from any static host restores the
public site with real (baked) numbers. Regenerate anytime with
`node website/scripts/generate-bootstrap-snapshot.mjs` (monthly auto-PR via
`.github/workflows/bootstrap-refresh.yml`).

**Not covered:** KV values other than the public snapshot are regenerable by
design (store stats re-scrape, trends recompute from the archive). The
`event_archive` rows themselves are the durable record; the DO buffer (not yet
archived events, up to the batch threshold) is the only window of potential
loss, bounded by the flush schedule.

---

## 5. Related

- Worker pipeline + Oracle-mirror restore runbook: `cloudflare-worker/README.md`
- Legacy architecture docs (`docs/DATA_FLOW_*`, `docs/ARCHITECTURE_EDGE_CACHE_ORACLE.md`)
  describe the retired Oracle-backed pipeline and are kept for history.
