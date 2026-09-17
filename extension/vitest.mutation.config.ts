// filepath: extension/vitest.mutation.config.ts
/**
 * ============================================================================
 * VITEST CONFIG FOR STRYKER MUTATION RUNS ONLY
 * ============================================================================
 *
 * Referenced exclusively by stryker.config.json (vitest.configFile). Regular
 * scripts (`pnpm test`, coverage, …) keep using vitest.config.ts untouched.
 *
 * Two deltas vs the base config, both required inside Stryker's sandbox
 * (extension/.stryker-tmp/sandbox-N, a copy of extension/ only):
 *
 * 1. tests/acquire-corpus.test.ts is excluded. Its PRODUCTION-side describe
 *    carries 11 pre-existing failures (the background-flow harness loads
 *    entrypoints/background/index.ts, whose Analytics.flush is undefined in
 *    the jsdom test env — tracked separately, not a core defect), and
 *    Stryker's dry run refuses to start while any test fails. The pure
 *    machine contract stays covered by tests/core/acquire/
 *    state-machine.test.ts and the fast-check suite in
 *    tests/acquire-properties.test.ts.
 *
 * 2. tests/acquire-properties.test.ts imports the repo-root simulator
 *    (../../tests/simulator/*). The sandbox does not contain the repo root,
 *    so that specifier is aliased to the REAL repo root — discovered by
 *    walking up until tests/simulator exists, which is correct both in the
 *    sandbox (extension/.stryker-tmp/sandbox-N → repo root, three levels up)
 *    and outside it (extension → repo root, one level up).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

function findRepoRootWithSimulator(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, 'tests', 'simulator'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start); // not found — fall back
    dir = parent;
  }
}

const here = __dirname;
const repoRoot = findRepoRootWithSimulator(here);

const baseAlias = baseConfig.resolve?.alias;
const aliasEntries: Array<{ find: string | RegExp; replacement: string }> = Array.isArray(
  baseAlias,
)
  ? baseAlias.map((entry) => ({
      find: entry.find as string | RegExp,
      replacement: String(entry.replacement),
    }))
  : Object.entries(baseAlias ?? {}).map(([find, replacement]) => ({
      find,
      replacement: String(replacement),
    }));

// `test.server.fs` is accepted by vitest's InlineConfig but its public return
// type narrows `server` away, so go through a structural supertype here.
type TestConfig = NonNullable<typeof baseConfig.test>;
type TestConfigWithFs = TestConfig & { server?: { fs?: { allow?: string[] } } };
const baseTest = baseConfig.test as TestConfigWithFs;
const baseAllow = baseTest?.server?.fs?.allow;

const mutationTestConfig = {
  ...baseConfig.test,
  exclude: ['tests/acquire-corpus.test.ts', ...configDefaults.exclude],
  server: {
    fs: {
      allow: [...(baseAllow ?? [here, path.resolve(here, '..')]), repoRoot],
    },
  },
} as TestConfig;

export default defineConfig({
  ...baseConfig,
  test: mutationTestConfig,
  resolve: {
    ...baseConfig.resolve,
    alias: [
      ...aliasEntries,
      {
        find: '../../tests/simulator',
        replacement: path.join(repoRoot, 'tests', 'simulator'),
      },
    ],
  },
});
