/*
 * Commit Planner core tests. Run: node --test tools/commit-planner/tests/
 * No dependencies. Covers the shared logic in ../core.js and the shape of
 * ../data.json produced by ../scan.mjs.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const CORE = require("../core.js");
const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------- categories

test("categoryOf maps the five project areas plus docs/tooling", () => {
  assert.equal(CORE.categoryOf("website/src/app.css"), "website");
  assert.equal(CORE.categoryOf("cloudflare-worker/src/index.ts"), "cloudflare");
  assert.equal(CORE.categoryOf("oracle-backend/internal/handlers/x.go"), "oracle");
  assert.equal(CORE.categoryOf("extension/entrypoints/background/index.ts"), "extension");
  assert.equal(CORE.categoryOf("docs/LAUNCH_PACKAGE.md"), "docs");
  assert.equal(CORE.categoryOf("user-friendly-changelog.md"), "docs");
  assert.equal(CORE.categoryOf("package.json"), "tooling");
});

test("kindOf classifies tests, docs, config, toolstate, tracking", () => {
  assert.equal(CORE.kindOf("extension/tests/foo.test.ts", "staged"), "test");
  assert.equal(CORE.kindOf("docs/x.md", "staged"), "docs");
  assert.equal(CORE.kindOf("package.json", "staged"), "config");
  assert.equal(CORE.kindOf(".mimosa/history/run.json", "untracked"), "toolstate");
  assert.equal(CORE.kindOf(".beads/interactions.jsonl", "staged"), "tracking");
  assert.equal(CORE.kindOf("website/src/lib/content/changelog.manual.generated.json", "staged"), "content");
});

test("fileId is stable and 8 hex chars", () => {
  const a = CORE.fileId("extension/wxt.config.ts");
  assert.equal(a, CORE.fileId("extension/wxt.config.ts"));
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.notEqual(a, CORE.fileId("extension/wxt.config.bak.ts"));
});

// ------------------------------------------------------------- tags

test("tagsFor emits status, category, kind, ext, area, freshness, size", () => {
  const tags = CORE.tagsFor({
    path: "extension/tests/analytics-weekly-flush.test.ts",
    status: "untracked",
    letters: "A",
    date: new Date().toISOString(),
    plus: 40,
    minus: 0,
  }, new Date().toISOString());
  for (const expected of ["untracked", "cat:extension", "kind:test", "ext:ts", "area:analytics",
    "fresh-2d", "size:medium", "lines:+40/-0"]) {
    assert.ok(tags.includes(expected), "missing tag: " + expected + " in " + tags.join(","));
  }
});

// -------------------------------------------------- caveman-commit drafts

test("draftMessage: conventional subject, imperative, no trailing period", () => {
  const msg = CORE.draftMessage({
    path: "extension/entrypoints/utils/analytics/flush.ts",
    status: "partially", plus: 2, minus: 2,
    lastSubject: "feat(extension): weekly flush",
  }, undefined);
  assert.match(msg.subject, /^feat\(extension\): update analytics flush$/);
  assert.ok(!msg.subject.endsWith("."));
  assert.ok(msg.subject.length <= 72);
  assert.ok(msg.body.includes("flush.ts"));
});

test("draftMessage: untracked becomes 'add', type override respected, body always present", () => {
  const f = { path: "docs/STORE_LISTINGS.md", status: "untracked", plus: null, minus: null };
  const plain = CORE.draftMessage(f, undefined);
  assert.match(plain.subject, /^docs\(docs\): add store listings$/);
  assert.ok(plain.body.length > 0, "user style: every commit gets title AND description");
  const forced = CORE.draftMessage(f, "chore");
  assert.ok(forced.subject.startsWith("chore("));
});

// ------------------------------------------------------------ plan io

test("plan string round-trips through parsePlan", () => {
  const plan = {
    repo: "classroom-quick-downloader",
    groups: [
      { index: 1, date: "2026-09-19", slug: "analytics", ids: ["a1b2c3d4", "11112222"] },
      { index: 2, date: null, slug: null, ids: [] },
    ],
    pushes: [{ branch: "main", date: "2026-09-21" }],
  };
  const text = CORE.encodePlan(plan);
  assert.ok(text.startsWith("CQP1:classroom-quick-downloader|"));
  const parsed = CORE.parsePlan(text);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  assert.equal(parsed.repo, plan.repo);
  assert.equal(parsed.groups.length, 2);
  assert.deepEqual(parsed.groups[0].ids, ["a1b2c3d4", "11112222"]);
  assert.equal(parsed.groups[0].date, "2026-09-19");
  assert.equal(parsed.groups[0].slug, "analytics");
  assert.equal(parsed.pushes[0].branch, "main");
  // tolerant of stray markdown backticks when pasted from chat
  const messy = CORE.parsePlan("`" + text + "`\n");
  assert.equal(messy.ok, true);
});

test("parsePlan rejects garbage with errors, never throws", () => {
  for (const bad of ["", "nonsense", "CQP1:repo|X1@a:b", "CQP1:repo|G1@2026-09-19:zzzzzzzz"]) {
    const out = CORE.parsePlan(bad);
    assert.equal(out.ok, false, "should reject: " + JSON.stringify(bad));
    assert.ok(out.errors.length > 0);
  }
});

test("buildSequence: one file per commit, grouped under dated headers, push last", () => {
  const filesById = {
    a1b2c3d4: { path: "extension/wxt.config.ts", status: "staged", plus: 1, minus: 1, typeOverride: undefined },
    11112222: { path: "docs/LAUNCH_PACKAGE.md", status: "untracked", plus: null, minus: null, worktree: null },
  };
  const plan = {
    repo: "r",
    groups: [{ index: 1, date: "2026-09-19", slug: "docsy", ids: ["11112222", "a1b2c3d4"] }],
    pushes: [{ branch: "main", date: "2026-09-20" }],
  };
  const seq = CORE.buildSequence(plan, filesById, ".");
  const lines = seq.split("\n").filter(Boolean);
  assert.ok(lines.some((l) => l.startsWith("# ===== 2026-09-19")));
  const adds = lines.filter((l) => l.startsWith("git add"));
  assert.equal(adds.length, 2, "one add per file");
  const commits = lines.filter((l) => l.startsWith("git commit"));
  assert.equal(commits.length, 2, "one commit per file (one-file-per-commit rule)");
  // docs file sorts before config inside the group by requested order
  assert.ok(lines.findIndex((l) => l.includes("LAUNCH_PACKAGE")) < lines.findIndex((l) => l.includes("wxt.config")));
  const pushIdx = lines.findIndex((l) => l.startsWith("git push"));
  const lastCommitIdx = lines.findIndex((l) => l.startsWith("git commit"));
  assert.ok(pushIdx > lastCommitIdx);
});

test("buildSequence: worktree files use git -C, unknown ids get a warning line", () => {
  const filesById = {
    a1b2c3d4: { path: "extension/src/detect/x.ts", status: "unstaged", worktree: { cwd: "../CQD-wt-d12" } },
  };
  const seq = CORE.buildSequence({
    repo: "r",
    groups: [{ index: 1, date: null, slug: null, ids: ["a1b2c3d4", "deadbeef"] }],
    pushes: [],
  }, filesById, ".");
  assert.ok(seq.includes("git -C ../CQD-wt-d12 add"));
  assert.ok(seq.includes("unknown id deadbeef"));
});

// ------------------------------------------------- branch organization

test("classifyBranch: backup branches go to archive/<name> with publish risk", () => {
  const v = CORE.classifyBranch({
    name: "backup/main-original-root", tipDate: "2026-09-06T00:00:00Z",
    aheadVsOrigin: 4744, existsRemotely: false, worktree: null, isCurrent: false,
  });
  assert.equal(v.cat, "archive");
  assert.equal(v.suggestedRemote, "archive/backup-main-original-root");
  assert.ok(v.risks.some((r) => r.includes("publishes 4744")));
  assert.ok(v.deletable);
});

test("classifyBranch: current branch is not deletable and says so", () => {
  const v = CORE.classifyBranch({
    name: "main", tipDate: new Date().toISOString(), aheadVsOrigin: 175,
    existsRemotely: true, worktree: null, isCurrent: true,
  });
  assert.equal(v.cat, "current");
  assert.equal(v.deletable, false);
  assert.ok(v.risks.length > 0);
});

test("classifyBranch: worktree with dirt blocks deletion; clean + unique commit suggests push", () => {
  const wip = CORE.classifyBranch({
    name: "engine/x", tipDate: new Date().toISOString(), aheadVsOrigin: 0,
    existsRemotely: false, worktree: "../wt-x", dirtyFiles: 3, isCurrent: false,
  });
  assert.equal(wip.cat, "active-wip");
  assert.equal(wip.deletable, false);
  const archived = CORE.classifyBranch({
    name: "engine/d12-structural-fallback", tipDate: new Date().toISOString(),
    aheadVsOrigin: 1, existsRemotely: false, worktree: "../wt-d12", dirtyFiles: 0, isCurrent: false,
  });
  assert.equal(archived.cat, "worktree-branch");
  assert.equal(archived.suggestedRemote, "engine/d12-structural-fallback");
  assert.ok(archived.risks[0].includes("archived WIP"));
});

// -------------------------------------------------------- plan warnings

test("planWarnings: unknown id and noise planned are errors; no-date is a warning", () => {
  const plan = { repo: "r", groups: [
    { index: 1, date: null, slug: null, ids: ["ffffffff"] },
    { index: 2, date: "2020-01-01", slug: "x", ids: [] },
  ], pushes: [] };
  const w = CORE.planWarnings(plan, {}, "2026-09-18");
  assert.ok(w.some((x) => x.level === "error" && x.code === "unknown-id"));
  assert.ok(w.some((x) => x.level === "warn" && x.code === "no-date"));
  assert.ok(w.some((x) => x.level === "warn" && x.code === "past-date"));
});

test("planWarnings: partially staged and double-planned ids get the right levels", () => {
  const files = {
    a1b2c3d4: { path: "w/one.ts", status: "partially", kind: "source" },
    e5f6a7b8: { path: ".mimosa/x.json", status: "untracked", kind: "toolstate", collapsedCount: 9 },
  };
  const plan = { repo: "r", groups: [
    { index: 1, date: "2026-09-19", slug: "a", ids: ["a1b2c3d4", "e5f6a7b8"] },
    { index: 2, date: "2026-09-19", slug: "a", ids: ["a1b2c3d4"] },
    { index: 3, date: "2026-09-19", slug: null, ids: [] },
  ], pushes: [] };
  const w = CORE.planWarnings(plan, files, "2026-09-18");
  assert.ok(w.some((x) => x.code === "dup-id" && x.level === "error"));
  assert.ok(w.some((x) => x.code === "noise-planned" && x.level === "error"));
  assert.ok(w.some((x) => x.code === "partial-stage" && x.level === "warn"));
  assert.ok(w.some((x) => x.code === "dup-slug" && x.level === "warn"));
  assert.ok(w.some((x) => x.code === "empty-group" && x.level === "info"));
});

// ------------------------------------------------------- scan output

test("data.json exists, is fresh, and satisfies the documented shape", () => {
  const dataPath = join(HERE, "..", "data.json");
  assert.ok(existsSync(dataPath), "run `node scan.mjs` first");
  const d = JSON.parse(readFileSync(dataPath, "utf8"));
  for (const key of ["planVersion", "repo", "generatedAt", "branches", "commits", "stashes", "surfaces", "stats"]) {
    assert.ok(key in d, "missing key: " + key);
  }
  assert.equal(d.planVersion, CORE.PLAN_VERSION);
  const seen = new Set();
  for (const surface of d.surfaces) {
    for (const f of surface.files) {
      assert.ok(f.id && /^[0-9a-f]{8}$/.test(f.id), "bad id for " + f.path);
      assert.ok(!seen.has(f.id), "duplicate id " + f.id);
      seen.add(f.id);
      assert.ok(f.category && f.kind && f.task && Array.isArray(f.tags));
      if (f.status !== "untracked" && !f.collapsedCount) {
        assert.ok(f.date && f.lastSubject !== undefined, "tracked file missing git history: " + f.path);
      }
    }
  }
  for (const c of d.commits) {
    assert.ok(c.hash && c.date && c.subject && Array.isArray(c.files));
  }
  // stats must agree with the commit list they describe
  assert.equal(d.stats.commitsUnpushed, d.commits.length);
});
