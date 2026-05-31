# 🤖 Project Bots & Automation

> Update (2026-02-28): Latest full-repository scan baseline is documented in /docs/MAJOR_SCAN_2026-02-28.md; deployment/rollout actions are tracked in /docs/DEPLOYMENT_RUNBOOK.md.

This document helps you keep track of the non-human contributors and automation tools installed in this repository.

## 🟢 Active Bots & Integrations

These tools are currently configured and running.

| Bot Name | Role | Related Files |
| :--- | :--- | :--- |
| **Release Drafter** | **Changelog Manager**<br>Automatically categorizes merged PRs and drafts GitHub releases with professional release notes. | • `.github/release-drafter.yml`<br>• `.github/workflows/release-drafter.yml` |
| **Renovate** | **Dependency Manager**<br>Monitors `package.json` for outdated packages and opens PRs to update them. Smarter than Dependabot for monorepos. | • `renovate.json` |
| **Dependabot** | **Dependency Manager**<br>Automated dependency updates (GitHub native). | • `.github/dependabot.yml` |
| **CodeQL** | **Security Guardian**<br>Scans JavaScript/TypeScript code for vulnerabilities (XSS, SQLi, etc.) on every push. | • `.github/workflows/codeql.yml` |
| **Husky + Commitlint** | **Gatekeeper**<br>Runs locally to prevent bad commit messages. Ensures history stays clean for Release Drafter. | • `.husky/`<br>• `commitlint.config.js` |
| **Codecov** | **Coverage Reporter**<br>Posts code coverage reports on PRs, tracks coverage trends, and can block merges if coverage drops. | • `.github/workflows/codecov.yml` |
| **Socket.dev** | **Supply-Chain Security**<br>Scans npm dependencies for malicious packages, typosquats, and supply-chain attacks on every PR. | • `.github/workflows/socket-security.yml` |
| **GitGuardian** | **Secret Leak Detection**<br>Scans every push and PR for leaked secrets (API keys, tokens, passwords) before they reach production. | • `.github/workflows/gitguardian.yml` |
| **Oracle Backend CI** | **Backend Quality Gate**<br>Runs Oracle backend tests, migration bootstrap checks (SQLite + Postgres), gosec, and govulncheck. | • `.github/workflows/oracle-backend-ci.yml` |

## 🤖 AI Agents

The following autonomous AI agents operate on this repository on a weekly schedule.

### PR-Creating Agents (Default)
These agents directly modify code or configuration and submit Pull Requests.

| Agent | Day | Time | Scope |
|-------|-----|------|-------|
| Vex 🔍 | Sunday | 09:00 | extension manifest & permissions |
| Relay ⚙️ | Sunday | 09:30 | extension background service worker |
| Weave 🕸️ | Sunday | 10:00 | extension content scripts |
| Shell 🐚 | Sunday | 10:30 | extension popup UI |
| Vault 🔒 | Sunday | 11:00 | extension storage & analytics |
| Fetch 📡 | Sunday | 11:30 | extension API engines |
| Ink 📝 | Sunday | 12:00 | all-repo documentation |
| Cipher 🔐 | Monday | 09:00 | extension security |
| Flare 🌩️ | Monday | 09:30 | Cloudflare Worker security & performance |
| Gate 🚧 | Monday | 10:00 | Cloudflare routing, DO logic, config |
| Mirror 🪞 | Monday | 10:30 | extension ↔ Cloudflare communication |
| Specter 👻 | Tuesday | 09:00 | extension performance |
| Titan ⚔️ | Tuesday | 09:30 | Oracle backend security |
| Pillar 🏛️ | Tuesday | 10:00 | Oracle reliability & performance |
| Sync 🔄 | Tuesday | 10:30 | extension ↔ Oracle data contracts |
| Lumen 💡 | Wednesday | 09:00 | website performance |
| Aria ♿ | Wednesday | 09:30 | website accessibility |
| Signal 📶 | Wednesday | 10:00 | website SEO |
| Ember 🔥 | Wednesday | 10:30 | extension UX micro-improvements |
| Slate 🧹 | Wednesday | 11:00 | extension code cleanup |
| Sentinel 🛡️ | Friday | 09:00 | security (default) |
| Palette 🎨 | Friday | 09:30 | UX (default) |
| Bolt ⚡ | Friday | 10:00 | performance (default) |
| Quill 🪶 | Saturday | 09:00 | extension unit test gaps |
| Forge 🔨 | Saturday | 09:30 | extension integration & e2e test gaps |
| Compass 🧭 | Saturday | 10:00 | website test gaps |
| Bastion 🏰 | Saturday | 10:30 | Cloudflare & Oracle test gaps |

### Issue-Creating Agents
These agents analyze code and architecture to suggest improvements via Issues.

| Agent | Day | Time | Scope |
|-------|-----|------|-------|
| Sage 🌿 | Thursday | 09:00 | extension feature suggestions |
| Muse 🎭 | Thursday | 09:30 | website suggestions |
| Oracle 🔮 | Thursday | 10:00 | Oracle backend suggestions |
| Horizon 🌅 | Thursday | 10:30 | cross-cutting architecture suggestions |
| Refine ✨ | Thursday | 11:00 | tech debt suggestions |

### 📓 Journal System
Each agent maintains a journal in the `.jules/` directory (e.g., `.jules/ink.md`). These journals track what the agent did on its last run, what it learned, and any open issues it discovered. Always review relevant journals to understand context.
