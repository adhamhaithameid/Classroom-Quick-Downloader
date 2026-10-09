# PR & Issue Triage — 2026-06-24

Work through this list in order. Each item has a recommendation and a one-line reason.
All Jules PRs are agent-generated and must be manually reviewed before merge.

---

## Pull Request Triage

### Merge Order: Security First

| # | Title | Action | Risk | Agent | Reason |
|---|-------|--------|------|-------|--------|
| **609** | Titan: Fix SSRF in Archiver URLs | **MERGE** | HIGH→LOW | Titan | SSRF vulnerability — strict URL validation. Review diff carefully before merge. |
| **652** | Vex: remove unused accounts.google.com from host_permissions | **MERGE** | LOW | Vex | Least-privilege. Removes unused permission. Safe. |
| **638** | Flare: sanitise Oracle error responses to prevent leaking internal details | **MERGE** | LOW | Flare | Prevents internal path/detail disclosure in error responses. |

### Merge Order: User-Reported Bugs

| # | Title | Action | Risk | Agent | Reason |
|---|-------|--------|------|-------|--------|
| **656** | Fetch: classroom API client lacks a timeout — requests can hang indefinitely | **MERGE** | LOW | Fetch | AbortController timeout added. Prevents indefinite hangs. |
| **636** | Fetch: classroom API client has no timeout (older duplicate) | **CLOSE** | — | Fetch | Duplicate of #656 (newer). Close in favor of #656. |
| **653** | Relay: replace setInterval with alarms and fix message handler returns | **MERGE** | MEDIUM | Relay | Service worker cleanup fix + messaging channel leak fix. Review diff. |
| **633** | Relay: add missing chrome.runtime.lastError callbacks | **MERGE** | LOW | Relay | Prevents silent SW crashes. Safe mechanical fix. |
| **599** | Shell: handle lastError in tabs.sendMessage | **MERGE** | LOW | Shell | Same pattern as #633. Safe. |
| **654** | Vault: add defensive try/catch and optional chaining to storage calls | **MERGE** | LOW | Vault | Graceful storage error handling. Safe. |
| **635** | Vault: add try/catch around storage operations in changelog utils | **MERGE** | LOW | Vault | Older version of same fix. Review for overlap with #654; merge whichever is more complete or both if non-overlapping. |

### Merge Order: Test Coverage

| # | Title | Action | Risk | Agent | Reason |
|---|-------|--------|------|-------|--------|
| **632** | Bastion: worker security test missing X-Forwarded-For spoofing scenario | **MERGE** | LOW | Bastion | Validates rate limiting against header forging. |
| **631** | Forge: e2e smoke test doesn't verify download buttons appear | **MERGE** | LOW | Forge | Adds E2E button-injection verification. |
| **630** | Quill: add test for unknown background message types | **MERGE** | LOW | Quill | Defensive test for message handler safety. |
| **650** | Forge: no e2e test for download-all cancellation mid-batch | **MERGE** | LOW | Forge | E2E cancel-during-batch coverage. |
| **649** | Quill: content message-handler has no test for unknown message type | **MERGE** | LOW | Quill | Same pattern as #630 — check for overlap, merge both if non-overlapping. |
| **651** | Compass: route render smoke test missing routes and email preview pages | **MERGE** | LOW | Compass | Adds SSR smoke coverage for website routes. |

### Merge Order: Accessibility

| # | Title | Action | Risk | Agent | Reason |
|---|-------|--------|------|-------|--------|
| **660** | Aria: layout missing skip-to-main-content link and focus management | **MERGE** | LOW | Aria | WCAG 2.1 AA — keyboard users can't skip nav. |
| **619** | Aria: layout missing skip-to-main-content link (older) | **CLOSE** | — | Aria | Duplicate of #660 (newer). Close. |
| **661** | Ember: add missing aria-labels to Download All button states | **MERGE** | LOW | Ember | Screen reader support for Download All. |
| **647** | Palette: Add input labels to toggle row switches | **MERGE** | LOW | Palette | Semantic label → keyboard nav fix in popup. |
| **640** | Ember: respect prefers-reduced-motion for pulse effect | **MERGE** | LOW | Ember | WCAG motion preference compliance. |
| **628** | Palette: Add aria-hidden to toggle switch decorative icons | **MERGE** | LOW | Palette | Removes phantom screen reader elements. |
| **634** | Shell: toggle switch missing aria-label for screen readers | **MERGE** | LOW | Shell | Screen reader label for popup toggles. |

### Merge Order: Performance

| # | Title | Action | Risk | Agent | Reason |
|---|-------|--------|------|-------|--------|
| **648** | Bolt: Optimize getDistinctRoots in MutationObserver | **MERGE** | LOW | Bolt | 3-4x hot-path optimization. Manual loop over array methods. |
| **608** | Specter: debounce MutationObserver in orchestrator to reduce CPU usage | **MERGE** | LOW | Specter | 90%+ callback reduction during page load. Review debounce window. |
| **659** | Lumen: parallelize sequential fetch in publicSite.ts to improve TTFB | **MERGE** | LOW | Lumen | Promise.all for independent fetches. Safe. |

### Merge Order: Docs

| # | Title | Action | Risk | Agent | Reason |
|---|-------|--------|------|-------|--------|
| **655** | Ink: Create BOTS.md to document full agent roster | **MERGE** | LOW | Ink | Essential ref for 36-agent ecosystem. |
| **637** | Ink: create BOTS.md to document agent roster and schedule (older) | **CLOSE** | — | Ink | Duplicate of #655 (newer). Close. |
| **658** | Lexicon: Add missing cancel keys for sr-latn language | **MERGE** | LOW | Lexicon | i18n gap fill. |
| **610** | Lexicon: Add English fallback for missing keys across 134 languages | **MERGE** | LOW | Lexicon | Older i18n fix. Review for overlap with #658. |
| **662** | Signal: add noindex to internal preview routes | **MERGE** | LOW | Signal | SEO hygiene — internal routes excluded from index. |
| **663** | Stamp: verify everything in sync | **MERGE** | LOW | Stamp | Version consistency check. |
| **626** | Atlas: update PLAN.md — consolidate scattered TODO files | **MERGE** | LOW | Atlas | Consolidates legacy plan docs. Review changes carefully. |

### Needs Review (Scope/Design Decision Required)

| # | Title | Action | Risk | Reason |
|---|-------|--------|------|--------|
| **657** | Watch: no workflow runs Playwright e2e tests on PRs | **REVIEW** | MEDIUM | Issue rather than fix — read carefully, may just be suggesting an action |
| **607** | Watch: ci.yml and oracle-backend-ci.yml lack job timeouts | **REVIEW** | MEDIUM | Config change, but need to set correct timeout values |
| **639** | Watch: oracle-backend-ci.yml and ci.yml lack job timeouts (duplicate) | **CLOSE** | — | Duplicate of #607. Close. |
| **644** | Refine: [Tech Debt] ESLint Patches and Disabled Pages | **REVIEW** | MEDIUM | Identifies debt — no code changes. Read, create issues for action items, close PR |
| **624** | Refine: Tech debt suggestions for ESLint patches and Skipped Tests (older) | **CLOSE** | — | Duplicate of #644 (newer). Close. |
| **643** | Horizon: [Architecture Suggestions] Type Contracts & Dependency Management | **REVIEW** | MEDIUM | Architecture proposal — read and decide which suggestions to act on |
| **622** | Horizon: log Type Contract and Cross-Browser CI issues (older) | **CLOSE** | — | Duplicate of #643. Close. |
| **642** | Oracle: Add migration version tracking and Caddy rate limit suggestions | **REVIEW** | MEDIUM | Backend infrastructure suggestions — evaluate for Oracle expansion plan |
| **623** | Oracle: [Migration Tracking & Rate Limiting] (older) | **CLOSE** | — | Duplicate of #642. Close. |
| **629** | build(deps-dev): bump esbuild from 0.28.0 to 0.28.1 | **MERGE** | LOW | Dependabot dep bump (security patch). Auto-merge is safe. |

### Needs Discussion (Product/Scope Decision)

| # | Title | Action | Reason |
|---|-------|--------|--------|
| **646** | Reach: website missing "For Teachers" landing page | **DISCUSS** | Growth feature — needs product decision before build |
| **627** | Reach: website missing "For Teachers" landing page (older) | **CLOSE** | Duplicate of #646. Close. |
| **645** | Apex: implement v3 background service worker message relay for Chrome Identity API | **REVIEW** | HIGH risk — Chrome Identity API integration. Needs design review before any code. |
| **625** | Apex: propose v3 background worker token bridge (older) | **CLOSE** | Duplicate of #645 concept. Close, carry forward to #645. |
| **641** | Sage: suggest per-file-type filter and popup download history | **DISCUSS** | Two feature proposals — needs UX/scope discussion |
| **620** | Sage: propose file type filter and download history issues (older) | **CLOSE** | Duplicate of #641. Close. |
| **621** | Muse: Website content and design suggestions | **DISCUSS** | Website UX ideas — needs product review |
| **625** | Apex: propose v3 background worker token bridge | **REVIEW** | Design proposal only — needs design doc before implementation |

### Batch Close: Clear Duplicates

PRs to close immediately (confirmed duplicates from Jules re-running same agents):

| Close | In favor of |
|-------|-------------|
| #636 | #656 |
| #619 | #660 |
| #637 | #655 |
| #639 | #607 |
| #624 | #644 |
| #622 | #643 |
| #623 | #642 |
| #627 | #646 |
| #620 | #641 |
| #625 | #645 |

---

## Issue Triage

### P0 — Fix immediately

| # | Title | Action | Notes |
|---|-------|--------|-------|
| **415** | Persist Oracle dashboard sessions (remove in-memory auth store in production) | **IMPLEMENT** | Sessions lost on every restart. Blocks all Oracle dashboard usage in production. Fix: SQLite session store or signed cookie with DB backing. |
| **416** | Restore and verify automated Google Sheets export on Oracle v6 | **IMPLEMENT** | Archival pipeline down. Risk: data accumulates without backup. Fix: debug OAuth2 token refresh + service account credentials in deploy. |
| **546** | Report - Bug: cannot download all button missing in classwork view | **IMPLEMENT** | Severity 5/5 from user survey. Download buttons missing in a specific Classroom view — likely a DOM selector regression. Needs fixture capture. |
| **396** | Freeze 1.5.0 Classroom golden fixtures and regression matrix | **IMPLEMENT** | Locks known-good behavior before any engine work. Without this, changes break silently. |

### P1 — Next sprint

| # | Title | Action | Notes |
|---|-------|--------|-------|
| **537** | Report - Bug: download never works always gives error | **IMPLEMENT** | Severity 5/5. Needs reproduction + triage first. Likely API timeout (fixed by PR #656) or network-related. |
| **541** | Report - Bug: downloaded files have appended language strings | **IMPLEMENT** | Severity 3/5. Confirmed localization bug in file naming. Scoped fix. |
| **614** | feat: scope DOM detection to post metadata zone only | **IMPLEMENT** | Prevents false positives from user comment bodies. High value, scoped. |
| **613** | feat: use document.documentElement.lang for keyword detection | **IMPLEMENT** | Fixes language resolution (page lang ≠ browser UI lang). Foundational for i18n. |
| **615** | cross-browser: audit and harden metadata DOM selectors | **IMPLEMENT** | DOM selector robustness for all supported browsers. |
| **616** | feat: MutationObserver-based full-page scan replacing polling | **IMPLEMENT** | Eliminate polling. Pairs with PR #608 (Specter debounce). |
| **618** | docs: document the two-language-signal architecture | **IMPLEMENT** | Essential doc for chrome.i18n vs document.lang split. |
| **617** | compat: validate _locales/ + chrome.i18n behavior on Firefox and Safari | **IMPLEMENT** | Cross-browser i18n validation. Needed for Firefox/Safari robustness. |

### P2 — Backlog

| # | Title | Action | Notes |
|---|-------|--------|-------|
| **611** | refactor: migrate TRANSLATIONS monolith to _locales/ + chrome.i18n | **IMPLEMENT** | Unblocks PR readability. Depends on locale sync tooling (#612). |
| **612** | tooling: build-time locale sync script with Google Translate API gap-fill | **IMPLEMENT** | Automates locale propagation. Do before #611. |
| **401** | Consolidate extension runtime ownership behind the V2 lifecycle | **IMPLEMENT** | Reduce legacy v1 overhead. Unblocks future engine work. |
| **400** | Centralize exclusion rules and validate extension visuals in dark mode, RTL | **IMPLEMENT** | Dark mode/RTL regression fixtures. |
| **397** | Introduce first-class attachment classification | **IMPLEMENT** | Cleaner logic, fewer false positives. |
| **528** | Dependency update backlog | **DEFER** | 29 outdated packages. Renovate handles most. Low urgency, non-blocking. |

### P3 — Icebox

| # | Title | Action | Notes |
|---|-------|--------|-------|
| **418** | Implement website Reviews section under Solution | **DEFER** | Oracle-sourced feature. Blocked on #415/#416 first. plan.md has full spec. |
| **399** | Build a per-post and per-file decision trace for extension debugging | **DEFER** | Useful but not urgent. No current user pain. |
| **398** | Design the 1.6.0 API-assisted engine consent model | **DEFER** | Future API work — requires product alignment. |
| **550** | Report - Request: choose download location | **DEFER** | User survey request. Low intent, no scope. |
| **547** | Report - Bug: download is unavailable | **CLOSE** | Severity 3/5, no reproduction steps, no error detail. Ask for repro; close if no response in 30 days. |

---

## Summary Counts

| Category | Count |
|----------|-------|
| PRs to MERGE (clear) | ~38 |
| PRs to CLOSE (duplicates) | ~10 |
| PRs to REVIEW (need decision) | ~10 |
| PRs to DISCUSS (product scope) | ~7 |
| Issues P0 | 4 |
| Issues P1 | 8 |
| Issues P2 | 6 |
| Issues P3/Close | 5 |

**Recommended first session:** Close all duplicates (10 PRs, takes 10 minutes), then merge the security PRs (#609, #652, #638), then merge the reliability fixes (#656, #653, #654).
