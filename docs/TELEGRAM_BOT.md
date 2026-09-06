# CQD Telegram Bot — Complete Reference

**Bot:** [@CQDEGithubbot](https://t.me/CQDEGithubbot) · **Since:** 2026-08-22
**Implementation:** `workflows/scripts/repo_triage.py` (Python 3 stdlib only)
**Credentials:** `~/.config/cqd-workflows/telegram.env` (outside the repo, chmod 600)

---

## Why it exists

Every operational fact about the CQD project — PRs, CI failures, security
alerts, dependency updates, plans, releases, endpoint health, product metrics —
was scattered across GitHub, dashboards and terminal commands. The bot collapses
all of it into one Telegram chat: a scheduled weekly burst that asks for ONE
approval, plus on-demand queries answered whenever the Mac is awake.

## Architecture

```
┌──────────────┐  long-poll   ┌────────────────────────┐   read    ┌───────────────┐
│ your phone   │─────────────▶│ repo_triage.py --serve │──────────▶│ GitHub API    │
│ (Telegram)   │◀─────────────│ (launchd KeepAlive,    │           │ (gh CLI auth) │
└──────────────┘   replies    │  local Mac only)       │◀──────────│ Beads (bd)    │
                              └────────────────────────┘   read    ├───────────────┤
                                      │                            │ HTTP probes   │
                                      ▼ applies approved actions   │ site/worker/  │
                                merges · closes · beads            │ oracle        │
                                                                   └───────────────┘
```

- **Reachability**: daemon answers while the Mac is awake; commands sent while
  asleep queue in Telegram (24h retention) and are answered on wake.
- **Writes** happen ONLY through the `/triage` approval flow, behind hard rails.

## Command reference

| Command | Answers |
|---|---|
| `/status` | one-screen overview: PR counts, CI failures, security totals, beads, drafts, recent failures |
| `/prs` | every open PR — 🤖 dep-bot vs 👤 human, ✅/❌/⏳ checks, age, bump type |
| `/issues` | open issues, ci-failure first |
| `/security` | Dependabot alerts (by severity), CodeQL alerts, secret-scanning alerts |
| `/deps` | pending library updates by bump type; majors listed individually |
| `/runs` | recent failed workflow runs |
| `/plans` | beads: total/ready/blocked + ready list |
| `/releases` | releases + pending drafts |
| `/endpoints` | health matrix: marketing site, worker `/health`, oracle public API (HTTP code + latency) |
| `/metrics` | live product telemetry from the public snapshot API (downloads/success/fail, installs) |
| `/versions` | version fields across monorepo packages + latest release tag |
| `/deploys` | recent deploy workflow results (website, worker, oracle dashboard, pages) |
| `/access` | exactly what the bot can read/write and with which credentials |
| `/triage` | full Saturday-style burst inline: brief → `go N` approval → execution → receipt |
| `/help` | the command table |

## What the bot can access (inventory)

### Reads freely (no extra credentials — uses your local `gh` auth + public HTTP)

| Surface | Via | Data |
|---|---|---|
| GitHub PRs/issues/releases/runs | `gh` CLI (your admin token) | everything visible on github.com |
| Dependabot / CodeQL / secret-scanning alerts | `gh api repos/:owner/:repo/…` | alert counts, severities, packages |
| Plans | `bd` CLI (local Dolt DB) | beads: ready/blocked/total, priorities |
| Marketing site | `PUBLIC_SITE_URL` (repo variable) | HTTP status + latency |
| Cloudflare Worker | `PUBLIC_WORKER_BASE_URL` | `/health`, public events API reachability |
| Oracle backend | `PUBLIC_ORACLE_API_BASE_URL` | public snapshot API, status codes |
| Product telemetry | worker/oracle public snapshot endpoint | downloads/success/fail/cancelled totals, installs |
| Repo variables | `gh variable list` | endpoint URLs, verification values |
| Versions | local `package.json` files | monorepo version matrix |

### Writes (only after your explicit `go N`)

- Squash-merge dependency-bot PRs (`--auto`, green checks enforced by GitHub)
- Close stale PRs with a revival comment
- File investigation beads for CI/monitor/security surprises

### Never touches (hard fences)

- University account data · personal Gmail CONTENT (metadata-level only, by policy)
- Store dashboards (Chrome/Edge — no usable APIs; AMO covered by release workflow)
- Secrets values (`gh secret list` names only; values unreadable by design)
- Anything requiring Cloudflare dashboard tokens (not provisioned to the bot)

## Scheduled behavior

| When | What |
|---|---|
| Saturdays 09:00 Africa/Cairo (launchd, runs-on-wake) | full triage burst → Telegram brief → await `go` ≤1h → execute → receipt |
| Anytime you type `triage` (agent session) or `/triage` (Telegram) | same burst immediately |

Install both: `bash workflows/scripts/install_launchd.sh --with-daemon`

## Roadmap

### Phase 2 — conversational chatbot (designed, not yet built)
- Gemini flash (`GEMINI_API_KEY`, free tier) receives: your natural-language
  question + compact JSON summaries produced by the SAME gatherer functions
  this bot already uses (function-calling pattern, not raw repo dumps).
- System prompt fences: answer in English; read-only; never echo secrets;
  refuse non-repo topics; cap output length.
- Free-tier aware: cache gatherer results for 60s; one model call per question;
  fall back to command-table answers when quota/rate-limited.
- Kill switch: `BOT_CHAT_MODE=off` in the env file disables the feature.
- New seam today: every command handler is a pure `fmt_*()` over gatherers —
  the chatbot layer becomes "choose gatherers → summarize", nothing else.

### Phase 3 — candidates
- Store-listing stats (needs Chrome WebStore OAuth refresh token — bead mj3)
- Cloudflare analytics via API token (if ever provisioned)
- Proactive push alerts (endpoint failure → immediate ping, not just next burst)
