# Plan: Weekly flush mode + uninstall stats flush

Date: 2026-09-17. Status: approved. Mode: TDD, NO git commits (user commits at end).

## Goal

Extension analytics: ~1 counted request per user per week (from ~1-2/day). Free-tier
blocker becomes unreachable from extension traffic.

## Design (user-locked)

- Weekly send at local 00:00 (user timezone) + per-week random jitter 0-119 min
  (persisted meta `weeklyOffsetMinutes`, regenerated per slot).
- Missed slot fires on next flush tick/startup (max lateness ~24h+jitter). Browser
  closed for weeks -> one catch-up send, schedule advances one slot.
- Empty queue at due time: no request, but slot key advances.
- Weekly mode disables ALL other flush triggers (daily window, 24h staleness, batchSize
  overflow, 500-queue urgency bypass, time-based). 5-min tick alarm stays (evaluator).
  remoteEnabled=false still kills all sends.
- Full drain at send: batches <=5000, loop until empty (cap 10 POSTs/tick). Slot key
  advances only on success; failures use existing backoff.
- Uninstall: no pre-uninstall hook exists in browsers. setUninstallURL refreshed at
  startup + after each flush carries compact stats (?v&d&a, length-capped); website
  uninstall page parses params, emits one extension_uninstall telemetry event.
- Config-driven rollout: DO default configFlushMode = 'weekly' (new value). Old
  extensions clamp unknown -> next_day (daily), unaffected. /admin/update-config
  accepts weekly. Send hour fixed 00:00 local, not configurable.
- Website traffic: out of scope.

## Tasks

T1 weekly schedule core (extension pure functions + tests: slot calc, jitter,
  due-check, empty-queue advance; meta fields lastWeeklyFlushSlotKey,
  weeklyOffsetMinutes; config flushMode += 'weekly').
T2 flush decision + drain (getFlushDecision weekly mode, isUrgent=weeklyDue, drain
  loop cap 10, startup Analytics.flush() in background/index.ts, types).
T3 config plumbing (DO default weekly, normalizeFlushMode accepts weekly on DO +
  extension, update-config accepts weekly, old-client fallback verified, update
  worker tests pinning next_day).
T4 uninstall stats flush (extension setUninstallURL builder + refresh points;
  website routes/uninstall/+page.svelte param parsing + event emission).
T5 closure (full suites, tickets, report + deploy checklist).

## Constraints

No commits/pushes. bd writes OK. Old-extension compat: unknown flushMode -> daily.
Queue format, local stats, idempotency, backoff unchanged. No website telemetry
changes beyond uninstall-page params.
