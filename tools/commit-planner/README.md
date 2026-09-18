# Commit Planner

A self-hosted, dependency-free helper for turning a messy working tree into a
deliberate, dated commit plan. It scans every local branch and worktree,
lists every change with category / task / tags, lets you group files and
schedule dates on a calendar, then emits:

- a **plan string** you paste to an agent (it encodes groups, files, dates, pushes), and
- a **shell script** with one file per commit, in caveman-commit style.

The tool is **read-only toward git**. It never stages, commits, resets, or
pushes. It only produces text you review and run (or hand to an agent).

## Quick start

```bash
node tools/commit-planner/scan.mjs      # read-only git scan -> data.json + data.js
open tools/commit-planner/index.html    # no server, no build, runs from file://
```

Rescan after more work changes; file IDs stay stable across rescans, so an
existing plan keeps working. `data.json` / `data.js` are generated artifacts.

Deep links (useful for bookmarking and for agent-driven screenshots):

- `index.html?tab=calendar` - open a specific tab (`files|commits|branches|calendar|export`)
- `index.html?demo=1` - seed an in-memory sample plan (never saved)
- `index.html?selftest=1` - run the in-page self-check on load

## The screen

The four numbered tabs are the intended flow; *Unpushed commits* is reference.

1. **Triage** - every working-tree change across the main checkout and linked
   worktrees. Status, task (inferred), tags, date, plan state per row. Click a
   row to expand: diff size, last commit touching the file, inline warnings
   (partial staging, duplicate surfaces, noise), draft commit message, commit
   type override. A sticky bottom bar appears when files are selected: add to
   group / create group / clear. Badge legend lives under "what the badges
   mean". Press `/` to focus search; `Esc` clears selection.
2. **Organize branches** - the workspace organizer. Worktrees outside the
   folder get a state/verdict/risks card; every local branch is classified
   (current / active-wip / worktree-branch / active / stale / archive /
   merged-idle / tracking) with a suggested remote home. Actions
   (publish, push-as-archive, delete local) open a confirm modal that spells
   out the exact command and its consequences, then stage it in a
   **command queue** you copy and run yourself. "Build full organization
   sequence" proposes homes for all branches at once.
3. **Schedule** - month calendar. Pick the active group, click a day to
   commit it then (moving an existing date asks first; undo is offered).
   Unscheduled groups sit in "Waiting for a date". Pushes render on their
   day and are scheduled in the rail.
4. **Review & export** - the warnings panel (errors block one-click copy on
   purpose; copy-overrides require a confirmed override), the commit script
   (one file per commit, grouped by date, worktree-aware `git -C`),
   copy/download, the plan string for agent handoff, self-check, and JSON
   backup/restore.

The right rail is the live plan summary: groups (date pickers, remove files),
pushes, counts. The plan autosaves to `localStorage`.

## Workflow: from scan to committed

1. `node scan.mjs`, open `index.html`.
2. Skim the Files tab; use the auto-group buttons (by category / task /
   status) or select rows and build groups by hand.
3. Date each group in the rail or on the calendar; schedule pushes.
4. Export tab: copy the script (review it first), **or** copy the plan
   string and paste it to your agent with something like:
   > Here is the commit plan: `<paste>`. Read
   > tools/commit-planner/README.md for the format, then execute it:
   > one file per commit, dates from the plan, push on the push dates.
5. The agent re-runs `scan.mjs`, maps IDs to paths from `data.json`, and
   commits accordingly.

## Plan string format (CQP1)

Pipe-separated segments:

```
CQP1:<repo>|G<index>[@YYYY-MM-DD][~<slug>][:<id8>,<id8>...]|P<branch>@YYYY-MM-DD
```

- `CQP1:classroom-quick-downloader` - version + repo slug (mismatch is
  rejected on load).
- `G1@2026-09-19~analytics:a1b2c3d4,e5f60718` - group 1, commits on that
  date, named "analytics", containing those file IDs. Date `-` means
  unscheduled; the id list may be empty.
- `Pmain@2026-09-21` - push branch `main` on that date.

Example:

```
CQP1:classroom-quick-downloader|G1@2026-09-19~analytics:164d5766,55503405|G2@-~docs:84369399|Pmain@2026-09-20
```

**File IDs** are the first 8 hex chars of the SHA-256 of the repo-relative
path - stable across rescans, unique per path. If a pasted ID is missing
from the current scan (file committed or deleted), the UI self-check and the
export script flag it instead of guessing.

For richer handoff (commit-type overrides etc.) use **backup / restore >
export plan JSON** in the rail and attach the JSON; the plan string stays
the quick channel.

## Scan scope (read this before asking "where is X?")

- **Working-tree changes**: main checkout + every linked worktree (e.g.
  `../CQD-wt-d12` outside the repo folder). Same path changed in two
  surfaces at once is flagged "also in <surface>" on the row; commit each
  surface separately.
- **Commit lists**: unpushed commits are enumerated for `main`
  (`origin/main..main`). Other local branches get ahead-counts and notes on
  the Branches tab instead of full commit lists - in this repo the only
  far-ahead branches are pre-rewrite history backups (thousands of stale
  commits), which would drown the plan in noise. Change `readUnpushedCommits`
  in `scan.mjs` if you ever need another branch enumerated.
- **"Out of the project folder"** means linked worktrees; the scanner does
  not wander the rest of the disk.
- **Unmerged (conflicted) files** are listed with status `UU`; resolve them
  before planning commits.

## Commit messages

Drafts follow the caveman-commit style with one house rule on top: every
commit gets a title AND a description. The description is factual context
(diff size vs HEAD, last commit that touched the file) - refine the why
when you have it. Conventional subject (`type(scope): imperative summary`,
<= 72 chars). Type defaults: test files -> `test`, markdown -> `docs`,
everything else -> `feat` (override per file in the expanded row). Subject
wording is a draft - review the export before running.

## Noise handling

The repo `.gitignore` carries the recurring noise (`.mimosa/`,
`qa-artifacts/`, `gui-test-screenshots/`, `.superpowers/tmp/`, `.zcode/`,
planner-generated data files), so scans stay small. The planner still
collapses anything similar that reappears - scanner state and any untracked
top-level group over 25 files become single "do not commit" rows, hidden by
default via *hide noise*. Planning one anyway raises an error-level warning
on Review. Consider this before deleting the ignore rules.

## Error prevention

- Risky intents (push, delete branch, replace groups, load/clear plan, copy
  with errors) all pass through a confirm modal that names the exact command
  and lists consequences before anything is staged.
- Destructive plan edits (delete group, remove file, clear plan, move date)
  are undoable from the toast that follows them.
- `planWarnings` runs on every render of Review: unknown/stale ids, files
  planned twice, noise planned, partial staging, past or missing dates,
  duplicate group names, empty groups. Errors block one-click copy.
- The tool never executes git. The workspace organizer only stages reviewed
  commands in a copyable queue.

## Development

```
tools/commit-planner/
  scan.mjs        read-only git scanner (Node >= 18, no deps)
  core.js         shared logic: categories, tags, IDs, plan codec, script builder
  app.js          UI (vanilla JS)
  styles.css      dark operational theme
  index.html      shell; loads core.js + data.js + app.js
  data.json       generated: machine-readable scan (agents read this)
  data.js         generated: same data as window.CP_DATA for file:// use
  tests/          node --test suites
```

Run tests:

```bash
node --test tools/commit-planner/tests/core.test.mjs
```

The tests cover: category/kind mapping, ID stability, tag emission, commit
draft style rules, plan-string round-trip (including pasted-with-backticks
tolerance), rejection of malformed plans, one-file-per-commit sequencing,
worktree `git -C` handling, unknown-ID warnings, and `data.json` shape.

### Use cases

- **A - Triage a big dirty tree**: scan, auto-group by category, review,
  schedule, export, run.
- **B - Agent-assisted commits**: build a plan in the UI, paste the plan
  string into a session; the agent executes it on the planned dates.
- **C - Delayed pushes**: leave groups unscheduled, schedule only pushes;
  the script becomes push-only until you date the groups.
- **D - Re-planning after more work**: rescan and reload; IDs survive, the
  self-check flags anything that disappeared.
- **E - Audit**: the Commits and Branches tabs answer "what is unpushed and
  where" without touching git.

### Design rules

- The planner never mutates git state; the scanner only reads.
- File identity is path-derived, never row-order-derived.
- One file, one commit; one group, one date.
- Everything renders and persists locally; no network calls.
