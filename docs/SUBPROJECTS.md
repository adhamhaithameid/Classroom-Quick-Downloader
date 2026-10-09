# Internal sub-projects — inventory and promotion assessment

Date: 2026-10-09. Question: which internal sub-projects inside `extension/`, `website/`, `cloudflare-worker/`, `oracle-backend/`, and `tools/` should rise to main projects?

## Verdict in one line

Most sub-projects should stay embedded: they are coupled through repo-level contracts (analytics event shape, changelog JSON shared by three workspaces, version-sync invariants, one chained `test:strict` gate), and extraction breaks those invariants for no external value. Four items are genuine promotion candidates.

## Why staying embedded is usually right

- One repo means one commit can fix a contract across workspaces (extension + worker + docs together); split repos turn that into multi-repo PR dances.
- The pnpm workspaces already give each part main-project treatment: own `package.json`, own tests, own scripts, own CI gates.
- Versioning and changelog flows (`tools/sync-versions.mjs`) are single-source; forks drift.

## The four genuine candidates

| Candidate | Promotion shape | Why |
|---|---|---|
| `tools/commit-planner/` | Standalone repo / npm package | 9.3k LOC, own UI and tests, zero imports from product code — extraction cost near zero. |
| Extension acquire corpus + accuracy harness (`extension/tools/corpus/`, `tests/accuracy/`) | Workspace package `@cqd/classroom-corpus` | Already consumed by two workspaces (extension tests AND simulator fixture pages); a package makes that dependency explicit instead of path-based. |
| Worker dashboard (`cloudflare-worker/src/dashboard/`) | Workspace package `@cqd/dashboard` | 10.7k LOC — about 40% of the worker — with a distinct concern (auth, sessions, SVG rendering) and its own test cluster. |
| `oracle-backend/` | Frozen archive (separate repo, or CI-quarantined) | Severed from the live path (`ORACLE_ENDPOINT` commented out) yet costs ~47k LOC of Go and CI time per `test:strict`. Not a promotion — a retirement. |

## Full inventory

| Sub-project | Path | ~LOC | Tests | Consumers | Verdict |
|---|---|---|---|---|---|
| **Root / shared** | | | | | |
| Monorepo orchestration (60+ scripts, `test:strict` chain) | `package.json`, `playwright.config.ts` | — | — | CI, husky | Embedded |
| Pre-push scope gate | `tools/pre-push-scope.mjs` | 193 | yes | `.husky/pre-push` | Embedded |
| Production verifier | `tools/verify-production.mjs` | 220 | yes | deploy workflows | Embedded |
| Version/changelog sync trio | `tools/sync-versions.mjs`, `sync-manual-changelog.mjs`, `generate-full-changelog.mjs` | ~800 | — | version workflows, 3 workspaces | Embedded |
| Commit planner | `tools/commit-planner/` | 9,304 | yes (253 tests) | dev only | **Extractable** |
| Agent audit | `tools/agent-audit/audit.mjs` | 471 | — | `audit:agents` | Embedded |
| Backup/export to Sheet | `tools/backup-to-sheet.mjs` + workflow | 168 | — | `data-backups.yml` | Embedded |
| SEO indexing + analytics contract checks | `tools/submit-search-indexing.mjs`, `verify-analytics-contract.mjs` | 423 | — | indexing, contract gates | Embedded |
| Playwright E2E matrix + QA journeys qa-01…08 | `tests/e2e/` | 8,184 | itself | nightly + extension scripts | Embedded |
| **extension** | | | | | |
| Extension core (the product) | `extension/` | 26,153 src | 50,770 test LOC | stores; simulator imports it | Embedded (is a workspace) |
| Queue engine | `src/queue/` | ~230 | yes | background flow | Embedded |
| Download stats + history | `src/history/` | 533 | yes | background handlers | Embedded |
| Acquire corpus + accuracy harness | `extension/tools/corpus/`, `tests/accuracy/` | 4,300+ | fast-check suites | extension tests; simulator | **Workspace-worthy** |
| Diagnostics page | `src/diagnostics/`, `entrypoints/diagnostics/` | 239 | yes | popup support link | Embedded |
| i18n locale pipeline | `tools/generate-locales.mjs`, `_locales/` | 365 + 147 locales | locale check | CI gate, UIs | Embedded |
| extension/tools (sign, manifest, capture) | `extension/tools/` | 1,319 | manifest test | CI + store workflows | Embedded |
| **website** | | | | | |
| Website core (SvelteKit) | `website/` | 17,863 lib | 20+ suites | public site | Embedded (is a workspace) |
| Celebration balloons engine | `src/lib/celebration/balloons/` | 737 | yes | overview routes | Embedded (npm-able, low external value) |
| Analytics websiteEvents | `src/lib/analytics/` | 1,116 | unit+fuzz | 6 routes → worker `/track` | Embedded (contract-locked) |
| SEO/sitemap system | `src/lib/seo/` + guards | 233 | guard tests | SeoMeta, robots, indexnow | Embedded |
| **cloudflare-worker** | | | | | |
| `/track` + Downloads DO | `src/downloads_do/`, `downloads_do.ts` | 8,382 | smoke/fuzz/load suites | beacons; extension counts | Embedded (product core) |
| D1 event archive + trends | `src/event-archive.ts`, `archive-trends.ts` | 246 | yes | dashboard, backups | Embedded |
| Ops dashboard | `src/dashboard/` | 10,651 | dashboard cluster | humans | **Workspace-worthy** |
| Reliability + uptime | `src/reliability.ts`, `uptime.ts` | 293 | yes | monitor workflow, DO | Embedded |
| Store scrape + reviews + notifications | `src/store-stats.ts`, `store-reviews.ts`, `notifications.ts` | ~1,100 | yes | crons, dashboard | Embedded |
| **oracle-backend** | | | | | |
| Go backend core | `internal/`, `cmd/` | 47,062 | go test/fuzz/bench | nothing live | Embedded (frozen) — **archive candidate** |
| Relay mirror | `internal/relay/` | 774 | yes | dormant mirror | Embedded (dormant) |
| Oracle dashboard + hubs | `dashboard/`, scripts | ~800 | scripts | validate only | Embedded (dormant) |
| **simulator** | | | | | |
| CQD Simulator (52-state map) | `simulator/` | 2,715 + 359 test | vitest smoke | dev-only; imports extension | Embedded (is a workspace) |

## Filed proposals

Promotion is a decision, not a chore — each candidate above has an open bead under the wayfinder map; none is executed without an explicit owner go-ahead.
