#!/usr/bin/env node
/*
 * scan.mjs - read-only git scanner for the Commit Planner.
 *
 * Collects: working-tree changes (main worktree + any linked worktrees),
 * unpushed commits per branch, local branch metadata, stashes.
 * Writes: data.json (machine) + data.js (window.CP_DATA for file:// use).
 *
 * READ-ONLY: every git invocation here is a read command. This script never
 * stages, commits, resets, or pushes anything.
 *
 * Usage:  node scan.mjs          (from tools/commit-planner or anywhere)
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const CORE = require("./core.js");
const HERE = dirname(fileURLToPath(import.meta.url));

// Repo root: the main worktree that owns this folder's git dir.
const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: HERE, encoding: "utf8" }).trim();
const REPO_SLUG = REPO_ROOT.split("/").pop().toLowerCase();

function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts }).trim();
}

function isoNow() {
  return new Date().toISOString();
}

// ------------------------------------------------------ working tree

// porcelain=v2 lines:
//   1 <XY> ... <path>          (changed, rename has two paths)
//   ? <path>                   (untracked)
function readStatus(cwd) {
  const raw = git(["status", "--porcelain=v2", "--branch", "--untracked-files=all"], { cwd });
  const files = [];
  let head = null;
  for (const line of raw.split("\n")) {
    if (line.startsWith("# branch.head ")) head = line.slice(14);
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("? ")) {
      files.push({ path: line.slice(2), status: "untracked", letters: "A", plus: null, minus: null });
      continue;
    }
    if (line.startsWith("1 ") || line.startsWith("2 ") || line.startsWith("u ")) {
      const parts = line.split("\t");
      const meta = parts[0].split(/\s+/);
      const kind = meta[0];
      const xy = meta[1];
      // v2 "1": 1 XY sub mH mI mW hH hI <path>      -> path at index 8
      // v2 "2": 2 XY sub score% mH... <path> <orig> -> path at index 9 (tab form: parts[1])
      // v2 "u": u XY sub1 sub2 sub3 m1 m2 m3 mW h1 h2 h3 <path> -> index 12
      const path = parts.length > 1 ? parts[1]
        : kind === "2" ? meta.slice(9).join(" ")
        : kind === "u" ? meta.slice(12).join(" ")
        : meta.slice(8).join(" ");
      const x = xy[0], y = xy[1];
      let status = "unstaged", letters = y !== "." ? y : x;
      if (kind === "u") { status = "unmerged"; letters = "UU"; }
      else if (x !== "." && y !== ".") { status = "partially"; letters = x + y; }
      else if (x !== ".") { status = "staged"; letters = x; }
      files.push({ path, status, letters, plus: null, minus: null });
    }
  }
  return { head, files };
}

function numstats(cwd) {
  const map = new Map();
  const absorb = (out) => {
    for (const line of out.split("\n")) {
      if (!line) continue;
      const [p, m, ...rest] = line.split("\t");
      const path = rest.join("\t");
      const prev = map.get(path) || { plus: 0, minus: 0 };
      prev.plus += p === "-" ? 0 : parseInt(p, 10);
      prev.minus += m === "-" ? 0 : parseInt(m, 10);
      map.set(path, prev);
    }
  };
  absorb(git(["diff", "--numstat", "HEAD"], { cwd }));
  return map;
}

// ---------------------------------------------------------- branches

function readBranches(surfaces) {
  const dirtyByPath = new Map(surfaces.map((s) => [s.path, s.files.length]));
  let remoteRefs = [];
  try {
    remoteRefs = git(["branch", "-r", "--format=%(refname:short)"]).split("\n").filter(Boolean);
  } catch { remoteRefs = []; }
  const names = git(["branch", "--format=%(refname:short)|%(objectname:short)|%(committerdate:iso-strict)|%(upstream:short)|%(worktreepath)"])
    .split("\n").filter(Boolean);
  const current = git(["branch", "--show-current"]);
  return names.map((line) => {
    const [name, short, date, upstream, wt] = line.split("|");
    let aheadVsOrigin = null;
    try { aheadVsOrigin = parseInt(git(["rev-list", "--count", `origin/main..${name}`]), 10); }
    catch { aheadVsOrigin = null; }
    const existsRemotely = remoteRefs.some((r) => r === `origin/${name}`);
    const dirtyFiles = wt && dirtyByPath.has(wt) ? dirtyByPath.get(wt) : (wt ? null : undefined);
    return {
      name, tip: short, tipDate: date, upstream: upstream || null,
      worktree: wt || null, aheadVsOrigin, existsRemotely,
      dirtyFiles: dirtyFiles == null ? null : dirtyFiles,
      isCurrent: name === current,
    };
  });
}

function readUnpushedCommits() {
  const fmt = "%H|%h|%cI|%s";
  const raw = git(["log", "origin/main..main", `--format=${fmt}`, "--name-only"]);
  const commits = [];
  let cur = null;
  const isHeader = (line) => /^[0-9a-f]{40}\|/.test(line);
  for (const line of raw.split("\n")) {
    if (!line) continue;
    if (isHeader(line)) {
      const parts = line.split("|");
      cur = { hash: parts[0], short: parts[1], date: parts[2], subject: parts.slice(3).join("|"), files: [] };
      commits.push(cur);
    } else if (cur) {
      cur.files.push(line);
    }
  }
  return commits;
}

// ----------------------------------------------------------- stashes

function readStashes() {
  try {
    const raw = git(["stash", "list", "--format=%gd|%cI|%gs"]);
    if (!raw) return [];
    return raw.split("\n").filter(Boolean).map((line) => {
      const [ref, date, ...rest] = line.split("|");
      return { ref, date, subject: rest.join("|") };
    });
  } catch { return []; }
}

// -------------------------------------------------------- worktrees

function readWorktrees() {
  const raw = git(["worktree", "list", "--porcelain"]);
  const out = [];
  let cur = null;
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) { cur = { path: line.slice(9) }; out.push(cur); }
    else if (line.startsWith("HEAD ")) cur.head = line.slice(6);
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace("refs/heads/", "");
  }
  return out.filter((w) => w.branch);
}

// Untracked noise gets collapsed so the planner stays readable:
//   - scanner state (.mimosa and friends): one row per top-2 segments
//   - any untracked top-level group over 25 files (qa-artifacts, test-results,
//     build output): one summary row. Real source/docs/test files never hide
//     inside these groups in practice; anything small stays listed.
function collapseToolState(files, cwd) {
  const keep = [], groups = new Map();
  for (const f of files) {
    if (f.status !== "untracked") { keep.push(f); continue; }
    const kind = CORE.kindOf(f.path, f.status);
    const bucket = kind === "toolstate" ? f.path.split("/").slice(0, 2).join("/") : f.path.split("/")[0];
    if (!groups.has(bucket)) groups.set(bucket, { tool: kind === "toolstate", paths: [], latest: null });
    const g = groups.get(bucket);
    g.paths.push(f.path);
  }
  for (const [bucket, g] of groups) {
    const forceCollapse = g.tool || g.paths.length > 25;
    if (process.env.CP_DEBUG) console.error(`[debug] bucket=${bucket} tool=${g.tool} n=${g.paths.length} collapse=${forceCollapse}`);
    if (!forceCollapse) { keep.push(...files.filter((f) => f.status === "untracked" && inBucket(f, bucket, g.tool))); continue; }
    // Bucket dir mtime as the summary date (files are not enriched yet).
    let latest = null;
    try { latest = statSync(join(cwd, bucket)).mtime.toISOString(); } catch { latest = null; }
    const why = g.tool ? "tool state" : "run artifacts";
    const label = g.tool
      ? bucket + " (.mimosa files: " + g.paths.length + " - do not commit)"
      : bucket + "/** (" + g.paths.length + " untracked files - " + why + ", do not commit)";
    keep.push({
      path: label, status: "untracked", letters: "A", plus: null, minus: null,
      date: latest, lastSubject: null, collapsedCount: g.paths.length,
      kind: g.tool ? "toolstate" : "artifact",
    });
  }
  return keep;
}
function inBucket(f, bucket, tool) {
  const kind = CORE.kindOf(f.path, f.status);
  return tool ? kind === "toolstate" && f.path.split("/").slice(0, 2).join("/") === bucket
              : kind !== "toolstate" && f.path.split("/")[0] === bucket;
}

// ------------------------------------------------------- enrichment

function enrich(f, cwd, surface, branch, nowIso) {
  const abs = f.path;
  if (f.status === "untracked") {
    try { f.date = statSync(join(cwd, abs)).mtime.toISOString(); } catch { f.date = nowIso; }
    f.lastSubject = null;
  } else {
    try {
      const line = git(["log", "--all", "-1", "--format=%cI|%s", "--", abs], { cwd });
      if (line) {
        const [d, ...s] = line.split("|");
        f.date = d;
        f.lastSubject = s.join("|");
      }
    } catch { /* never committed: fall through to mtime */ }
    // Staged-but-never-committed files (A status) have no history yet.
    if (!f.date) {
      f.lastSubject = null;
      try { f.date = statSync(join(cwd, abs)).mtime.toISOString(); } catch { f.date = nowIso; }
    }
  }
  const ns = surface.numstat.get(abs);
  if (ns && f.status !== "untracked") { f.plus = ns.plus; f.minus = ns.minus; }
  f.category = CORE.categoryOf(f.path);
  f.kind = f.kind || CORE.kindOf(f.path, f.status); // preserve collapsed-row kinds
  f.area = CORE.areaOf(f.path);
  f.task = CORE.taskOf(f.path);
  f.id = CORE.fileId(f.path);
  f.tags = CORE.tagsFor({ ...f, worktree: surface.slug ? surface.slug : null, branch }, nowIso);
  return f;
}

// ------------------------------------------------------------- main

function main() {
  const nowIso = isoNow();
  const worktrees = readWorktrees()
    .sort((a, b) => (a.path === REPO_ROOT ? -1 : b.path === REPO_ROOT ? 1 : 0)); // main surface first: its files win id collisions
  const surfaces = [];

  for (const wt of worktrees) {
    const slug = wt.path === REPO_ROOT ? null : "wt-" + wt.branch.split("/").pop();
    const st = readStatus(wt.path);
    const collapsed = collapseToolState(st.files, wt.path);
    const numstat = numstats(wt.path);
    const files = collapsed
      .map((f) => enrich(f, wt.path, { slug, numstat }, wt.branch, nowIso));
    files.sort((a, b) => a.path.localeCompare(b.path));
    surfaces.push({
      slug,
      path: wt.path,
      branch: wt.branch,
      head: st.head,
      relPath: wt.path === REPO_ROOT ? "." : wt.path.replace(dirname(REPO_ROOT) + "/", "../"),
      files,
    });
  }

  const branches = readBranches(surfaces);
  const commits = readUnpushedCommits();
  const stashes = readStashes();

  const toolState = surfaces[0].files.filter((f) => f.kind === "toolstate");
  const data = {
    planVersion: CORE.PLAN_VERSION,
    repo: REPO_SLUG,
    repoRoot: REPO_ROOT,
    generatedAt: nowIso,
    branches,
    commits,
    stashes,
    surfaces,
    stats: {
      filesTotal: surfaces.reduce((n, s) => n + s.files.length, 0),
      filesCommittable: surfaces.reduce((n, s) => n + s.files.filter((f) => f.kind !== "toolstate").length, 0),
      toolStateCount: toolState.length,
      commitsUnpushed: commits.length,
      stashes: stashes.length,
    },
  };

  writeFileSync(join(HERE, "data.json"), JSON.stringify(data, null, 1));
  writeFileSync(join(HERE, "data.js"), "window.CP_DATA = " + JSON.stringify(data) + ";\n");
  const human = new Date(nowIso).toLocaleString();
  console.log(`scanned ${REPO_SLUG} at ${human}`);
  console.log(`  files: ${data.stats.filesTotal} (${data.stats.toolStateCount} tool-state, ${data.stats.filesCommittable} committable)`);
  console.log(`  unpushed commits on main: ${data.stats.commitsUnpushed}`);
  console.log(`  branches: ${branches.length}, stashes: ${stashes.length}, worktrees: ${worktrees.length}`);
}

main();
