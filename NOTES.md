# NOTES — Adham's world (raw, sharpened over time)

*Confirmed in grilling Round 1 (2026-08-22) unless marked OBSERVED/unconfirmed.*

## Identity & context
- CS student (university in Egypt; exam seasons spike workload). Arabic RTL background.
- Solo maintainer of **Classroom Quick Downloader (CQD)** — browser extension
  (Chrome/Firefox/Edge stores) + Cloudflare Worker + Go backend + SvelteKit site.
- Heavy agent user: opencode agents, Jules automation, beads tracker.

## Confirmed loops (Round 1)
1. **CQD repo ops** — weekly weekend burst; daily-ish notification glances.
2. **Release ritual** — bump → merge → manual `v*` tag → AMO auto-publishes →
   manual Chrome/Edge uploads → publish draft.
3. **University cycle** — semester currently light; exams loom.
4. Career/portfolio — NOT a loop; trigger-driven only ("when something triggers it").

## Channels actually processed
- GitHub notifications ✓ · Gmail ✓ · University portal ✓
- Store dashboards: only when something breaks. WhatsApp groups: skimmed.
- Candidate output channels: **email OR Telegram OR WhatsApp** (pick one in Round 2).

## Repetition scars (strongest loop candidates)
- Closing Renovate PRs one-by-one.
- Writing session logs (already habitual).

## Operating preferences (confirmed)
- Autonomy: **push-right** — maximal prep, ONE late checkpoint, decision-ready brief.
- Output lands in: messaging (email/Telegram/WhatsApp).
- Privacy fence (HARD): university account data OUT; personal email CONTENT out;
  metadata-level awareness OK; store dashboards + telemetry fully allowed.

## Grilling decisions
- Spec #1: **Repo triage burst** (grill to implementer-ready depth).
- Spec #2: Release ritual — sketch only, behind #1.
- After specs settle: /implement may build them.

## Canonical terms
- **Repo triage burst**: the weekend sweep of Renovate PRs, CI failures,
  open beads, and anything needing an owner decision.
- **Brief**: the single decision-ready message ending a checkpoint.
- **Go receipt**: user's `go all` / `go 1 2 4` approval; executor applies and
  posts an applied-receipt.

## Grilling state (Round 3 — CLOSED)
- All questions resolved. Frontier empty.
- `workflows/repo-triage-burst.md` — implementer-ready (spec #1).
  Trigger: manual `triage` + Saturday 09:00 Cairo launchd. Channel: Telegram
  (fallback: local briefs/ file). Checkpoint: approve-to-execute w/ rails.
- `workflows/release-ritual.md` — sketch only (spec #2), promotion blocked on
  3 open questions listed inside.
- One-time user setup pending: @BotFather token + chat_id →
  ~/.config/cqd-workflows/telegram.env
