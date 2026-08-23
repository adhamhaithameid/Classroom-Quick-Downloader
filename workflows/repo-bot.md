# Workflow: Repo Bot (Telegram companion — approved spec)

> Status: **approved** (extends repo-triage-burst; grilled 2026-08-22)
> Loop: continuous repo awareness — scheduled digests + on-demand queries.
> Executor: local daemon on the user's Mac (`--serve`, launchd KeepAlive).

## Purpose

One Telegram bot that knows everything knowable about the CQD repo and answers
any time: PRs, issues, plans (beads), CI/Action runs, security alerts,
dependency updates, releases, endpoint health — plus the Saturday triage burst.

## Reachability contract (honest)

The daemon runs only while the Mac is awake. Commands sent while asleep are
retained by Telegram (getUpdates 24h window) and answered on wake. For 24/7
answering, migrate to a GitHub Action responder later (out of scope v1).

## Setup (one-time)

Same credentials as triage: `~/.config/cqd-workflows/telegram.env`
(`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) — created once via @BotFather.

## Modes

1. **Burst** (unchanged): Saturdays 09:00 Cairo via launchd + manual `triage`.
   See repo-triage-burst.md.
2. **Daemon**: `python3 workflows/scripts/repo_triage.py --serve`
   Long-polls Telegram, replies to commands, persists update offset in
   `.workflow-state/` so restarts never replay old commands.

## Command table (daemon)

| Command | Answers with |
|---------|--------------|
| `/status` (or plain `status`) | overview: open PRs (by class), failing runs, open security alert counts, ready beads, drafts, last burst age |
| `/prs` | every open PR: number, title, author class (renovate/human), checks state, age |
| `/issues` | open issues grouped: ci-failure first, then newest 10 |
| `/security` | Dependabot alerts (by severity), CodeQL alerts, secret-scanning alerts — counts + top items |
| `/deps` | Renovate PRs by bump type + any open dependency-backlog issue |
| `/runs` | last 8 failed workflow runs (name, when) |
| `/plans` | beads: totals by state, ready list (top 5), blocked count |
| `/releases` | latest releases + pending drafts |
| `/triage` | runs the full burst flow inline (brief → go approval → execute) |
| `/help` | the command table |

Unknown text → help. Every reply ≤ 40 lines, `disable_web_page_preview`.

## Data sources (all read-only, gh CLI / Telegram API)

- `gh pr list` (+statusCheckRollup), `gh issue list`, `gh release list`,
  `gh run list`, `gh api repos/:owner/:repo/dependabot/alerts`,
  `gh api .../code-scanning/alerts`, `gh api .../secret-scanning/alerts`,
  `bd list` / `bd ready`.
- Errors degrade to "source unavailable" lines — a missing source never kills
  the whole reply.

## Rails

Read-only daemon: NO write actions except the explicit `/triage` approval flow,
which enforces repo-triage-burst.md's rails verbatim.

## Done criteria

With the Mac awake: send `/security` from the phone → correct answer ≤10s.
Send a command while asleep → answered automatically on wake.
