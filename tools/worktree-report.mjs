#!/usr/bin/env node
// worktree-report.mjs — READ-ONLY report of leftover agent artifacts.
//
// Why: the 2026-10-03 sessions retro found the owner asking "what are those
// (engine/d12 branch + worktree ... 5 old stashes)" — parallel agent work
// leaves worktrees, branches, and stashes behind and nobody remembers what
// they are. This tool lists them with ages and dirtiness so a human can
// decide keep/delete. It NEVER deletes, prunes, or checks out anything.
//
// Usage: node tools/worktree-report.mjs [--json]
// Exit code is always 0 (a report, not a gate).

import { execFileSync } from "node:child_process";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const git = (args, opts = {}) => execFileSync("git", args, { encoding: "utf8", cwd: ROOT, ...opts }).trim();
const lines = (s) => (s ? s.split("\n").filter(Boolean) : []);

// --- worktrees ---
const worktrees = [];
{
  // NOTE: keep empty lines — they separate porcelain entries.
  const raw = git(["worktree", "list", "--porcelain"]).split("\n");
  let cur = {};
  for (const line of raw) {
    if (line.startsWith("worktree ")) cur.path = line.slice(9);
    else if (line.startsWith("HEAD ")) cur.head = line.slice(5);
    else if (line.startsWith("branch ")) cur.branch = line.slice(7);
    else if (line === "bare") cur.bare = true;
    else if (line === "detached") cur.detached = true;
    else if (line === "") { if (cur.path) worktrees.push(cur); cur = {}; }
  }
  if (cur.path) worktrees.push(cur);
}
for (const wt of worktrees) {
  try {
    wt.dirty = git(["status", "--porcelain"], { cwd: wt.path }).split("\n").filter(Boolean).length;
    wt.lastCommit = git(["log", "-1", "--format=%cr|%h|%s"], { cwd: wt.path });
  } catch {
    wt.dirty = null; // worktree dir may be gone (prunable)
  }
}

// --- branches not merged into the mainline ---
const mainBase = git(["rev-parse", "--verify", "--quiet", "origin/main"]) ? "origin/main" : "main";
const unmerged = lines(git(["branch", "--no-merged", mainBase, "--format=%(refname:short)|%(committerdate:relative)|%(contents:subject)"]))
  .map((l) => { const [name, age, ...rest] = l.split("|"); return { name, age, subject: rest.join("|") }; });

// --- stashes ---
const stashes = lines(git(["stash", "list", "--format=%gd|%cr|%gs"]))
  .map((l) => { const [ref, age, ...rest] = l.split("|"); return { ref, age, subject: rest.join("|") }; });

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ mainBase, worktrees, unmerged, stashes }, null, 2));
} else {
  console.log(`Leftover artifact report for ${ROOT} (read-only; base: ${mainBase})\n`);
  console.log(`Worktrees (${worktrees.length}) — dirty = uncommitted files in that worktree:`);
  for (const wt of worktrees) {
    const dirt = wt.dirty == null ? "MISSING/PRUNABLE" : `${wt.dirty} dirty file(s)`;
    console.log(`  ${wt.path}  [${wt.branch ?? (wt.detached ? "detached" : "bare")}]  ${dirt}`);
    if (wt.lastCommit) console.log(`    last commit: ${wt.lastCommit.replaceAll("|", " · ")}`);
  }
  console.log(`\nBranches not merged into ${mainBase} (${unmerged.length}):`);
  for (const b of unmerged) console.log(`  ${b.name}  (${b.age})  ${b.subject}`);
  console.log(`\nStashes (${stashes.length}) — old ones are usually safe to drop, but ONLY by owner decision:`);
  for (const st of stashes) console.log(`  ${st.ref}  (${st.age})  ${st.subject}`);
  console.log("\nNo changes were made. Decide keep/delete per item yourself (or ask an agent to clean up specific entries).");
}
