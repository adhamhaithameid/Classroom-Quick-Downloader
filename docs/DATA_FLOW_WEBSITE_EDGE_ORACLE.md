# Data Flow: Website <-> Edge <-> Oracle

## 1. Scope
Covers production website data movement and telemetry ingestion flow.

## 2. Read Flows
### 2.1 Public Metrics Snapshot
- Website calls: `GET /api/site/v1/snapshot`
- Worker:
  - serves KV cached snapshot when present
  - otherwise fetches Oracle snapshot and caches result
- Oracle source endpoint: `/api/public/website/snapshot`

### 2.2 Public Privacy Summary
- Website/clients call: `GET /api/site/v1/privacy`
- Worker sources privacy block from Oracle snapshot and responds with public-safe payload.

## 3. Write Flows
### 3.1 Website Events
- Website posts: `POST /api/site/v1/events`
- Payload includes `schemaVersion`, `sessionId`, `pagePath`, and bounded `events[]`.
- Worker forwards/queues for Oracle ingest pipeline.

### 3.2 Uninstall Feedback
- Website posts uninstall feedback through worker public route.
- Oracle stores and exposes aggregate uninstall stats.

## 4. Snapshot Pinned-Session Behavior
- On first load, website hydrates session/local/bootstrap snapshot.
- During current tab session:
  - displayed metrics remain fixed
  - newer snapshot is staged for next refresh
- On refresh/reopen:
  - staged/latest snapshot becomes active.

## 5. Freshness and Cadence
- Edge refresh schedule reads Oracle on fixed 3-hour slots.
- Export/flush slots run at offset +1 hour.
- Public UI reflects the active snapshot, not live-streamed counters.

## 6. Failure Modes
- Worker unavailable: website falls back to last-good session/local snapshot.
- Oracle unavailable during worker pull: previous cache remains served until next successful refresh.
- Write failures: retry path and DLQ/replay mechanism handle deferred delivery.

## 7. Verification Checklist
- `pnpm -C website test`
- `pnpm -C cloudflare-worker test`
- `cd oracle-backend && go test ./...`
- `pnpm run test:smoke`
- `pnpm run test:security:all`
