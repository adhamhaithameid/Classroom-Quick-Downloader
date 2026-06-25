# CQD Rolling Sprint Plan

Rolling 2-week sprint system. No hard deadline. Each sprint has a focus window, a done definition, and pulls from a prioritized backlog.

Last updated: 2026-06-24

---

## How This Works

- **Sprint = 2 weeks.** At the end, review what's done, pull next items from backlog.
- **Backlog** = triaged, ready to work. Items have clear owners and acceptance criteria.
- **Icebox** = good ideas, not now. Move to backlog when the right sprint arrives.
- **Jules agent PRs** = continuous input. Review weekly as part of sprint hygiene. Target: review all PRs from the current week before the next Jules cycle.
- **Priority anchor:** Extension > Docs > Workflow/GitHub > Distribution > Svelte site > Automation > Oracle > Cloudflare.

---

## Sprint 1 — 2026-06-24 to 2026-07-08

**Focus:** Security, Oracle critical fixes, PR triage, and CI foundations.

### Done definition for Sprint 1
- [ ] All CRITICAL/HIGH security PRs merged or verified.
- [ ] All duplicate Jules PRs closed.
- [ ] Oracle #415 (sessions) fixed and deployed.
- [ ] Oracle #416 (Sheets export) fixed and deployed.
- [ ] Extension distribution CI workflow: builds all three artifacts on tag push, auto-publishes to Firefox, creates draft release with artifacts for Chrome/Edge.
- [ ] Job timeouts added to all CI workflows.
- [ ] Go modules added to Dependabot config.
- [ ] `pendingByUrl` race condition scoped (issue filed with reproduction path, even if not yet fixed).

### Sprint 1 — Ordered Work Items

#### Week 1: Triage + Security + Oracle

1. **Close duplicate PRs** (10 min)
   - Close #636, #619, #637, #639, #624, #622, #623, #627, #620, #625
   - See full list in PR_ISSUE_TRIAGE_2026-06-24.md

2. **Merge security PRs** (review each diff)
   - #609 Titan SSRF fix — HIGH priority, review carefully
   - #652 Vex: remove accounts.google.com
   - #638 Flare: sanitise Oracle error responses

3. **Merge extension reliability PRs**
   - #656 Fetch: API client timeout
   - #653 Relay: alarms + message handler fix
   - #633 Relay: lastError callbacks
   - #654 Vault: storage try/catch
   - #599 Shell: lastError in tabs.sendMessage

4. **Fix Oracle #415** — Session persistence
   - Target: replace in-memory session map with SQLite-backed session store
   - Key file: `oracle-backend/internal/handlers/` auth middleware
   - Acceptance: Oracle dashboard sessions survive process restart

5. **Fix Oracle #416** — Google Sheets export
   - Likely cause: OAuth2 credentials not in deployment env, or token refresh broken
   - Debug path: run `oracle-backend/cmd/archiver` locally with production credentials
   - Acceptance: daily archiver runs and pushes to Sheets without error

#### Week 2: CI/CD + Distribution Pipeline

6. **Add job timeouts to CI** (from PRs #607, #639)
   - Add `timeout-minutes: 20` to each job in ci.yml and oracle-backend-ci.yml

7. **Add Go modules to Dependabot**
   - Edit `.github/dependabot.yml` — add `package-ecosystem: gomod` entry for oracle-backend

8. **Add CodeQL Go scanning**
   - Edit `.github/workflows/codeql.yml` — add Go language to scan matrix

9. **Build extension distribution workflow** (new workflow file)
   - See `docs/DISTRIBUTION_CI_PLAN.md` for full spec
   - Trigger: `push` to tag `v*`
   - Jobs: build-chrome, build-firefox, build-edge, publish-firefox, draft-release

10. **Scope pendingByUrl race condition**
    - Read `src/` for `pendingByUrl` usages
    - File a GitHub issue with reproduction path and severity assessment

---

## Backlog — Ordered by Priority

### Extension

- [ ] Merge all remaining a11y PRs: #660, #661, #647, #640, #628, #634
- [ ] Merge all remaining test PRs: #649, #650, #651, #630, #631, #632
- [ ] Merge performance PRs: #648, #608
- [ ] Implement #614 — scope DOM detection to post metadata zone
- [ ] Implement #613 — use document.documentElement.lang for keyword detection
- [ ] Implement #615 — cross-browser DOM selector audit and hardening
- [ ] Implement #616 — MutationObserver full-page scan (replaces polling)
- [ ] Implement #546 — fix missing Download All button in classwork view
- [ ] Implement #537 — investigate "download never works" reports (post-#656 merge)
- [ ] Implement #541 — fix language strings appended to filenames
- [ ] Implement #396 — freeze 1.5.0 Classroom golden fixtures
- [ ] Scope Student Work gap (hardening board item)
- [ ] Scope pendingByUrl fix (once issue is filed)

### Docs

- [ ] Merge docs PRs: #655, #658, #610, #662, #663, #626
- [ ] Implement #618 — document two-language-signal architecture
- [ ] Implement #617 — document _locales/ + chrome.i18n cross-browser validation
- [ ] Consolidate stale plan docs: archive plan.md, plan2.md, refactor-plan.md
- [ ] Consolidate DEPLOYMENT_RUNBOOK.md and RUNBOOK_DEPLOYMENT.md (two copies)
- [ ] Write Oracle session persistence spec (unblocks future #415 revisit)

### Workflow & GitHub

- [ ] Review and action Watch PRs: #657 (Playwright e2e in CI), #607 (job timeouts)
- [ ] Unify oracle CI — remove duplicate oracle test jobs from ci.yml (keep in oracle-backend-ci.yml with path filter)
- [ ] Fix socket-security.yml to include oracle-backend npm audit
- [ ] Fix GHSA-2g4f-4pwh-qvx6 hardcoded ignore — file tracking issue, replace with proper exception

### Distribution

- [ ] Implement full distribution CI pipeline (spec in DISTRIBUTION_CI_PLAN.md)
- [ ] Set up Firefox AMO API credentials as GitHub secrets
- [ ] Set up Chrome Web Store API credentials as GitHub secrets
- [ ] Set up Edge Partner Center manual upload checklist

### Svelte Site

- [ ] Merge #659 Lumen: parallel fetch in publicSite.ts
- [ ] Merge #662 Signal: noindex internal preview routes
- [ ] Implement website Reviews section (after Oracle #415/#416 — spec in plan.md, issue #418)
- [ ] Discuss/scope "For Teachers" landing page (#646)

### Automation

- [ ] Implement #612 — build-time locale sync script with Google Translate API gap-fill
- [ ] Implement #611 — migrate TRANSLATIONS monolith to _locales/ + chrome.i18n (after #612)

### Oracle Backend

- [ ] Implement Phase B: operational state board — deploy history, version tracking, rollout status
- [ ] Implement Phase C: platform registry design spec — all future platforms report in
- [ ] Implement #401 — consolidate extension runtime ownership behind V2 lifecycle
- [ ] Evaluate #642 Oracle suggestions (migration version tracking, Caddy rate limits)
- [ ] Fix Oracle worker ORACLE_ENDPOINT from IP to domain in wrangler.toml

### Cloudflare

- [ ] Migrate Oracle endpoint from `129.151.233.229.nip.io` to proper domain
- [ ] Document .env.production recovery process in oracle-dashboard-deploy.yml
- [ ] Add rollback workflow stub for Worker and Oracle deploys

---

## Icebox — Good Ideas, Not Now

| Item | Why Iced | When to Revisit |
|------|----------|-----------------|
| 1.6.0 API-assisted engine | Needs product strategy + OAuth consent model design | After 1.5.5 is fully stable and #396 golden fixtures complete |
| Per-post decision trace (#399) | Debugging aid, no current user pain | If user bug reports increase and root cause becomes hard to find |
| Website Reviews section (#418) | Blocked on Oracle #415/#416 | After Sprint 1 Oracle fixes |
| Chrome Identity API (#645) | High complexity, needs design doc first | After v3 engine architecture is settled |
| "Choose download location" (#550) | Low user signal, no scope | Only if multiple high-intent requests surface |
| Safari distribution | Complex WebExtension porting, separate review process | After Chrome/Firefox/Edge pipeline stable |

---

## Weekly Jules Review Cadence

Every Monday (after Jules Sunday batch completes):
1. Open PRs tab, filter by this week's Jules PRs.
2. Close any duplicates (same finding, newer PR supersedes).
3. Merge any LOW-risk a11y/docs/test PRs without needing a full review session.
4. Flag MEDIUM+ risk PRs for deeper review during the week.
5. Move any Issues created by Jules into the backlog at the right priority.

Target: zero week-old Jules PRs by end of each Monday.

---

## Recommended GitHub Management Improvements

1. **Add PR labels for Jules agents** — label each PR with the agent name (`jules:vex`, `jules:relay`, etc.) so you can filter by domain.
2. **Add a CODEOWNERS file** — route PRs touching oracle-backend to oracle review, extension to extension review.
3. **Pin the sprint plan** — link this doc from the repo README or GitHub project board.
4. **Use GitHub Projects** — create a board with columns: Triage → Backlog → In Progress → Review → Done. Auto-add Jules PRs to Triage column.
5. **Branch protection on `main`** — require at least 1 review on any non-Jules-draft PR. Jules drafts go to draft status and require manual promotion to "ready for review" before merging.
6. **Required status checks** — ensure ci.yml summary gate, codeql, gitguardian must all pass before merge.
7. **Merge queue** — enable GitHub merge queue to serialize merges and prevent CI state races when merging many PRs at once.
