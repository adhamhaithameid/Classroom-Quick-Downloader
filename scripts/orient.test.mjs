// Minimal test for scripts/orient (run: node --test scripts/orient.test.mjs).
// Contract: exit 0, <=15 lines, first two lines are "branch:" and "last:".
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const orient = join(root, "scripts", "orient");

test("orient exits 0 and prints an orientation header", () => {
  const r = spawnSync(orient, { encoding: "utf8", cwd: root });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split("\n");
  assert.ok(lines.length >= 3, "expected at least branch/last/dirty lines");
  assert.match(lines[0], /^branch: /);
  assert.match(lines[1], /^last: /);
  assert.match(lines[2], /^dirty:  \d+ files/);
});

test("orient output stays within the 15-line budget", () => {
  const r = spawnSync(orient, { encoding: "utf8", cwd: root });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split("\n");
  assert.ok(lines.length <= 15, `output too long: ${lines.length} lines\n${r.stdout}`);
});

test("check rejects an unknown workspace with exit 2", () => {
  const r = spawnSync(join(root, "scripts", "check"), ["bogus"], {
    encoding: "utf8",
    cwd: root,
  });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /unknown workspace/);
});
