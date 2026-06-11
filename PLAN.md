# PLAN.md — Project Plan
*Last updated: 2026-06-11 by Atlas 🗺️*

---

## 🚀 Active Work
<!-- Things currently in progress — open PRs, agents actively working on something -->

| Item | Owner | Status | Notes |
|------|-------|--------|-------|
| Consolidation of plans and docs | Atlas 🗺️ | In Progress | First run synthesis |

---

## 🔺 v3 Engine Roadmap
<!-- Dedicated section for v3 — maintained by Apex's Issues -->
<!-- Shows the current implementation layer and what's next -->

**Current Layer:** Layer 0
**Implemented:** None
**In Progress:** Architecture planning
**Next Issues Filed by Apex:**
- [ ] No Apex issues filed yet

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
- [ ] Design the 1.6.0 API-assisted engine consent and fallback model (#398)
- [ ] Replace `pendingByUrl: Map<string, PendingDownload>` with multi-pending mapping
- [ ] Promote `Not_Stable` into `main` after split hardening merge train
- [ ] Guard delayed bypass tab removal with identity/URL re-check before close
- [ ] Replace `while (true) + delay(200)` terminal-state polling with event/timer-driven reset
- [ ] Replace hardcoded personal `workers.dev` host with production-domain-first config + controlled fallback
- [ ] Add explicit `web_accessible_resources` scoping
- [ ] Add size-cap trimming for `recentDownloads` map
- [ ] Replace `layer4.score >= 0` edited check with explicit exclusion semantics

### Website
- [ ] Implement `plan.md` Reviews section end-to-end (Oracle snapshot driven)
- [ ] Align security/quality workflow triggers with `Not_Stable` policy

### Backend / Infrastructure
- [ ] Promote the HTTPS-only changes into protected branch flow
- [ ] Align security/quality workflow triggers with `Not_Stable` policy
- [ ] Stop returning raw internal error strings in HTTP responses

### Tech Debt
- [ ] Fix extension package bloat to reduce install and update cost

### Growth
- [ ]

---

## 🧪 Testing Gaps
<!-- Known test coverage gaps — from Quill, Forge, Compass, Bastion Issues -->

- [ ] Test overlapped test execution in root test:strict script

---

## 🚧 Blocked
<!-- Items that are waiting on something specific before they can proceed -->

| Item | Blocked By | Since |
|------|-----------|-------|
| None | | |

---

## 🐛 User-Reported Bugs
<!-- Open GitHub Issues labelled "Report - Request/Bug" not yet assigned to Axle -->

| Issue # | Description | Reported | Status |
|---------|-------------|----------|--------|
| None | | | |

---

## ✅ Recently Completed
<!-- Items completed in the last 4 weeks — then move to archive/ -->

- [x] Oracle persistent sessions (#415)
- [x] Google Sheets export restoration (#416)
- [x] Website traffic sync activation (#417)
- [x] Retire plaintext Oracle endpoint committed exception
- [x] Split/re-scope PR #419 before merge
- [x] Enable CI workflow triggers for `Not_Stable` PRs
- [x] Enforce required status checks on protected branches
- [x] Capture sanitized Classroom fixtures and lock behavior with regression tests

---

## 🔧 Agent Activity Summary
<!-- What each active agent worked on this week — from their journals -->

| Agent | This Week | Next |
|-------|-----------|------|
| Atlas 🗺️ | Initial plan consolidation | Maintain PLAN.md |

---

## 📦 Archived Plan Files
<!-- Files that have been moved to archive/ and when -->

| File | Archived | Reason |
|------|----------|--------|
| docs/TODO_LIST_2026-03-13.md | 2026-06-11 | Superseded by PLAN.md |
| docs/POST_MERGE_FOLLOWUP_BOARD.md | 2026-06-11 | Superseded by PLAN.md |
| docs/extension-hardening-followup-board.md | 2026-06-11 | Superseded by PLAN.md |
| docs/MAJOR_SCAN_2026-02-28.md | 2026-06-11 | Superseded by PLAN.md |
| docs/MAJOR_SCAN_2026-03-17.md | 2026-06-11 | Superseded by PLAN.md |
| docs/plan.md | 2026-06-11 | Superseded by PLAN.md |
| docs/plan2.md | 2026-06-11 | Superseded by PLAN.md |
| docs/refactor-plan.md | 2026-06-11 | Superseded by PLAN.md |
| final-river-carp.md | 2026-06-11 | Superseded by PLAN.md |
