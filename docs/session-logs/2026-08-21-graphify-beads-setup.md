# Session Log — 2026-08-21: Project Onboarding + Graphify + Beads Setup

## What was asked
1. Understand the Classroom-Quick-Downloader project.
2. Set up Graphify (knowledge-graph tool) on this repo.
3. Run Beads (`bd`, issue tracker) in this repo.

## 1. Project understanding

**Classroom Quick Downloader (CQD) v3.2.7** — a browser extension that bulk-downloads
Google Classroom attachments, backed by an analytics/reliability pipeline.

```
Student ──> Extension (WXT + React/TS)          extension/
              │  /track batch (telemetry)
              ▼
            Cloudflare Worker + Durable Object   cloudflare-worker/
              │  /ingest-batch
              ▼
            Oracle Backend (Go + SQLite)         oracle-backend/
              │                                  website/ (SvelteKit marketing site)
              ▼
            Daily Google Sheets archive
```

- pnpm monorepo (`pnpm-workspace.yaml`), Playwright e2e for the extension,
  layered test pyramid per module (smoke → functional → integration → … → strict).
- Proprietary/source-available license; privacy-first telemetry (no PII).

## 2. Graphify setup

- Already installed via uv tool (`graphifyy`); interpreter pinned to
  `~/.local/share/uv/tools/graphifyy/bin/python`.
- **Scope decision:** full-repo detect found 850 files (>500 threshold → must narrow).
  User chose **"Code dirs only"**: `extension/`, `website/`, `oracle-backend/`,
  `cloudflare-worker/`. Videos (2) and images (44) dropped — fixtures/screenshots,
  low semantic value; kept 540 code + 31 docs = 571 files (~597k words).
- AST extraction: 5,729 nodes / 16,623 edges (deterministic, no LLM).
- Semantic extraction: 31 docs via 2 parallel subagents → 145 nodes / 139 edges.
- Final graph: **5,737 nodes · 15,232 edges · 279 communities**, labeled
  (28 hand-named communities, rest derived from paths).

### Outputs (`graphify-out/`)
| File | Purpose |
|---|---|
| `graph.html` | interactive graph (279 community nodes aggregated) |
| `GRAPH_REPORT.md` | full audit report |
| `graph.json` | raw graph data |
| `manifest.json` | enables incremental `--update` |

### Key findings
- **God nodes:** `main()` (130 edges), `DownloadsDurable` (94), `$lib/api/publicSite` (88), `Init()` (85)
- **Import cycle found:** `website/src/lib/svgCatalog/index.ts ↔ threeD.ts`
- Hyperedges confirm the arch: Analytics Ingestion Pipeline (ext → worker DO → Oracle),
  Student Work Hybrid Resolution Flow, Oracle security hardening cluster.
- ⚠️ **Graph health warning (surfaced honestly):** 1,294 dangling-endpoint edges +
  ~232 collapsed undirected edges. Cause: AST cross-file references to symbols not
  extracted as nodes (common on large TS/Go repos). Graph is usable; integrity caveat noted.

### Errors hit & fixed
1. `report.generate()` crashed: my scope-filtering set `total_words=None`. Fixed by
   recomputing real word counts (597,282) from the 571 scoped files.
2. Subagent type `general-purpose` doesn't exist in this harness → used `general`.

## 3. Beads setup

- Installed `bd` v1.2.2 via Homebrew.
- `bd init`: backend **dolt (embedded)**, DB `Classroom_Quick_Downloader`,
  prefix `Classroom-Quick-Downloader-<hash>`.
- Installed: Claude Code hooks/settings, beads agent skill (`.agents/skills/beads/`),
  Codex hooks + AGENTS.md guidance.
- Status: 0 issues; `bd ready` → "No open issues".

### ⚠️ Git note (transparency)
`bd init` **auto-committed** its own files:
`da397181 "bd init: initialize beads issue tracking"` — done by the tool, not by me.
I ran no other git writes. Pre-existing uncommitted modifications (LICENSE, generated
changelog/version files) were left untouched. `graphify-out/` is currently untracked —
decide whether to commit or gitignore it.

## Blast radius
- New files: `graphify-out/` (untracked), `.beads/` (committed by bd), `.claude/settings.json`
  (modified by bd), `.agents/skills/beads/`, AGENTS.md (updated by bd).
- Nothing in product code was touched. Rollback: delete `graphify-out/`; revert commit
  `da397181` if beads is unwanted.

## Open items
- Commit or ignore `graphify-out/`.
- Optional: `git remote add upstream <url>` warning from bd (sync workflows).
- Optional: re-run `/graphify . --update` after code changes (incremental, cached).

---

# Addendum (same day): Offline website integration + explanations

## Offline graphify page on the local website
- `graph.html` loaded vis-network from unpkg CDN → **not offline**. Fixed:
  - Vendored `vis-network@9.1.6` standalone (688K) → `website/static/graphify/vis-network.min.js`
  - Created `website/static/graphify/index.html` = copy of `graph.html` with the CDN
    `<script src>` rewritten to `./vis-network.min.js` (0 external refs remain).
  - Added nav entry `{ href: '/graphify', label: 'Graph' }` in
    `website/src/routes/+layout.svelte` (baseNav array; renders via `{base}{item.href}`
    like all sibling links).
  - `.gitignore`: added `graphify-out/` and `website/static/graphify/` (user wants
    nothing committed).
- Verification: dev server → `/graphify/index.html` 200, `/graphify/vis-network.min.js`
  200, nav link present. Note: bare `/graphify/` 404s in **dev** only (SvelteKit router
  intercepts before static fallback); works when built/prerendered, and direct file URL
  always works. `vitest run src/routes/layout.shell.test.ts` → 4/4 pass.
- Dev quirk noted: all nav hrefs render as `./x` in dev (base injected at build time);
  my link matches existing behavior exactly.
- **Zero git writes performed.** Everything is working-tree only + gitignored.

## ViewKind trace (graph query result)
`ViewKind` (`extension/src/engines/types.ts:56`) has 66 direct edges, all EXTRACTED
imports/references. It is the "which Classroom page am I on" enum consumed by:
- Engine Registry + Engines V1/V2/V3 (`.init()` signatures)
- Route layer: `route-classifier.ts` / `RouteWatcher.getCurrentViewKind()`
- Detection: `dom-scanner.ts` (`fullScan`, `scanSinglePost`, `ScanResult`)
- Placement: `file-placement.ts`, `placement-recipes.ts` (`PlacementRecipe`)
- Orchestration/comparison: `orchestrator.ts`, `shadow-diff-report.ts` (`ViewKindStats`),
  `compare-observations.ts` (`ComparisonRecord`)
Conclusion: it bridges those communities because it is the shared vocabulary/contract
of the extension's engine architecture — every subsystem keys its behavior off the
current view kind, so the type sits on every cross-community path by design.

---

# Addendum 2 (same day): Smart GitHub Pages pipeline

## Discovery
- Old `.github/workflows/github-pages.yml` deployed **raw `website/static`** to GH Pages
  (no build at all); the real built site only went to Cloudflare Pages via
  `website-deploy.yml`. No PR builds existed for the site anywhere.

## New workflow (replaces github-pages.yml)
- Triggers: push→main + PRs→main + manual; **path-filtered** to `website/**`,
  `pnpm-lock.yaml`, and the workflow file itself.
- Concurrency: per-ref (`github-pages-${{ github.ref }}`) → stale runs cancel;
  PR lanes never block the main deploy lane.
- Build job: pnpm 10.28.2 + Node 22 (cached), frozen install, `svelte-check`,
  visual guards, smoke tests, build with `PUBLIC_BASE_PATH=/Classroom-Quick-Downloader`
  + same public vars as the Cloudflare pipeline (no secrets → works on PRs),
  output sanity check.
- Deploy job: only on push to main; uploads `website/build` via
  upload-pages-artifact v5 + deploy-pages v4 (pins reused from repo convention).
- PRs get full build+test validation but never touch Pages.

## Local verification performed
- YAML parses (pyyaml).
- `pnpm -C website check` → 0 errors / 0 warnings.
- `test:visual-guards` → 4/4 pass; `test:smoke` → 5/5 pass.
- Full `pnpm -C website build` with PUBLIC_BASE_PATH set → success; all asset URLs
  emitted relative (`./_app/...`) → correct under the /Classroom-Quick-Downloader/ subpath.

## Activation requirement (NOT done — user's no-commit rule)
The workflow is a local file only. It runs on GitHub only after:
`git add .github/workflows/github-pages.yml && git commit && git push`.
Also verify once in repo Settings → Pages → Source = "GitHub Actions".

---

# Addendum 3 (same day): Full Gemini-powered graph rebuild in CI

## What was built
- `tools/rebuild_graph.py` — the exact pipeline CI runs: scoped detect → AST
  extraction (cached) → **Gemini semantic extraction** of docs/images → merge →
  cluster → **LLM community labels** → report → export HTML staged into
  `website/static/graphify/` with vis-network vendored (0 CDN refs).
  Graceful fallback: no `GEMINI_API_KEY` ⇒ deterministic code-only mode with
  path-derived labels, so fork PRs never fail on secrets.
- `.github/workflows/github-pages.yml`: paths filter extended to code dirs;
  build job now installs Python 3.12 + `graphifyy[gemini]`, caches
  `graphify-out/cache` (7.6MB) keyed per-sha with prefix restore-keys, and runs
  the rebuild script before the website build.
- `GEMINI_API_KEY` stored as an encrypted GitHub repo secret via `gh secret set`
  (verified present in `gh secret list`). Key never written to any repo file.

## Test results (all real runs)
- Key validity: 503 "high demand" on first call = valid key, transient overload.
- `graphifyy[gemini]` extra: uses OpenAI-compatible endpoint (openai+tiktoken),
  NOT google-genai — initial ModuleNotFoundError was a red herring; stale
  interpreter path after `uv tool install --force` also re-resolved.
- Full local run of tools/rebuild_graph.py:
  AST 5,522 nodes / 16,674 edges; Gemini semantic 35 nodes / 10 edges
  (165,914 in / 5,155 out tokens); final graph 5,523 nodes / 15,274 edges /
  250 communities; LLM labels e.g. "Admin Operations API",
  "Security Middleware Tests", "Download and Auth Utilities".
- Shrink guard (#479) tripped once vs the older manual-extraction graph —
  verified as intentional full rebuild, exported with force=True.
- Site serves /graphify/index.html → 200, 243KB, 0 unpkg refs.

## Known caveats (honesty)
- Gemini flash is more conservative than my manual subagent extraction
  (35 vs 145 semantic nodes). Free-tier tradeoff; acceptable for CI freshness.
- Svelte files partially parse in tree-sitter (39 syntax warnings) — known
  upstream limitation, non-blocking.
- ⚠️ The API key was pasted in plaintext chat — ROTATE it after testing and
  re-run `gh secret set GEMINI_API_KEY`.
- Workflow still not committed (user's standing rule); activation requires
  commit+push of: .github/workflows/github-pages.yml, tools/rebuild_graph.py.

---

# Addendum 4 (same day): Full productivity overhaul — executed after grilling

Grilled across 3 rounds; all decisions settled, then executed. Key decisions:
scope=ALL; prepare-only (user commits); Renovate-only; protection w/ admin
bypass; Pages=graph-only; CF=marketing-only; manual tag gate; nightly strict;
graph-diff PR comments; ADRs x6; beads backlog; test-split top-5.

## API actions performed (approved, not git writes)
- Pages build_type legacy→workflow (fixes the 404 once first deploy lands).
- Branch protection on main: 4 required checks (Extension Tests & Coverage,
  Website Check/Tests/Build, CF Worker Tests & Lint, Go Oracle Backend Tests),
  force-push + deletion blocked, admin bypass preserved. Oracle CI checks NOT
  required (path-filtered workflows never report → would block unrelated PRs).

## Files created
- .github/workflows/nightly-tests.yml (cron 01:00 UTC, test:strict, deduped
  auto-issue w/ ci-failure label; label created via gh)
- tools/graph_diff.py (deterministic JSON graph diff → PR comment markdown)
- docs/adr/0000-template.md + 0001..0006 (host-split, beads, graphify-CI,
  renovate, pages-flip, pnpm-pinning)
- tools/rebuild_graph.py retargeted → stages graphify-out/site/ (standalone)
- website/src/lib/svgCatalog/types.ts (+ 6 siblings re-pointed; index re-exports)

## Files rewritten/deleted
- .github/workflows/github-pages.yml → graph-only pipeline w/ PR graph-diff
  (cache now carries graph.json.previous for diffs)
- DELETED: .github/dependabot.yml, .github/workflows/release-drafter.yml,
  .github/workflows/dependabot-auto-merge.yml (orphaned), website/static/graphify/
- website/src/routes/+layout.svelte: Graph nav link removed
- FIXED pre-existing bug: version-bump.yml line-86 dedent broke the run-block
  scalar (workflow was silently dead); re-indented, all 17 workflows parse

## Oracle test split (5 parallel agents, pure moves)
- 6,100 lines → 756 across 5 originals; 33 new concern files; 113 test funcs
  byte-for-byte preserved (sha/diff-verified per agent); final independent
  verify: go vet clean, go test ./internal/handlers ok 10.7s, gofmt clean
  (only pre-existing public_website_load_stress_test.go flagged — untouched)
- Bead Classroom-Quick-Downloader-0oe closed with evidence

## Beads
Filed 7: 3v2 svgCatalog(closed), oqn _worker audit(closed), 0oe test-split(closed),
v93 ADRs(closed), mj3 store-uploads(open), mml drift-commit(open, user),
5w5 key-rotation(open, user). bd close takes --reason (learned after 3 errors).

## Verified locally
- All 17 workflow YAMLs parse; graph_diff smoke-tested; rebuild_graph.py
  end-to-end w/ Gemini (stages graphify-out/site); svelte-check 0/0;
  placements+visual-guards 17/17; website build green; go test/vet/gofmt green.

## User actions remaining
1. Review + commit/push everything (2C mode) — suggested grouping in handoff.
2. Rotate Gemini key → gh secret set GEMINI_API_KEY (bead 5w5).
3. Commit pre-existing drift (bead mml).
4. After push: watch first "Build & Deploy Knowledge Graph" run → Pages 404 gone.

---

# Addendum 5 (2026-08-22): Critical fixes from full codebase review

Full review delivered in docs/CODEBASE_REVIEW_2026-08-22.md (2C/12H/20M/~25L).
This addendum covers the executed fixes; 12 HIGHs filed as beads for follow-up.

## CRITICAL 1 — Worker DO monolithic state blob (gvd, CLOSED)
Problem: entire DurableStateShape (~60 fields incl. 50k-event buffer, 50k
processedIds, telemetry queues) serialized as ONE storage.put per request path;
at scale the single value approaches the per-value limit → persist() throws →
every write fails simultaneously.
Fix: sharded into 6 keys (core / analytics_buffer / analytics_pending_batches /
analytics_processed_ids / analytics_website_telemetry / analytics_changelog);
load() re-assembles with transparent migration from legacy single blob; debug
reset clears shards; loginAttempts now pruned (15min×4 TTL + 500-entry cap,
oldest evicted) — also resolves HIGH cv8.
Verification: cloudflare-worker vitest 951/951 (after updating storage-coupled
tests in security.test.ts to a readFullState() merge helper), tsc --noEmit clean.

## CRITICAL 2 — emails page {@html} XSS sink (2g7, CLOSED)
Fix (page kept per user): new website/src/lib/emails/sanitize.ts —
sanitizeEmailCss strips every "<" (CSS never needs it → no style-tag breakout),
sanitizeEmailBodyHtml runs DOMPurify html profile w/ script/iframe/form forbids;
page renders only sanitized values. isomorphic-dompurify added (SSR-safe).
Verification: 9/9 new sanitize tests, svelte-check 0/0, production build green.

## Beads filed (12 HIGH follow-ups)
4un oracle-batch DLQ · cra cron mismatch · m3a event split-brain · b6a hidden
flush loss · 9vw snapshot pinning · hbk stale tabs · x2i drive_bypass consent ·
7hj V3 dead engine · yhx shadow-mode tax · 4d7 eslint patches · version-bump
GITHUB_TOKEN checks · (cv8 loginAttempts folded into gvd fix).

---

# Addendum 6 (2026-08-22): All 12 HIGHs fixed + repo-bot built

All 12 HIGH beads closed with evidence: worker DLQ (MAX_BATCH_ATTEMPTS=8 +
bounded dead-letter summaries), cron aligned to 1-22/3, event-flush unified to
worker endpoint w/ idempotent beacon retention, hidden-flush beacon fix,
snapshot next-pin restored, staged-gate self-heal (+60s store poll),
drive_bypass consent gate via pendingByBypassTabId + CQD_QUERY_BYPASS_CONSENT,
V3 registry fallback, DEFAULT_MODE shadow->legacy (mj7), eslint patches deleted,
version-bump RELEASE_PAT support. Extension 3394/3394, website 989/989,
worker 951/951 all green.

Loop-me session: workflows/repo-triage-burst.md (implementer-ready) +
workflows/release-ritual.md (sketch) + NOTES.md world model.

repo-bot built: workflows/scripts/repo_triage.py (burst + --serve daemon:
/status /prs /issues /security /deps /runs /plans /releases /triage; gh api
security sources incl dependabot/codeql/secret-scanning), install_launchd.sh.
Live-tested: dry-run brief correct (caught 20 failing endpoint-monitor runs;
bead xer filed); handlers verified vs live gh data (30 open PRs classified,
v1.5.6 draft surfaced, version-bump dispatch failure noticed). Pending from
user: @BotFather token -> chat_id -> ~/.config/cqd-workflows/telegram.env.
Real findings needing owner attention: endpoint monitor failing repeatedly;
a dispatched version-bump run failed on main (logs unavailable).
