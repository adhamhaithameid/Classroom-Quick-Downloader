# 🤖 Project Bots & Automation

> Update (2026-02-15): Latest changes include CI coverage-gate hardening for extension analytics storage migration fallback, popup stats race-condition guards, structured step-up auth error handling in Oracle dashboard, and backend/worker auth-security hardening. See /CHANGELOG.md for details.

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
