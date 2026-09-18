// filepath: tests/e2e/qa/report-generator.mjs
/**
 * ============================================================================
 * REPORT GENERATOR — rebuilds qa-artifacts/report.md from artifacts ONLY
 * ============================================================================
 *
 * Consumes the per-check result.json files (never Playwright internals) and
 * renders a manual-runbook-style checklist so the report answers immediately:
 * "Which manual checks are automated, and which failed?"
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const ARTIFACTS = path.join(ROOT, "qa-artifacts");

function listRuns() {
  return fs
    .readdirSync(ARTIFACTS)
    .filter((name) => fs.statSync(path.join(ARTIFACTS, name)).isDirectory())
    .sort()
    .reverse();
}

function collectResults(runDir) {
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name === "result.json") {
        results.push(JSON.parse(fs.readFileSync(p, "utf8")));
      }
    }
  };
  walk(runDir);
  return results;
}

function renderCheck(r) {
  const icon = r.status === "passed" ? "✅ PASS" : r.status === "failed" ? "❌ FAIL" : "⏭ SKIP";
  const lines = [`- ${icon} \`${r.checkId}\` (${r.browser}) — ${r.runbookReference} · ${r.durationMs} ms`];
  if (r.failureClass) lines.push(`  - failure class: **${r.failureClass}**`);
  for (const a of r.assertions.filter((x) => !x.passed)) {
    lines.push(`  - failed assertion: ${a.description}${a.details ? ` — ${a.details.slice(0, 200)}` : ""}`);
  }
  for (const s of r.screenshots ?? []) lines.push(`  - screenshot: \`${s}\``);
  for (const d of r.downloads ?? []) {
    lines.push(`  - download: \`${d.filename}\` (${d.size} bytes${d.contentValid ? ", bytes valid" : ", BYTES INVALID"})`);
  }
  if (r.error) lines.push(`  - error: ${r.error.slice(0, 300)}`);
  return lines.join("\n");
}

const runs = listRuns();
if (runs.length === 0) {
  fs.writeFileSync(path.join(ARTIFACTS, "report.md"), "# QA Report\n\nNo runs recorded yet.\n");
  process.exit(0);
}

const runId = runs[0];
const runDir = path.join(ARTIFACTS, runId);
const results = collectResults(runDir);

const byBrowser = {};
for (const r of results) (byBrowser[r.browser] ??= []).push(r);

const summary = (rows) => {
  const passed = rows.filter((r) => r.status === "passed").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;
  const product = rows.filter((r) => r.failureClass === "PRODUCT").length;
  const harness = rows.filter((r) => r.failureClass === "HARNESS").length;
  const env = rows.filter((r) => r.failureClass === "ENVIRONMENT").length;
  return `Passed ${passed} · Failed ${failed} · Skipped ${skipped} (PRODUCT ${product}, HARNESS ${harness}, ENVIRONMENT ${env})`;
};

const out = [`# Manual-QA Replay Report`, ``, `- run: \`${runId}\``, ``];
for (const [browser, rows] of Object.entries(byBrowser)) {
  out.push(`## ${browser}`, ``, `Summary: ${summary(rows)}`, ``);
  for (const r of rows) out.push(renderCheck(r), ``);
}
out.push(`> Regenerate with \`pnpm test:qa:report\` — this file is derived from result.json artifacts only.`);

fs.writeFileSync(path.join(ARTIFACTS, "report.md"), out.join("\n") + "\n");
console.log(`report written: qa-artifacts/report.md (${results.length} checks)`);
