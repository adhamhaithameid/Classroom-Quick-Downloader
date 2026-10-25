#!/usr/bin/env node
// filepath: tools/mega-e2e/run.mjs
/**
 * ============================================================================
 * MEGA-E2E — the pre-deploy quality gate for Classroom Quick Downloader
 * ============================================================================
 *
 * Purpose: run EVERYTHING that can prove the extension works before any
 * store dispatch, and write a discovery report the operator (human or
 * agent) can read to understand failures, environment gaps, and DOM drift.
 *
 * Stages (each: pass / fail / skip-with-reason):
 *   build            extension chrome-mv3 + firefox-mv2 builds
 *   unit             full extension vitest suite (incl. security tests)
 *   golden           regression + fuzz + stress + visual sub-suites
 *   e2e-chromium     real-browser E2E on chromium (Chrome for Testing)
 *   e2e-edge         real-browser E2E on msedge (skipped if not installed)
 *   e2e-firefox      signed-Firefox QA leg (skipped if no staged signed.xpi)
 *   popup-qa         qa/ functional journeys incl. the popup surface
 *   live             real classroom.google.com suites (LIVE_CLASSROOM=1 +
 *                    signed-in tests/e2e/.live-profile required)
 *   drift            DOM-drift discovery probes (fixtures always; live page
 *                    too when the live stage runs) — this is the layer that
 *                    catches Google markup changes like bs7c BEFORE release
 *
 * Exit code: nonzero when any non-optional stage fails. Optional legs
 * (edge, firefox, live) fail the run only with --require-live /
 * --require-firefox, but every skip is written to the report with the exact
 * unlock command so nothing silently passes.
 *
 * Usage:
 *   node tools/mega-e2e/run.mjs                # full local matrix
 *   node tools/mega-e2e/run.mjs --quick        # build+unit+golden+chromium
 *   node tools/mega-e2e/run.mjs --require-live # store-dispatch mode
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ART = path.join(REPO, 'qa-artifacts', 'mega-e2e');
fs.mkdirSync(ART, { recursive: true });

const args = new Set(process.argv.slice(2));
const QUICK = args.has('--quick');
const REQUIRE_LIVE = args.has('--require-live');
const REQUIRE_FIREFOX = args.has('--require-firefox');

const report = {
  startedAt: new Date().toISOString(),
  gitSha: spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim(),
  extensionVersion: JSON.parse(fs.readFileSync(path.join(REPO, 'extension/package.json'), 'utf8')).version,
  environment: {},
  stages: [],
};

function discover() {
  const env = report.environment;
  env.node = process.version;
  env.macroEdgeInstalled = fs.existsSync('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  env.firefoxSignedXpi = fs.existsSync(path.join(REPO, 'extension/.output/signed.xpi'));
  env.liveProfile = fs.existsSync(path.join(REPO, 'tests/e2e/.live-profile/Default'));
  env.liveRequested = process.env.LIVE_CLASSROOM === '1';
  return env;
}

const stages = [];

function stage(name, { required = true, run, skip }) {
  stages.push({ name, required, run, skip });
}

function sh(cmd, cwd = REPO) {
  const t0 = Date.now();
  const res = spawnSync(cmd, { shell: true, cwd, encoding: 'utf8', env: process.env });
  return { code: res.status, out: (res.stdout || '') + (res.stderr || ''), ms: Date.now() - t0 };
}

const env = discover();

stage('build', {
  run: () => sh('pnpm -C extension run build'),
});
stage('unit', {
  run: () => sh('pnpm -C extension test', REPO),
});
stage('golden', {
  run: () => sh('pnpm -C extension run test:golden'),
});
stage('e2e-chromium', {
  run: () => sh('pnpm test:e2e'),
});
if (!QUICK) {
  stage('e2e-edge', {
    required: false,
    skip: () => (env.macroEdgeInstalled ? null : 'Microsoft Edge is not installed on this machine. Install it or run this stage on CI (full matrix runs there).'),
    run: () => sh('pnpm test:e2e:edge'),
  });
  stage('e2e-firefox', {
    required: REQUIRE_FIREFOX,
    skip: () => {
      if (env.firefoxSignedXpi) return null;
      return 'No signed xpi staged at extension/.output/signed.xpi. Mint one via the AMO QA companion (see docs/EXTENSION_TESTING_RUNBOOK.md), then re-run.';
    },
    run: () => sh('pnpm -C extension test:qa:firefox-signed'),
  });
  stage('popup-qa', {
    required: false,
    run: () => sh('pnpm exec playwright test --project=qa-chromium'),
  });
  stage('live', {
    required: REQUIRE_LIVE,
    skip: () => {
      if (!env.liveRequested) return 'LIVE_CLASSROOM=1 not set — live suites are opt-in (real Google account, own data only).';
      if (!env.liveProfile) return 'No signed-in profile at tests/e2e/.live-profile — run `pnpm test:live:login` once.';
      return null;
    },
    run: () => sh('LIVE_CLASSROOM=1 pnpm exec playwright test --project=live-chromium tests/e2e/live/'),
  });
}
stage('drift', {
  run: () => sh('node tools/mega-e2e/drift-probes.mjs'),
});

let failed = false;
for (const s of stages) {
  const skipReason = s.skip ? s.skip() : null;
  if (skipReason) {
    report.stages.push({ name: s.name, status: 'skip', reason: skipReason, required: s.required });
    console.log(`- ${s.name}: SKIP — ${skipReason}`);
    if (s.required) failed = true;
    continue;
  }
  process.stdout.write(`• ${s.name}… `);
  const res = s.run();
  const entry = {
    name: s.name,
    status: res.code === 0 ? 'pass' : 'fail',
    required: s.required,
    ms: res.ms,
    logTail: res.out.split('\n').filter(Boolean).slice(-15).join('\n').slice(0, 4000),
  };
  report.stages.push(entry);
  console.log(entry.status.toUpperCase() + ` (${(res.ms / 1000).toFixed(0)}s)`);
  fs.writeFileSync(path.join(ART, `${s.name}.log`), res.out);
  if (res.code !== 0 && (s.required || entry.status === 'fail')) failed = failed || s.required;
}

report.finishedAt = new Date().toISOString();
report.result = failed ? 'FAIL' : 'PASS';
fs.writeFileSync(path.join(ART, 'report.json'), JSON.stringify(report, null, 2));

// Human/agent-readable summary with the discovery layer up front.
const lines = [
  `# Mega-E2E report — ${report.result}`,
  ``,
  `- extension ${report.extensionVersion} @ ${report.gitSha}`,
  `- environment: edge=${env.macroEdgeInstalled ? 'yes' : 'no'}, signedXpi=${env.firefoxSignedXpi ? 'yes' : 'no'}, liveProfile=${env.liveProfile ? 'yes' : 'no'}, LIVE_CLASSROOM=${env.liveRequested ? '1' : 'unset'}`,
  ``,
  `| stage | status | notes |`,
  `| --- | --- | --- |`,
];
for (const s of report.stages) {
  lines.push(`| ${s.name} | ${s.status}${s.status === 'skip' && s.required ? ' (REQUIRED — unlock it)' : ''} | ${s.status === 'skip' ? s.reason : `${(s.ms / 1000).toFixed(0)}s`} |`);
}
fs.writeFileSync(path.join(ART, 'report.md'), lines.join('\n') + '\n');
console.log(`\n${report.result} — report: qa-artifacts/mega-e2e/report.md`);
process.exit(failed ? 1 : 0);
