# GLOSSARY — Classroom Quick Downloader

Ubiquitous language for agents and humans. One meaning per term. Use these
words in chat, commits, beads, and docs. Verify details against code before
relying on them; docs can lag behind the code.

## Product and stores

- **CQD** — Classroom Quick Downloader, the browser extension (this repo).
- **Store release** — a version published to CWS (Chrome Web Store), AMO
  (addons.mozilla.org), and Edge Add-ons. Version lines live in
  `extension/package.json`; the next line is planned on bead `hlvn`.
- **Store listing** — the public AMO add-on record for CQD. Distinct from
  the QA companion.
- **QA companion** — the separate unlisted AMO add-on
  (`classroom-quick-downloader-qa@adhamhaitham.dev`, AMO id 3074760) used
  to produce signed Firefox builds for testing. Its versions are invisible
  to the AMO API (known Mozilla issue, web-ext#3913); its signed file is
  downloaded from the AMO dev hub UI and staged at
  `extension/.output/signed.xpi` (`QA_SIGNED_XPI`).
- **AMO dev hub** — addons.mozilla.org/developers, the owner's console for
  API keys, the QA companion, and signed files.
- **HITL check** — human-in-the-loop live-Classroom verification before a
  store publish. Manual, owner-run.
- **Survey issue** — a GitHub issue filed from an in-extension user report
  (`from-survey` label). Triage order lives on bead `sqa9`.
- **Store runbook** — `docs/STORE_PUBLISH_RUNBOOK.md` + the
  `extension-stores.yml` workflow (dispatch-only; Edge rejects versions
  not higher than the live one).

## Extension engine

- **Engine mode / EngineMode** — the detection pipeline selector
  (`legacy`, `new`, `api beta` pills in the popup; `EngineModeRow`).
- **Sidecar button** — the download button the content script injects on
  Classroom posts.
- **Attachment classification** — deciding which Classroom attachments are
  downloadable (Drive files, forms, materials). See
  `docs/ATTACHMENT_CLASSIFICATION_DESIGN_NOTE.md`.
- **Download pipeline** — the background download flow: content script
  request → bridge (`CQD_BRIDGE_REQUEST`/`CQD_BRIDGE_RESPONSE`) → service
  worker → `CQD_DOWNLOAD` settle → `CQD_DOWNLOAD_STATUS` events.
  `CQD_RUN_DOWNLOAD_ALL` is the popup's download-all path;
  `CQD_CANCEL_DOWNLOAD` aborts it.
- **Flags** — per-post UI toggles: edited-flag and comments-flag badge
  state, driven by storage and options. The #819 race fix lives here.
- **Levels / milestones** — the gamification ladder
  (`docs/GAMIFICATION.md`): download counts unlock rungs, celebrate once
  via `CQD_STATS_CLAIM_CELEBRATION`; legacy stats seed the lifetime count
  (bead `sxtf`).
- **Golden behavior matrix** — `docs/EXTENSION_GOLDEN_BEHAVIOR_MATRIX.md`,
  the regression contract for detection and download behavior.
- **Diagnostics page** — `extension/entrypoints/diagnostics` build info
  page with scrubbed, deny-by-default output (`cqd-diagnostics/1`).

## Tracker (bd + Dolt)

- **bd / bead** — the issue tracker CLI and one tracked issue. Issues live
  in the local Dolt database under `.beads/`.
- **Dolt database** — the versioned MySQL-like database inside `.beads/`.
  It is the source of truth for beads. It syncs to the git remote under
  `refs/dolt/data`. If it is lost or damaged, restore with `bd bootstrap`
  (clones from the remote; never deletes issues).
- **JSONL export** — `.beads/issues.jsonl`, a passive export of the
  tracker. It is NOT the wire protocol; do not treat it as source of truth.
- **BEAD ME UP** — the mandatory chat block printed after any `bd`
  mutation, so tracker changes are never silent.
- **bd remember** — persistent knowledge entries in the tracker. Preferred
  over ad-hoc memory files for repo-level facts.
- **Wayfinder map** — a planning bead that charts an epic into child beads
  before building (for example `i6a1`, `0h4d`, `csaa`).
- **In-progress / ready** — bead statuses; `bd ready` lists claimable work.

## Repo layout

- **Runtime surface** — an extension entrypoint under
  `extension/entrypoints/` (background, popup, options, content scripts,
  diagnostics). `extension/src/` is pure logic only.
- **Generated manifest** — `manifest.json` does not exist in the repo; WXT
  generates it from `extension/wxt.config.ts`.
- **Worktree** — a separate checkout via `git worktree` (for example
  `../CQD-wt-<topic>`). Parallel sessions share the primary checkout, so
  significant work happens in a dedicated worktree, announced in chat
  before creation and reported after.
- **Commit planner** — `tools/commit-planner/`; `scan.mjs` regenerates its
  `data.json` + `data.js` outputs. Never hand-edit those files.
- **Simulator** — the Vite app in `simulator/` that mounts the real popup
  against captured Classroom fixtures.
- **Fixtures** — sanitized captured Classroom HTML under
  `extension/tests/fixtures/classroom/`; ground truth for corpus and
  detection tests.

## CI and gates

- **Scoped pre-push gate** — the husky pre-push hook runs only the
  workspaces a push touches (`tools/pre-push-scope.mjs`); pushes to main
  run the full gate. It needs the PATH export from AGENTS.md.
- **Critical coverage gate** — CI's coverage check via
  `pnpm -C extension test:coverage:all`; bare `vitest --coverage` reports
  different numbers. Coverage profiles are selected by `COVERAGE_PROFILE`.
- **`[amo-qa]` leg** — the CI job that signs a QA companion build on AMO
  and runs the signed-Firefox E2E. Runs only on `workflow_dispatch` or a
  commit message containing `[amo-qa]`. Its sign step is
  `continue-on-error` by design.
- **Admin merge** — PRs merge via admin merge because a ruleset requires
  extra approval for unattributed changes. A green but BLOCKED merge state
  is normal.
- **E2E browser matrix** — `docs/E2E_BROWSER_MATRIX.md`; headless
  Playwright projects (`extension-chromium`, `extension-edge`, `qa-*`,
  `live-chromium`). Branded Chrome 137+ cannot load extensions (anti-abuse);
  Chrome for Testing (`extension-chromium`) and Edge still honor the flags.
- **Nightly tests** — `nightly-tests.yml`, the long full-matrix run.
- **Mega-E2E gate** — `scripts/mega-e2e` / `tools/mega-e2e/`, the pre-deploy
  quality gate: build, unit, golden, both browser E2E legs, popup QA, live
  suites, and DOM-drift probes. The stores workflow runs its CI side
  automatically before any publish; a dispatch cannot skip it. See
  docs/MEGA_E2E_GATE.md and the skill `.agents/skills/mega-e2e/SKILL.md`.
- **Drift probes** — the mega gate's discovery layer: required selector
  families are pinned against captured fixtures with a marker-ratio
  snapshot, so silent Google markup changes (like the 2026-10 `data-drive-id`
  removal, bead `bs7c`) fail the gate before they reach users.
- **CodeQL / Dependabot alerts** — GitHub security findings. Fix in code
  when cheap; dismiss with a written reason only when the fix is a tracked
  major migration (bead `jmvc`).

## Infrastructure

- **Worker** — `cloudflare-worker/`, the Workers API plus Durable Objects.
- **DO (Durable Object)** — the singleton holding download metrics and the
  flush alarm; flushes to KV daily. Poison batches go to a dead-letter path
  (`deadLetterHeadBatchIfExhausted`).
- **`/config`** — the extension config endpoint; quota-sensitive because
  every service-worker wake used to fetch it.
- **`/public/site-metrics`** — public website metrics endpoint; wrapped by
  `cachedKvGet` (memory TTL + single-flight + stale-on-error) since the
  2026-10-01 quota incident (Cloudflare error 1027).
- **KV site keys** — `site:v1:snapshot`, `site:v1:store`, `site:v1:amo`,
  `site:v1:scrape`, `site:v1:reliability`, `site:v1:notif`; one-year
  retention.
- **D1** — Cloudflare SQLite used by the worker for the event archive;
  `cqd_site_cache` is the database NAME (not the binding) for d1 exports.
- **Oracle backend** — `oracle-backend/` (Go). Severed from the live data
  path in 2026-09; kept for reference and optional cold archive.
- **Quota incident (2026-10-01)** — the 100k req/day free-tier exhaustion
  driven by ungated `/config` fetches; fixed by server-side shields in PR
  #814.
- **Storage export** — `/admin/storage-export`, the admin card that dumps
  DO + D1 + KV state.
- **Data backups** — the daily `data-backups.yml` workflow: repo CSV on
  the `data-backups` branch + live Google Sheet via service-account
  secrets. `d1 execute` needs the database name, never the binding.

## Website

- **Marketing site** — `website/` (SvelteKit) deployed on Cloudflare Pages.
- **Footer reveal** — the scroll-driven footer mechanic; sets
  translate/will-change on `<main>`.
- **Portal trap** — the footer reveal breaks `position:fixed` descendants;
  overlays must portal to `<body>` (`portalToBody`).
- **Testimonials section** — real store-review cards; data from
  `docs/testimonials/`; the shipped component is `TestimonialsSection.svelte`.
- **Prototype** — a standalone `website/prototype-*.html` design artifact
  approved by the owner before Svelte integration. Protected path.
- **Bootstrap snapshot** — `website/static/data/bootstrap-snapshot.json`;
  refreshed monthly by an auto-PR; feeds build-time aggregate rating.
- **IndexNow / GSC** — search indexing: IndexNow pings on deploy; Google
  Search Console sitemap submission via deploy-integrated credentials.
- **Knowledge graph** — the graphify explorer on the github.io URL
  (separate from the marketing site).

## Environment files

- **`extension/.env`** — dev-only convenience: `VITE_DEV_BROWSER_PATH`,
  `VITE_DEV_USER_DATA_DIR`, `VITE_WORKER_URL`. No secrets. Template:
  `extension/.env.example`. Safe to rewrite by hand.
- **Root `.env`** — optional owner file; nothing in the repo loads it
  automatically (no dotenv at the root). Scripts read `process.env`
  directly; CI values live in GitHub Actions secrets. Contents are the
  owner's choice; restore from the owner's records only.
- **`oracle-backend/.env`** — local dev passwords
  (`DASHBOARD_PASSWORD`, `SUPER_ADMIN_PASSWORD`) plus runtime settings;
  template in `oracle-backend/.env.example`. The oracle is severed, so
  these are dev-only. Rewritable: pick new values.
- **`cloudflare-worker/.dev.vars`** — local worker dev values
  (`DO_SHARED_SECRET`, `DANGER_PASSWORD`, `DASHBOARD_PASSWORD`,
  `ORACLE_ENDPOINT`, `ALLOW_INSECURE_ORACLE_ENDPOINT`). Production reads
  Cloudflare secrets and GitHub Actions secrets, never this file.
  Rewritable for local dev.
- **GitHub Actions secrets** — the real production values (AMO_JWT_*,
  CLOUDFLARE_API_TOKEN, CWS_REFRESH_TOKEN, GOOGLE_SHEETS_*, Edge
  api-key). Set via `gh secret set` or `scripts/set-amo-secrets.sh`.
  Values cannot be read back — re-set, do not try to view.
- **`.dev.vars` vs wrangler** — `wrangler dev` reads `.dev.vars`
  automatically; deploys never do.

## Operations rules that prevent past incidents

- **Never `git clean -fdX` / `git clean -X`** in this repo. Its excludes
  do not reliably protect `.beads/`, `.env*`, `.dev.vars`, or
  `extension/.output/signed.xpi`. Use `scripts/safe-clean` instead.
- **Protected paths** — `.beads/` (tracker DB), `.env` files,
  `cloudflare-worker/.dev.vars`, `extension/.output/signed.xpi`,
  `tools/commit-planner/data.*` (regenerate via `scan.mjs`), and the
  `website/prototype-*.html` design artifacts. Deleting any of them needs
  an explicit owner order, one file at a time.
- **safe-clean** — `scripts/safe-clean`; explicit target list, dry-run by
  default, `--yes` to apply, `--deep` for node_modules + pnpm store prune.
  It keeps protected files that live inside a target directory.
- **Non-interactive shell forms** — `cp -f`, `mv -f`, `rm -f`; never rely
  on unaliased prompts.
- **ASD-STE100** — the writing style for chat, commits, and docs: short
  active sentences, one meaning per word. Code identifiers and UI copy are
  exempt. See `docs/ASD_STE100_RULES.md`.
