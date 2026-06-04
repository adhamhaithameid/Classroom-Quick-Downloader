# PLAN.md — Project Plan
*Last updated: 2026-06-04 by Atlas 🗺️*

---

## 🚀 Active Work

| Item | Owner | Status | Notes |
|------|-------|--------|-------|
| [Issue #415] Persist Oracle dashboard sessions | Not assigned | In Progress | Security + reliability baseline |
| [Issue #416] Restore Google Sheets export on Oracle v6 | Not assigned | In Progress | Backup/archive integrity |
| [Issue #417] Enable website traffic sync in production | Not assigned | In Progress | Data-path correctness |
| [Issue #418] Implement website Reviews section under Solution | Not assigned | In Progress | Oracle-sourced, user-facing feature |

---

## 🔺 v3 Engine Roadmap

**Current Layer:** Unknown
**Implemented:** None specified
**In Progress:** None specified
**Next Issues Filed by Apex:**
- [ ] No issues filed by Apex yet.

---

## 📋 Backlog

### Extension
- [ ] [Issue #394] Extension roadmap tranche
- [ ] [Issue #395] Extension roadmap tranche
- [ ] [Issue #396] Freeze 1.5.5 Classroom golden fixtures and regression matrix
- [ ] [Issue #397] Introduce first-class attachment classification in the extension engine
- [ ] [Issue #398] Decide on network-based vs API-assisted correlation
- [ ] [Issue #399] Build a per-post and per-file decision trace for debugging
- [ ] [Issue #400] Extension roadmap tranche
- [ ] [Issue #401] Clean up ownership without destabilizing the UI

### Website
- [ ] Implement `plan.md` Reviews section end-to-end (Oracle snapshot driven) [MEDIUM]

### Backend / Infrastructure
- [ ] Update CI/CD workflow triggers for strictly-enforced branch protection [HIGH]
- [ ] Stop returning raw internal error strings in HTTP responses [MEDIUM]

### Tech Debt
- [ ] Replace hardcoded personal `workers.dev` host with production-domain-first config [LOW]
- [ ] Add explicit `web_accessible_resources` scoping [LOW]
- [ ] Add size-cap trimming for `recentDownloads` map [LOW]
- [ ] Replace `layer4.score >= 0` edited check with explicit exclusion semantics [LOW]

### Growth
- [ ] None currently tracked.

---

## 🧪 Testing Gaps

- [ ] Need to ensure snapshot contract tests cover reviews feature.

---

## 🚧 Blocked

| Item | Blocked By | Since |
|------|-----------|-------|
| Root-domain migration for traffic sync | Custom Pages domain not attached | 2026-02-28 |

---

## 🐛 User-Reported Bugs

| Issue # | Description | Reported | Status |
|---------|-------------|----------|--------|
| None | No unassigned user-reported bugs currently tracked | N/A | N/A |

---

## ✅ Recently Completed

- [x] Initial real Classroom baseline capture from dedicated profile — completed 2026-03-13
- [x] Converted baselines into reusable test fixtures — completed 2026-03-13
- [x] Keep default production CORS allowlist free of localhost origins — completed 2026-03-13
- [x] Move uninstall stats GET behind admin auth (or split route) — completed 2026-03-13
- [x] Remove duplicate ingestUrl field from Oracle endpoint resolution contract — completed 2026-03-13
- [x] Normalize ALLOW_INSECURE_COOKIES parsing — completed 2026-03-13

---

## 🔧 Agent Activity Summary

| Agent | This Week | Next |
|-------|-----------|------|
| No agents active | First run, no logs in journals | N/A |

---

## 📦 Archived Plan Files

| File | Archived | Reason |
|------|----------|--------|
| plan.md | 2026-06-04 | Superseded by PLAN.md |
| plan2.md | 2026-06-04 | Superseded by PLAN.md |
| refactor-plan.md | 2026-06-04 | Superseded by PLAN.md |
| TODO_LIST_2026-03-13.md | 2026-06-04 | Superseded by PLAN.md |
| POST_MERGE_FOLLOWUP_BOARD.md | 2026-06-04 | Superseded by PLAN.md |
| extension-hardening-followup-board.md | 2026-06-04 | Superseded by PLAN.md |
| MAJOR_SCAN_2026-02-28.md | 2026-06-04 | Superseded by PLAN.md |
| MAJOR_SCAN_2026-03-17.md | 2026-06-04 | Superseded by PLAN.md |
