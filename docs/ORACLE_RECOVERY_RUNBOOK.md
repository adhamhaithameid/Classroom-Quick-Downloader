# Oracle Recovery Runbook

Consolidated from the INFRA-1 scans, `bd` issue `Classroom-Quick-Downloader-4h1`,
and fresh read-only probes (2026-09-12 ~23:00 local). Human-only steps are
marked **[CONSOLE]** — they need Oracle Cloud dashboard access that agents do
not have. Do not attempt VM repairs over SSH until the network path is back.

## Current state (probed 2026-09-12)

| Check | Result |
| --- | --- |
| `oracle.classroom-quick-downloader.com` | UNREACHABLE (connect failure, <1s) |
| VM `129.151.233.229` | hard-down since ≥ 2026-09-06: 100% packet loss, TCP 22/80/443/8080 all time out at SYN |
| Worker `/health` | HTTP 429, error 1027 (Cloudflare **free-plan daily request cap**) |
| Worker `/api/public/website/snapshot` | HTTP 429, error 1027 |
| Worker DO backlog | ~1797 pending events; last successful flush ≈ 2026-08-14 |
| Website user impact | homepage counters fall back to `static/data/bootstrap-snapshot.json` (static numbers) — graceful, but stale |

Two independent problems; fix both.

## Problem 1 — Oracle VM hard-down

**Root cause (most likely):** instance stopped/preempted or network security
change. Cannot be distinguished without console access.

**Recovery steps:**

1. **[CONSOLE]** Oracle Cloud → Compute → instance for `129.151.233.229`:
   note instance state (STOPPED vs RUNNING vs TERMINATED).
2. **[CONSOLE]** If STOPPED: Start instance. If TERMINATED: restore from
   boot-volume backup (check Backup policies first) or recreate from the
   `oracle-backend/` deploy docs and re-deploy.
3. **[CONSOLE]** Networking → verify Security List / NSG ingress allows
   TCP 22, 80, 443, 8080 from 0.0.0.0/0 (or the Worker's egress ranges).
4. Verify from local: `ping 129.151.233.229` (ICMP may be blocked — use
   `nc -vz 129.151.233.229 8080` instead).
5. **[CONSOLE/SSH]** `ssh ubuntu@129.151.233.229` → `docker ps` → if the
   oracle container is not running:
   `docker start cqd-oracle-backend` (or `docker compose up -d` in
   `~/Classroom-Quick-Downloader/oracle-backend`).
6. Check disk: `df -h` (a full disk is the classic silent killer).
7. Verify: `curl -m 5 https://oracle.classroom-quick-downloader.com/health`
   returns 200.

**Rollback/backup path:** if the instance cannot be revived, the Oracle is
stateless-plus-Sheets (aggregate store) — redeploy from repo and replay the
Worker's queued/DLQ events; no user data is lost because none is collected.

## Problem 2 — Worker free-plan 429 (error 1027)

The Worker now hits Cloudflare's daily request cap; until addressed, public
endpoints 429 for **all** visitors each day once the cap is consumed.

Mitigations, in order of effort:

1. **Upgrade the Workers plan** (paid tier removes the 1027 cap) — immediate,
   costs money.
2. **Reduce request volume**: the extension's `/track` flush cadence and the
   website's 15s batch flush are the two traffic sources; raising batch sizes /
   intervals cuts requests proportionally.
3. ~~**Edge-cache the snapshot**~~ — **already implemented**: `/api/public/website/snapshot`
   routes through the same cache-aware handler as `/api/site/v1/snapshot`
   (hit/revalidate/stale with `s-maxage=300`), so snapshot reads are already
   shared across visitors. The remaining cap consumers are the ingest POSTs
   (`/track`, `/api/public/website/events`) which are not cacheable, plus
   extension flush volume — tune cadence only with production request data.
4. Keep the existing static fallback as the last line of defense (already
   works).

## Post-recovery verification

1. `curl https://oracle.classroom-quick-downloader.com/health` → 200.
2. Worker `/health` → 200 (outside 429 windows).
3. Worker `/api/public/website/snapshot` → 200 with `schemaVersion: "1"`.
4. Replay queued work: `POST /admin/website/replay-dlq` (admin auth), then
   confirm `pendingEvents` drains on subsequent status checks.
5. Watch one full website flush cycle; confirm `lastFlushAt` advances.
6. Website homepage counters return to live values (no longer the static
   fallback).

## Monitoring

- `https-endpoint-monitor.yml` workflow already probes endpoints — confirm it
  covers the Oracle domain and alerts on failure.
- Add the 1027/429 status to the monitor so plan-cap exhaustion is visible
  before users notice.
