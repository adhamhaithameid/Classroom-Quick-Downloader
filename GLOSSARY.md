# GLOSSARY — Classroom Quick Downloader

Ubiquitous language for agents and humans. One meaning per term. Use these
words in chat, commits, beads, and docs. Derived from docs/INDEX.md and the
tracker; verify details against code before relying on them.

## Product and stores

- **CQD** — Classroom Quick Downloader, the browser extension (this repo).
- **Store release** — a version published to CWS (Chrome Web Store), AMO
  (addons.mozilla.org), and Edge Add-ons. Version lines live in
  `extension/package.json`; the next line is planned on bead `hlvn`.
- **QA companion** — the separate unlisted AMO add-on
  (`classroom-quick-downloader-qa@adhamhaitham.dev`, AMO id 3074760) used to
  produce signed Firefox builds for testing. Distinct from the store
  listing. Its versions are invisible to the AMO API (known Mozilla issue,
  web-ext#3913); its signed file is downloaded from the dev hub UI and
  staged at `extension/.output/signed.xpi` (`QA_SIGNED_XPI`).
- **HITL check** — human-in-the-loop live-Classroom verification before a
  store publish. Manual, owner-run.
- **Survey issue** — a GitHub issue filed from an in-extension user report
  (`from-survey` label). Triage order lives on bead `sqa9`.

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

## CI and gates

- **Scoped pre-push gate** — the husky pre-push hook runs only the
  workspaces a push touches (`tools/pre-push-scope.mjs`); pushes to main
  run the full gate. It needs the PATH export from AGENTS.md.
- **Critical coverage gate** — CI's coverage check via
  `pnpm -C extension test:coverage:all`; bare `vitest --coverage` reports
  different numbers.
- **`[amo-qa]` leg** — the CI job that signs a QA companion build on AMO
  and runs the signed-Firefox E2E. Runs only on `workflow_dispatch` or a
  commit message containing `[amo-qa]`. Its sign step is
  `continue-on-error` by design.
- **Admin merge** — PRs merge via admin merge because a ruleset requires
  extra approval for unattributed changes. A green but BLOCKED merge state
  is normal.

## Infrastructure

- **Worker** — `cloudflare-worker/`, the Workers API plus Durable Objects
  (DO). The DO holds download metrics; `/config` is the extension config
  endpoint (quota-sensitive).
- **Oracle backend** — `oracle-backend/` (Go). Severed from the live data
  path in 2026-09; kept for reference.
- **Free/Pro split** — the plan split tracked by bead `0h4d` and
  `docs/ROADMAP_FREE_TO_PRO.md`.

## Operations rules that prevent past incidents

- **Never `git clean -fdX` / `git clean -X`** in this repo. Its excludes
  do not reliably protect `.beads/`, `.env*`, `.dev.vars`, or
  `extension/.output/signed.xpi`. Use `scripts/safe-clean` instead.
- **Protected paths** — `.beads/` (tracker DB), `.env` files,
  `cloudflare-worker/.dev.vars`, `extension/.output/signed.xpi`,
  `tools/commit-planner/data.*` (regenerate via `scan.mjs`), and the
  `website/prototype-*.html` design artifacts. Deleting any of them needs
  an explicit owner order, one file at a time.
