# Docs Index

One line per document. Statuses: **Current** (trust it), **Dated** (point-in-time
report — verify against code before acting), **Legacy/Superseded** (kept for
history; the live path is elsewhere). When you add a doc, add its line here.
Historical/point-in-time files live in `archive/`.

## Start here

- [ARCHITECTURE.md](ARCHITECTURE.md) — system overview: extension, website, worker, data flow
- [DEVELOPMENT.md](DEVELOPMENT.md) — local setup and day-to-day commands
- [TESTING.md](TESTING.md) — testing guide across all workspaces
- [EXTENSION_TESTING_RUNBOOK.md](EXTENSION_TESTING_RUNBOOK.md) — extension verification layers, fixtures, CI expectations
- [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) — how production deploys work (updated 2026-09 for the Oracle-free pipeline)
- [BACKUPS.md](BACKUPS.md) — backup sheet, Google Sheets export, restore procedures

## Architecture & data flow

- [ARCHITECTURE_RUNTIME_CONTRACT.md](ARCHITECTURE_RUNTIME_CONTRACT.md) — runtime contract between extension and worker
- [ARCHITECTURE_EDGE_CACHE_ORACLE.md](ARCHITECTURE_EDGE_CACHE_ORACLE.md) — **Legacy**: pre-retirement edge-cache + Oracle design
- [DATA_FLOW_WORKER_ORACLE_WEBSITE.md](DATA_FLOW_WORKER_ORACLE_WEBSITE.md) — **Superseded** (banner in file): Oracle-era pipeline
- [DATA_FLOW_WEBSITE_EDGE_ORACLE.md](DATA_FLOW_WEBSITE_EDGE_ORACLE.md) — **Superseded** (banner in file): Oracle-era pipeline
- [ANALYTICS_EVENTS.md](ANALYTICS_EVENTS.md) — analytics event inventory (privacy audit)
- [API_DOWNLOAD_TIER.md](API_DOWNLOAD_TIER.md) — API-based download tier design
- [TWO_LANGUAGE_SIGNALS.md](TWO_LANGUAGE_SIGNALS.md) — browser locale vs page language; where each is consumed

## Operations & runbooks

- [RUNBOOK_DEPLOYMENT.md](RUNBOOK_DEPLOYMENT.md) — **Dated** (2026-03): operator playbook; Oracle sections predate retirement
- [RUNBOOK_INCIDENT_RESPONSE.md](RUNBOOK_INCIDENT_RESPONSE.md) — incident response playbook
- [CLOUDFLARE_OPERATIONS_ANALYSIS_2026-10-01.md](CLOUDFLARE_OPERATIONS_ANALYSIS_2026-10-01.md) — quota/operations analysis after the 1027 incident
- [MANUAL_CHANGELOG_OPERATIONS.md](MANUAL_CHANGELOG_OPERATIONS.md) — operating the two manual changelogs
- [SEO_DEPLOY_CHECKLIST.md](SEO_DEPLOY_CHECKLIST.md) — post-deploy SEO checks
- [SEO_WEEKLY_MAINTENANCE.md](SEO_WEEKLY_MAINTENANCE.md) — weekly SEO routine
- [ai-visibility-log.md](ai-visibility-log.md) — AI/search visibility log
- [LAUNCH_PACKAGE.md](LAUNCH_PACKAGE.md) — launch & distribution checklist
- [STORE_LISTINGS.md](STORE_LISTINGS.md) — store listing copy (ASO)
- [SAFARI_DISTRIBUTION_RUNBOOK.md](SAFARI_DISTRIBUTION_RUNBOOK.md) — **Dated**: Safari distribution (temporarily disabled)
- [ORACLE_RECOVERY_RUNBOOK.md](ORACLE_RECOVERY_RUNBOOK.md) — **Dated**: only for deliberately restoring the severed Oracle backend
- [ORACLE_EXPANSION_PLAN.md](ORACLE_EXPANSION_PLAN.md) — **Superseded**: Oracle expansion (system retired from live path 2026-09)
- [BOTS.md](BOTS.md) — project bots & automation
- [TELEGRAM_BOT.md](TELEGRAM_BOT.md) — Telegram bot reference

## Engine

- [ENGINE_V4_MASTER_PLAN.md](ENGINE_V4_MASTER_PLAN.md) — engine epic plan (V4, 2026 H2)
- [ATTACHMENT_CLASSIFICATION_DESIGN_NOTE.md](ATTACHMENT_CLASSIFICATION_DESIGN_NOTE.md) — attachment classification design
- [EXTENSION_GOLDEN_BEHAVIOR_MATRIX.md](EXTENSION_GOLDEN_BEHAVIOR_MATRIX.md) — golden behavior matrix
- [PHASE12_TEST_MATRIX.md](PHASE12_TEST_MATRIX.md) — phase 12 strict/comprehensive matrix
- Subdirectory [engine/](engine/) — API-assist setup, mutation/selector audits

## Testing & QA

- [E2E_BROWSER_MATRIX.md](E2E_BROWSER_MATRIX.md) — which browsers automate, which don't, and the local gate
- [LIVE_CLASSROOM_TESTING.md](LIVE_CLASSROOM_TESTING.md) — real-classroom testing runbook
- [CLASSROOM_FIXTURE_CAPTURE_GUIDE.md](CLASSROOM_FIXTURE_CAPTURE_GUIDE.md) — capturing classroom fixtures
- [VISUAL_GUARDRAILS.md](VISUAL_GUARDRAILS.md) — website visual guardrail tests
- [RELIABILITY_GATE.md](RELIABILITY_GATE.md) — free-plan exit criteria (bead 0h4d.1.11)
- [SPRINT_PLAN.md](SPRINT_PLAN.md) — rolling sprint system

## Security

- [SECURITY_DEV.md](SECURITY_DEV.md) — security & remote configuration
- [FREE_PRO_SECURITY_DESIGN.md](FREE_PRO_SECURITY_DESIGN.md) — Free→Pro licensing security design
- [SECURITY_AUDIT_EXTENSION_2026-09-24.md](SECURITY_AUDIT_EXTENSION_2026-09-24.md) — **Dated**: extension audit report
- [SECURITY_AUDIT_WEBSITE_2026-09-30.md](SECURITY_AUDIT_WEBSITE_2026-09-30.md) — **Dated**: website audit report
- Subdirectory [security/](security/) — Mimosa scan findings/triage, threat model, gosec triage
- Subdirectory [adr/](adr/) — architecture decision records

## Product & dated analyses (kept for context)

- [ROADMAP_FREE_TO_PRO.md](ROADMAP_FREE_TO_PRO.md) — Free→Pro roadmap
- [PRODUCT_FREE_PRO_PLANS.md](PRODUCT_FREE_PRO_PLANS.md) — feature audit & free/pro split
- [DISTRIBUTION_CI_PLAN.md](DISTRIBUTION_CI_PLAN.md) — extension distribution CI plan
- [ORACLE_DASHBOARD_DARK_DESIGN_LANGUAGE.md](ORACLE_DASHBOARD_DARK_DESIGN_LANGUAGE.md) — **Dated**: Oracle dashboard design language
- [CODEBASE_REVIEW_2026-08-22.md](CODEBASE_REVIEW_2026-08-22.md) — **Dated**: full codebase review
- [CURSOR.md](CURSOR.md) — branded cursor feature notes
- Subdirectory [research/](research/) — BMC, monetization, pricing, store-policy research
- Subdirectory [superpowers/](superpowers/) — design specs and implementation plans by date
- Subdirectory [session-logs/](session-logs/) — per-session engineering logs

## Archive (`archive/`)

Point-in-time snapshots, superseded plans, and finished sequences — read for
history, never as current state:

AUDIT_REPORT · CODE_QUALITY_2026-06-24 · CODEBASE scan MAJOR_SCAN_2026-03-17 ·
ENGINE_TASK_LIST_2026-09-07 · POST_MERGE_FOLLOWUP_BOARD · PR_ISSUE_TRIAGE_2026-06-24 ·
REPO_REPORT_2026-06-24 · RELEASE_SEQUENCE_V160 · TODO_LIST_2026-03-13 ·
VERIFICATION_PROMPT_1_6_19 · extension-core-strategy-2026-03-08 · plan (reviews
section) · and earlier: MAJOR_SCAN_2026-02-28, ORACLE_HUB_V4,
extension-hardening-followup-board, plan2, refactor-plan.
