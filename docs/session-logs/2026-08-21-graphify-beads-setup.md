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
