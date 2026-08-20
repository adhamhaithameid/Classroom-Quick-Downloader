// filepath: extension/tests/compare/compare-gating.test.ts
/**
 * Compare mode must not be reachable in a production build.
 *
 * Two independent guards: the constant is false outside a compare build, and
 * no production entrypoint imports the compare tree at all.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { IS_COMPARE_BUILD } from '../../src/compare/compare-mode';

const ROOT = process.cwd();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.output' || entry === '.wxt') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

function importsIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

describe('compare mode gating', () => {
  it('is off in any non-compare build', () => {
    // vitest runs in mode "test", never "compare".
    expect(IS_COMPARE_BUILD).toBe(false);
  });

  it('is not imported by any production entrypoint', () => {
    const offenders: string[] = [];

    for (const file of walk(resolve(ROOT, 'entrypoints'))) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      for (const spec of importsIn(file)) {
        if (spec.includes('/compare/') || spec.includes('compare-mode')) {
          offenders.push(`${rel} imports ${spec}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('reads the build mode rather than any storage key or runtime setting', () => {
    const source = readFileSync(resolve(ROOT, 'src/compare/compare-mode.ts'), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).toContain('import.meta.env.MODE');
    expect(code).not.toContain('storage');
    expect(code).not.toContain('cqdV2Mode');
  });
});
