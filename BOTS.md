# 🤖 Project Bots & Automation

This document helps you keep track of the non-human contributors and automation tools installed in this repository.

## 🟢 Active Bots & Integrations

These tools are currently configured and running.

| Bot Name | Role | Related Files |
| :--- | :--- | :--- |
| **Release Drafter** | **Changelog Manager**<br>Automatically categorizes merged PRs and drafts GitHub releases with professional release notes. | • `.github/release-drafter.yml`<br>• `.github/workflows/release-drafter.yml` |
| **Renovate** | **Dependency Manager**<br>Monitors `package.json` for outdated packages and opens PRs to update them. Smarter than Dependabot for monorepos. | • `renovate.json` |
| **Dependabot** | **Dependency Manager**<br>Automated dependency updates (GitHub native). | • `.github/dependabot.yml` (if configured) |
| **CodeQL** | **Security Guardian**<br>Scans JavaScript/TypeScript code for vulnerabilities (XSS, SQLi, etc.) on every push. | • `.github/workflows/codeql.yml` |
| **Husky + Commitlint** | **Gatekeeper**<br>Runs locally to prevent bad commit messages. Ensures history stays clean for Release Drafter. | • `.husky/`<br>• `commitlint.config.js` |
