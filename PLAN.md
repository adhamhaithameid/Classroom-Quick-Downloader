# PLAN.md — Project Plan
*Last updated: 2026-06-25 by Atlas 🗺️*

---

## 🚀 Active Work
<!-- Things currently in progress — open PRs, agents actively working on something -->

| Item | Owner | Status | Notes |
|------|-------|--------|-------|
| Oracle dashboard persistent sessions (#415) | Server | In Progress | Removes in-memory auth store for better security/reliability baseline |
| Automated Google Sheets export on Oracle v6 (#416) | Server | In Progress | Restores backup/archive integrity on the latest Oracle runtime |
| Enable and validate Oracle website traffic sync pipeline (#417) | Backend | In Progress | Activates the data path correctness for traffic data |
| Implement website Reviews section under Solution (#418) | Website | In Progress | User-facing feature sourced from Oracle |

---

## 🔺 v3 Engine Roadmap
<!-- Dedicated section for v3 — maintained by Apex's Issues -->
<!-- Shows the current implementation layer and what's next -->

**Current Layer:** Layer 0
**Implemented:** DOM-first robust detection, v2 orchestrator, selector scoring
**In Progress:** Scope API-assisted engine consent and fallback model (v1.6.0 target)
**Next Issues Filed by Apex:**
- [ ] [Issue #398] Design the 1.6.0 API-assisted engine consent and fallback model

---

## 📋 Backlog
<!-- Validated Issues and plans not yet started — ordered by priority -->

### Extension
- [ ] Freeze 1.5.5 Classroom golden fixtures and regression matrix (#396)
- [ ] Build a per-post and per-file decision trace for extension debugging (#399)
- [ ] Introduce first-class attachment classification in the extension engine (#397)
- [ ] Enforce canonical attachment identity across scan, render, and download-all flows (#395)
- [ ] Close the Student Work download gap with viewer and network correlation (#394)
- [ ] Consolidate extension runtime ownership behind the V2 lifecycle (#401)
- [ ] Centralize exclusion rules and validate extension visuals in dark mode, RTL, and long posts (#400)

### Website
- [ ] Display reviews from Oracle data pipeline on overview page (#418)

### Backend / Infrastructure
- [ ] Oracle v6 Google Sheets export restoration (#416)

### Tech Debt
- [ ] Consolidate extension runtime ownership behind the V2 lifecycle (#401)

### Growth
- [ ] (No growth tasks explicitly planned at this moment)

---

## 🧪 Testing Gaps
<!-- Known test coverage gaps — from Quill, Forge, Compass, Bastion Issues -->

- [ ] (No test gaps currently flagged in recent planning logs)

---

## 🚧 Blocked
<!-- Items that are waiting on something specific before they can proceed -->

| Item | Blocked By | Since |
|------|-----------|-------|
| 1.6.0 API-Assisted Engine | DOM-first ceiling proof | 2026-03-17 |

---

## 🐛 User-Reported Bugs
<!-- Open GitHub Issues labelled "Report - Request/Bug" not yet assigned to Axle -->

| Issue # | Description | Reported | Status |
|---------|-------------|----------|--------|
| (None) | | | |

---

## ✅ Recently Completed
<!-- Items completed in the last 4 weeks — then move to archive/ -->

- [x] Full strict + security scan run and vulnerability remediation — completed 2026-02-28
- [x] Oracle DB traffic table and idempotent upsert sync path — completed 2026-02-28
- [x] Student Work resolver result channel security fix — completed 2026-03-17
- [x] Debug panel HTML rendering runtime escaping — completed 2026-03-17

---

## 🔧 Agent Activity Summary
<!-- What each active agent worked on this week — from their journals -->

| Agent | This Week | Next |
|-------|-----------|------|
| Atlas 🗺️ | Consolidated scattered plan files, first run | Maintain PLAN.md |

---

## 📦 Archived Plan Files
<!-- Files that have been moved to archive/ and when -->

| File | Archived | Reason |
|------|----------|--------|
| docs/plan.md | 2026-06-25 | Consolidated into PLAN.md |
| docs/plan2.md | 2026-06-25 | Consolidated into PLAN.md |
| docs/refactor-plan.md | 2026-06-25 | Consolidated into PLAN.md |
| docs/TODO_LIST_2026-03-13.md | 2026-06-25 | Superseded by PLAN.md |
| docs/POST_MERGE_FOLLOWUP_BOARD.md | 2026-06-25 | Items migrated to PLAN.md |
| docs/extension-hardening-followup-board.md | 2026-06-25 | Items migrated to PLAN.md |
| docs/MAJOR_SCAN_2026-02-28.md | 2026-06-25 | Point-in-time snapshot, outdated |
| docs/MAJOR_SCAN_2026-03-17.md | 2026-06-25 | Point-in-time snapshot, outdated |
