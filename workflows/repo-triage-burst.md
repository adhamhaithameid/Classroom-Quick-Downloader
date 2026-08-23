# Workflow: Repo Triage Burst

> Status: **approved spec** (grilled 2026-08-22, all decisions settled)
> Loop: weekly weekend sweep of CQD repo operations
> Executor: local agent session (v1)

## Purpose

Replace the ad-hoc weekend sweep (Renovate PRs closed one-by-one, CI failures
discovered late) with one decision-ready brief and a single approval round.

## Trigger

1. **Manual**: the user types `triage` (or `/triage`) in an agent session inside
   the CQD repo.
2. **Schedule**: Saturdays 09:00 Africa/Cairo via macOS launchd
   (`StartCalendarInterval`) — launchd coalesces missed fires after sleep, so
   an off Mac runs triage on wake. Both triggers execute the identical procedure.

## One-time setup (implementer performs once, guides user)

1. User creates a Telegram bot via @BotFather → token.
2. User messages the bot once; implementer resolves `chat_id` via
   `getUpdates`.
3. Store both in `~/.config/cqd-workflows/telegram.env` as
   `TELEGRAM_BOT_TOKEN=` / `TELEGRAM_CHAT_ID=` (OUTSIDE the repo; never commit).
4. Verify: send test message "triage channel live".

## Procedure

### Step 1 — Gather (read-only, parallel where possible)

Repo: `adhamhaithameid/Classroom-Quick-Downloader`. All reads via `gh` CLI.

| # | Source | Command sketch | Extract |
|---|--------|----------------|---------|
| 1 | Renovate PRs | `gh pr list --author "renovate[bot]" --state open --json number,title,statusCheckRollup,updatedAt` | per PR: bump type from title (major/minor/patch/pin/digest), checks green/red/pending |
| 2 | CI failures | `gh issue list --label ci-failure --state open` | title, age, run link |
| 3 | Ready beads | `bd ready` | top 5 by priority |
| 4 | Stale PRs | open PRs w/ `updatedAt` older than 14 days (non-Renovate included) | number, title, age |
| 5 | Release drafts | `gh release list --draft` | tag name, created date |
| 6 | Monitor alerts | latest `https-endpoint-monitor.yml` runs since `.workflow-state/triage-last-run.json` timestamp | failed runs + endpoint names |

State: read/write `.workflow-state/triage-last-run.json` (UTC timestamp of this
run's start) — used only for item 6's "since" window.

### Step 2 — Compose brief

Hard format (enforced):

- ONE Telegram message, ≤40 lines.
- Sections in order: 🔴 **Needs decision** · 🟡 **Ready to merge** · 🔵 **FYI**.
- Every actionable line ends with its item number, e.g. `[go 3]`.
- Each 🟡 line: `PR <num> <dep> <from>→<to> (<bump>) — checks ✅ — [go N]`.
- Each 🔴 line: what's broken + recommended action (see Action table).
- 🔵 lines are informational only, never numbered.

Classification rules:

- 🟡 = Renovate PR, bump ∈ {patch, minor, pin, digest}, ALL required checks green.
- 🔴 = any CI failure issue; any monitor failure; major-bump PRs (recommendation:
  "hold, review manually"); stale PRs (recommendation: "close with comment").
- 🔵 = beads ready, release drafts, anything else observed worth 1 line.

### Step 3 — Send

POST `https://api.telegram.org/bot<token>/sendMessage`
(`chat_id`, `text`, `disable_web_page_preview=true`).

**Fallback**: if the send fails twice → write the brief verbatim to
`briefs/<YYYY-MM-DD>-triage.md` beside this workflow dir and tell the user the
path in the session. Never silently drop a brief.

### Step 4 — Checkpoint (the ONE human touchpoint)

User replies in-session (or in Telegram, relayed): `go all` · `go 1 2 4` ·
`go none` · or free-text overrides ("go 2 but keep firefox").

Parse: numbers map to brief items. Ambiguity → ask once, then proceed.

### Step 5 — Execute approvals

Action table (only these actions exist; anything else → file a bead instead):

| Item kind | On `go N` |
|-----------|-----------|
| Renovate PR (green, safe bump) | `gh pr merge <num> --squash --auto --delete-branch` (`--auto` keeps GitHub enforcing checks) |
| Major-bump PR | NEVER merged. Only allowed action: file a bead titled `Review major bump: <dep>` |
| CI-failure issue | File a bead linking the issue + run URL (never auto-close) |
| Monitor failure | Same as CI-failure issue handling |
| Stale PR | `gh pr close <num> --comment "Closing as stale — revive anytime"` |
| Release draft | No executable action (manual store uploads) — restated as FYI |

Rails (absolute): no force-push, no direct pushes to main, no merges without
required-green status, no deletions of issues/releases.

### Step 6 — Receipt

Send one follow-up Telegram message: `Applied ✓ <n> items` + one line each
(done/skipped/why) + new `bd` IDs created. Update
`.workflow-state/triage-last-run.json`.

## Done criteria

A fresh agent, given only this file, executes `triage` end-to-end without asking
a question: brief lands ≤2 min, approvals apply correctly, receipt arrives,
state advances.

## Out of scope (deliberate)

Store dashboards, telemetry review, university/university-portal scanning,
auto-scheduling via GitHub Actions (migration path if local trigger proves
unreliable).

---
### Amendment v2 (2026-08-22, post-review)
- Brief fallback path is `workflows/briefs/` (beside this spec).
- Free-text override parsing ("keep firefox") is DEFERRED to the Phase-2
  chatbot; until then unparsable replies trigger exactly one clarifying re-ask,
  then abort without executing.
- CI-failure beads link the issue AND the latest failed ci.yml run URL.
