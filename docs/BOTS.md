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
| **Google Jules** | **AI Maintenance Agents**<br>Runs scheduled owner-controlled agents that create focused PRs, Issues, or no-op reports for extension, Worker, Oracle, website, docs, tests, and planning work. | • `.github/agents/jules/`<br>• `.jules/` |

## Google Jules Agent Schedule

Jules is configured in the Jules web app. The repository stores public-safe prompt copies and operating docs in `.github/agents/jules/`.

| Agent | Day | Time | Jules Task Name | Output | Scope |
|-------|-----|------|-----------------|--------|-------|
| Vex | Sunday | 09:00 | `Vex — Manifest & Permissions Audit` | PR | Extension manifest, permissions, CSP |
| Relay | Sunday | 09:30 | `Relay — Background Service Worker` | PR | Extension background service worker |
| Weave | Sunday | 10:00 | `Weave — Content Scripts` | PR | Extension content scripts |
| Shell | Sunday | 10:30 | `Shell — Popup UI` | PR | Extension React popup |
| Vault | Sunday | 11:00 | `Vault — Storage & Analytics` | PR | Extension storage and analytics pipeline |
| Fetch | Sunday | 11:30 | `Fetch — API Engines` | PR | Extension v3 API layer and engines |
| Ink | Sunday | 12:00 | `Ink — Documentation` | PR | Repository documentation |
| Axle | Sunday | 12:30 | `Axle — Engine v1/v2 Maintenance` | PR | Extension v1/v2 engines and user bug fixes |
| Cipher | Monday | 09:00 | `Cipher — Extension Security` | PR | Extension security |
| Flare | Monday | 09:30 | `Flare — Cloudflare Security` | PR | Cloudflare Worker security |
| Gate | Monday | 10:00 | `Gate — Cloudflare Routing & Config` | PR | Cloudflare routing, Durable Objects, config |
| Mirror | Monday | 10:30 | `Mirror — Communication Layer` | PR | Extension to Worker communication boundary |
| Watch | Monday | 11:00 | `Watch — CI/CD Health` | Issue | GitHub Actions and dependency automation |
| Specter | Tuesday | 09:00 | `Specter — Extension Performance` | PR | Extension runtime performance |
| Titan | Tuesday | 09:30 | `Titan — Oracle Security` | PR | Oracle backend security |
| Pillar | Tuesday | 10:00 | `Pillar — Oracle Reliability` | PR | Oracle DB, observability, relay |
| Sync | Tuesday | 10:30 | `Sync — Data Contracts` | PR | Extension to Oracle data contracts |
| Lexicon | Tuesday | 11:00 | `Lexicon — Translation Completeness` | PR/Issue | Extension translations |
| Lumen | Wednesday | 09:00 | `Lumen — Website Performance` | PR | Website performance |
| Aria | Wednesday | 09:30 | `Aria — Website Accessibility` | PR | Website accessibility |
| Signal | Wednesday | 10:00 | `Signal — Website SEO` | PR | Website SEO |
| Ember | Wednesday | 10:30 | `Ember — Extension UX` | PR | Extension content UI and user feedback |
| Slate | Wednesday | 11:00 | `Slate — Extension Code Cleanup` | PR | Extension code quality |
| Stamp | Wednesday | 11:30 | `Stamp — Version Consistency` | PR/Issue | Component version consistency |
| Sage | Thursday | 09:00 | `Sage — Extension Suggestions` | Issue | Extension feature suggestions |
| Muse | Thursday | 09:30 | `Muse — Website Suggestions` | Issue | Website content, design, conversion |
| Oracle | Thursday | 10:00 | `Oracle — Backend Suggestions` | Issue | Oracle backend suggestions |
| Horizon | Thursday | 10:30 | `Horizon — Architecture Suggestions` | Issue | Cross-component architecture |
| Refine | Thursday | 11:00 | `Refine — Tech Debt Suggestions` | Issue | Repository-wide technical debt |
| Apex | Thursday | 11:30 | `Apex — v3 Engine Planning` | Issue | v3 engine roadmap |
| Atlas | Thursday | 12:00 | `Atlas — Plan Consolidation` | PR/Issue | PLAN.md, archive, journals |
| Reach | Thursday | 12:30 | `Reach — Growth & Distribution` | Issue | Free growth and distribution |
| Sentinel | Friday | 09:00 | Jules default security agent | PR | Repository-wide security |
| Palette | Friday | 09:30 | Jules default UX agent | PR | Repository-wide UX |
| Bolt | Friday | 10:00 | Jules default performance agent | PR | Repository-wide performance |
| Quill | Saturday | 09:00 | `Quill — Extension Unit Tests` | PR | Extension unit tests |
| Forge | Saturday | 09:30 | `Forge — Extension Integration & E2E Tests` | PR | Extension integration and E2E tests |
| Compass | Saturday | 10:00 | `Compass — Website Tests` | PR | Website tests |
| Bastion | Saturday | 10:30 | `Bastion — Cloudflare & Oracle Tests` | PR | Cloudflare Worker and Oracle tests |

## Jules Guardrails

- Jules PRs are internal, owner-controlled automation PRs.
- External PRs remain unsupported under the project contribution policy.
- Prompt bodies are stored in `.github/agents/jules/prompts/`.
- Agent journals belong in `.jules/` and must never contain secrets.
- Jules API keys must not be committed; use `JULES_API_KEY` only from local environment or secrets if API automation is added later.
