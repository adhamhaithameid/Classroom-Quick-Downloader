#!/usr/bin/env node
// Scoped pre-push gate (retro item Classroom-Quick-Downloader-lwwp).
//
// The old hook ran the full `pnpm run test:gate` chain (~13+ min) on every
// push. This scoper runs only the gates for the workspaces a push touches;
// anything unusual (push to main, root/unknown files, no determinable base,
// CQD_FULL_GATE=1) falls back to the full gate. CI remains the backstop:
// every PR runs the complete matrix there.
//
//   node tools/pre-push-scope.mjs           # what husky/pre-push calls
//   node tools/pre-push-scope.mjs --plan    # print the plan, run nothing
//
// Escape hatches: `git push --no-verify` (skip once), CQD_FULL_GATE=1.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FULL_GATE = 'pnpm run test:gate';

// path prefix -> gate command. Anything not matched here (and not docs-only)
// forces the full gate.
export const WORKSPACE_GATES = [
  ['extension/', 'pnpm -C extension run compile && pnpm -C extension run test'],
  ['website/', 'pnpm -C website run test:strict'],
  ['cloudflare-worker/', 'pnpm -C cloudflare-worker run test:strict'],
  ['oracle-backend/', 'pnpm -C oracle-backend run test:strict'],
];

const isDocPath = (p) => p.startsWith('docs/') || p.endsWith('.md') || p.startsWith('.github/agents/');

/**
 * Pure decision core, unit-tested in tools/pre-push-scope.test.mjs.
 * @param {{changedFiles: string[], pushingToMain: boolean, fullGateEnv: boolean, hasBase: boolean}}
 * @returns {{mode: 'full'|'scoped'|'skip', legs: string[]}}
 */
export function buildPlan({ changedFiles, pushingToMain, fullGateEnv, hasBase }) {
  if (fullGateEnv) return { mode: 'full', legs: [FULL_GATE] };
  if (pushingToMain) return { mode: 'full', legs: [FULL_GATE] };
  if (!hasBase) return { mode: 'full', legs: [FULL_GATE] };

  const touched = changedFiles.filter((f) => !isDocPath(f));
  if (touched.length === 0) {
    return { mode: changedFiles.length > 0 ? 'skip' : 'scoped', legs: [] };
  }

  const legs = [];
  let unknown = false;
  for (const f of touched) {
    const gate = WORKSPACE_GATES.find(([prefix]) => f.startsWith(prefix));
    if (!gate) { unknown = true; break; }
    if (!legs.includes(gate[1])) legs.push(gate[1]);
  }
  if (unknown) return { mode: 'full', legs: [FULL_GATE] };
  return { mode: 'scoped', legs };
}

function git(args, { allowFail = false } = {}) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0 && !allowFail) {
    console.error(`[pre-push-scope] git ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  return { out: (r.stdout || '').trim(), ok: r.status === 0 };
}

function main() {
  const printOnly = process.argv.includes('--plan');

  // husky feeds one "<local ref> <local sha> <remote ref> <remote sha>" line per ref.
  const stdin = readFileSync(0, 'utf8').trim();
  const pushingToMain = stdin
    .split('\n')
    .some((line) => line.trim().split(/\s+/)[2] === 'refs/heads/main');

  const fullGateEnv = process.env.CQD_FULL_GATE === '1';
  const mergeBase = git(['merge-base', 'HEAD', 'origin/main'], { allowFail: true });
  const hasBase = mergeBase.ok && !!mergeBase.out;
  const changedFiles = hasBase ? git(['diff', '--name-only', `${mergeBase.out}`, 'HEAD']).out.split('\n').filter(Boolean) : [];

  const plan = buildPlan({ changedFiles, pushingToMain, fullGateEnv, hasBase });

  if (plan.mode === 'full') {
    console.log(`[pre-push-scope] FULL gate (${fullGateEnv ? 'CQD_FULL_GATE=1' : pushingToMain ? 'pushing to main' : hasBase ? 'non-workspace files touched' : 'no merge-base with origin/main'}).`);
  } else if (plan.mode === 'skip') {
    console.log('[pre-push-scope] Docs-only push — workspace gates skipped. CI runs the full matrix on the PR.');
  } else {
    console.log(`[pre-push-scope] Scoped gate: ${changedFiles.length} changed file(s) -> ${plan.legs.length} leg(s).`);
  }
  for (const leg of plan.legs) console.log(`  $ ${leg}`);
  if (printOnly) return;

  for (const leg of plan.legs) {
    const r = spawnSync('sh', ['-c', leg], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.error(`[pre-push-scope] FAILED: ${leg}`);
      console.error('[pre-push-scope] Push aborted. (Skip once with --no-verify; force full gate with CQD_FULL_GATE=1.)');
      process.exit(r.status ?? 1);
    }
  }
  console.log('[pre-push-scope] Gate passed.');
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}
