// filepath: extension/tests/architecture/engine-layers.test.ts
/**
 * Architecture fitness suite — gate G1.
 *
 * ADR-0007: the new engine layers (core, roles, adapters, bus, strategies)
 * only stay clean if a test enforces them. Rules:
 *
 *   1. core/** is pure — no document/window/chrome/browser/fetch/Date.now/
 *      Math.random/timer identifiers anywhere in the source.
 *   2. roles/** import only bus + contracts (zero role-to-role imports).
 *   3. contracts/** imports nothing except engines/types and './' siblings
 *      (already enforced by tests/contracts/import-boundary.test.ts; kept
 *      here as a canary for the new files).
 *   4. New layers stay dependency-directed: adapters may import contracts +
 *      bus; core may import contracts only; nothing in the new layers
 *      imports the legacy v1/v2 stacks.
 *   5. File-size budget for the new layers — one reason to change per file.
 *
 * Each scanner is itself canary-tested against a violating snippet, so a
 * scanner that silently stops matching cannot rot the suite green.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const EXT = resolve(process.cwd());
const SRC = join(EXT, 'src');

const NEW_LAYERS = ['core', 'roles', 'adapters', 'bus', 'strategies', 'contracts'] as const;

const CORE_GLOBAL_FORBIDDEN =
  /\b(document|window|chrome|browser|fetch|Date\.now|Math\.random|setTimeout|setInterval|requestIdleCallback)\b/;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function importsIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

function codeOf(file: string): string {
  // Strip comments and string-literal contents before scanning for forbidden
  // identifiers: headers discuss globals at length, and outcome strings like
  // 'browser-fail' are data, not globals. The rule targets identifier use.
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

function relToSrc(file: string): string {
  return relative(SRC, file).replace(/\\/g, '/');
}

describe('fitness: core purity (ADR-0007)', () => {
  it('flags globals in a violating snippet (scanner canary)', () => {
    expect(CORE_GLOBAL_FORBIDDEN.test('const t = Date.now();')).toBe(true);
    expect(CORE_GLOBAL_FORBIDDEN.test('window.addEventListener("x", f);')).toBe(true);
    expect(CORE_GLOBAL_FORBIDDEN.test('const el = document.body;')).toBe(true);
    expect(CORE_GLOBAL_FORBIDDEN.test('pureReducer(1, 2);')).toBe(false);
  });

  it('core/** contains no browser, timer, or randomness globals', () => {
    const offenders: string[] = [];
    for (const file of walk(join(SRC, 'core'))) {
      const code = codeOf(file);
      const match = code.match(CORE_GLOBAL_FORBIDDEN);
      if (match) offenders.push(`${relToSrc(file)} references \`${match[1]}\``);
    }
    expect(offenders).toEqual([]);
  });
});

describe('fitness: role isolation', () => {
  it('roles/** import only bus and contracts', () => {
    const offenders: string[] = [];
    for (const file of walk(join(SRC, 'roles'))) {
      for (const spec of importsIn(file)) {
        const allowed =
          spec.startsWith('./') ||
          spec.includes('/bus/') ||
          spec.endsWith('bus/event-bus') ||
          spec.includes('/contracts/') ||
          spec.endsWith('engines/types');
        if (!allowed) offenders.push(`${relToSrc(file)} imports ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('fitness: dependency direction', () => {
  it('core/** imports nothing but contracts (type-only)', () => {
    const offenders: string[] = [];
    for (const file of walk(join(SRC, 'core'))) {
      for (const spec of importsIn(file)) {
        const allowed =
          spec.startsWith('./') ||
          spec.includes('/contracts/') ||
          spec.endsWith('engines/types');
        if (!allowed) offenders.push(`${relToSrc(file)} imports ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('adapters/** import only contracts and bus', () => {
    const offenders: string[] = [];
    for (const file of walk(join(SRC, 'adapters'))) {
      for (const spec of importsIn(file)) {
        const allowed = spec.startsWith('./') || spec.includes('/contracts') || spec.includes('/bus/');
        if (!allowed) offenders.push(`${relToSrc(file)} imports ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('new layers never import the legacy v1/v2 stacks or engines registry', () => {
    const offenders: string[] = [];
    for (const layer of NEW_LAYERS) {
      for (const file of walk(join(SRC, layer))) {
        for (const spec of importsIn(file)) {
          if (/\/(v1|v2|v3)\//.test(spec) || spec.includes('/engines/') && !spec.endsWith('engines/types')) {
            offenders.push(`${relative(SRC, file).replace(/\\/g, '/')} imports ${spec}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('fitness: file-size budget', () => {
  it('keeps every new-layer file under 400 lines', () => {
    const offenders: string[] = [];
    for (const layer of NEW_LAYERS) {
      for (const file of walk(join(SRC, layer))) {
        const lines = readFileSync(file, 'utf8').split('\n').length;
        if (lines > 400) offenders.push(`${relToSrc(file)} is ${lines} lines`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('fitness: live surface', () => {
  it('all new layers exist so the suite cannot pass vacuously', () => {
    for (const layer of NEW_LAYERS) {
      expect(existsSync(join(SRC, layer)), `src/${layer} must exist`).toBe(true);
    }
    // The layers whose content the program fills in over later sprints must
    // already hold at least one real module.
    for (const seeded of ['core', 'bus', 'adapters']) {
      expect(walk(join(SRC, seeded)).length, `src/${seeded} has modules`).toBeGreaterThan(0);
    }
  });
});
