#!/usr/bin/env node
// Unit tests for the scoped pre-push gate's decision core
// (tools/pre-push-scope.mjs). Pattern follows tools/verify-production.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan, WORKSPACE_GATES } from './pre-push-scope.mjs';

test('full gate: pushing to main', () => {
  assert.equal(buildPlan({ changedFiles: ['extension/src/a.ts'], pushingToMain: true, fullGateEnv: false, hasBase: true }).mode, 'full');
});

test('full gate: pushing to production (release lane, even docs-only)', () => {
  const plan = buildPlan({ changedFiles: ['docs/x.md'], pushingToMain: false, pushingToProduction: true, fullGateEnv: false, hasBase: true });
  assert.equal(plan.mode, 'full');
  assert.deepEqual(plan.legs, ['pnpm run test:gate']);
});

test('production flag defaults off so legacy callers stay scoped', () => {
  const plan = buildPlan({ changedFiles: ['extension/src/a.ts'], pushingToMain: false, fullGateEnv: false, hasBase: true });
  assert.equal(plan.mode, 'scoped');
});

test('full gate: CQD_FULL_GATE=1 overrides everything, even docs-only', () => {
  const plan = buildPlan({ changedFiles: ['docs/x.md'], pushingToMain: false, fullGateEnv: true, hasBase: true });
  assert.equal(plan.mode, 'full');
  assert.deepEqual(plan.legs, ['pnpm run test:gate']);
});

test('full gate: no merge-base determinable', () => {
  assert.equal(buildPlan({ changedFiles: [], pushingToMain: false, fullGateEnv: false, hasBase: false }).mode, 'full');
});

test('full gate: any non-workspace, non-doc file (root scripts, config, root e2e)', () => {
  for (const f of ['package.json', 'pnpm-lock.yaml', 'tools/x.mjs', '.husky/pre-push', '.github/workflows/ci.yml', 'tests/e2e/a.spec.ts']) {
    assert.equal(buildPlan({ changedFiles: [f], pushingToMain: false, fullGateEnv: false, hasBase: true }).mode, 'full', f);
  }
});

test('full gate: workspace change plus a root file escalates to full', () => {
  assert.equal(buildPlan({ changedFiles: ['extension/src/a.ts', 'package.json'], pushingToMain: false, fullGateEnv: false, hasBase: true }).mode, 'full');
});

test('docs-only push skips all legs', () => {
  const plan = buildPlan({ changedFiles: ['docs/INDEX.md', 'README.md', 'docs/engine/ENGINE_MODES.md'], pushingToMain: false, fullGateEnv: false, hasBase: true });
  assert.equal(plan.mode, 'skip');
  assert.deepEqual(plan.legs, []);
});

test('empty diff (no committed changes) runs nothing and passes', () => {
  const plan = buildPlan({ changedFiles: [], pushingToMain: false, fullGateEnv: false, hasBase: true });
  assert.equal(plan.mode, 'scoped');
  assert.deepEqual(plan.legs, []);
});

test('extension change maps to compile + test leg', () => {
  const plan = buildPlan({ changedFiles: ['extension/src/foo.ts'], pushingToMain: false, fullGateEnv: false, hasBase: true });
  assert.deepEqual(plan.legs, ['pnpm -C extension run compile && pnpm -C extension run test']);
});

test('each workspace maps to its strict leg', () => {
  const cases = {
    'website/src/a.svelte': 'pnpm -C website run test:strict',
    'cloudflare-worker/src/b.ts': 'pnpm -C cloudflare-worker run test:strict',
    'oracle-backend/internal/c.go': 'pnpm -C oracle-backend run test:strict',
  };
  for (const [file, leg] of Object.entries(cases)) {
    assert.deepEqual(buildPlan({ changedFiles: [file], pushingToMain: false, fullGateEnv: false, hasBase: true }).legs, [leg], file);
  }
});

test('multi-workspace push runs one leg per workspace, no duplicates', () => {
  const plan = buildPlan({
    changedFiles: ['extension/src/a.ts', 'extension/src/b.ts', 'website/src/routes/x/+page.svelte', 'cloudflare-worker/src/c.ts'],
    pushingToMain: false, fullGateEnv: false, hasBase: true,
  });
  assert.equal(plan.legs.length, 3);
});

test('workspace-internal markdown counts as docs (no gate for prose-only edits)', () => {
  const plan = buildPlan({ changedFiles: ['website/docs-notes.md', 'oracle-backend/README.md'], pushingToMain: false, fullGateEnv: false, hasBase: true });
  assert.equal(plan.mode, 'skip');
  assert.deepEqual(plan.legs, []);
});

test('every configured gate command targets a real workspace script', () => {
  for (const [prefix, command] of WORKSPACE_GATES) {
    const ws = prefix.replace(/\/$/, '');
    const pkg = JSON.parse(readFileSync(new URL(`../${ws}/package.json`, import.meta.url), 'utf8'));
    const scripts = pkg.scripts ?? {};
    const named = [...command.matchAll(/run ([\w:]+)/g)].map((m) => m[1]);
    assert.ok(named.length >= 1, `gate for ${ws} should invoke named scripts: ${command}`);
    for (const name of named) {
      assert.ok(scripts[name], `${ws} must declare script "${name}" (gate: ${command})`);
    }
  }
});
