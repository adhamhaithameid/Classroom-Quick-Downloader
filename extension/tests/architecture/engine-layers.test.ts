// filepath: extension/tests/architecture/engine-layers.test.ts
/**
 * Architecture fitness suite — gate G1.
 *
 * ADR-0007: the new engine layers (core, roles, adapters, bus, strategies)
 * only stay clean if a test enforces them. Rules:
 *
 *   1. core/** is pure — no document/window/chrome/browser/fetch/Date.now/
 *      Math.random/timer identifiers anywhere in the source.
 *   2. roles/** import only bus + contracts, and no role file imports
 *      another role file (canary-enforced); roles/ holds >= 4 modules.
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

/**
 * Resolves a relative module specifier against the importer's src-relative
 * directory. Returns the src-relative target with any extension stripped, or
 * null when the specifier is bare/alias-style or resolves outside src.
 */
function resolveToSrc(spec: string, importerRel: string): string | null {
  if (!spec.startsWith('.')) return null;
  const parts = importerRel.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') {
      if (parts.length === 0) return null; // climbs out of src — out of scope
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  if (parts.length === 0) return null;
  return parts.join('/').replace(/\.(ts|js)$/, '');
}

/** True when `spec`, imported by the src-relative file `importerRel`,
 *  targets a file under src/roles/ other than the importer itself. */
function isRoleToRole(spec: string, importerRel: string): boolean {
  if (!importerRel.startsWith('roles/')) return false;
  if (!spec.startsWith('.')) {
    // Alias-style specifier that textually points into roles (e.g.
    // '@/roles/detect-engine'); the suite resolves no tsconfig paths, so the
    // textual match is the signal. Bare npm imports in a role are already
    // banned by the "roles import only bus and contracts" rule above.
    return /(^|\/)roles\//.test(spec);
  }
  const target = resolveToSrc(spec, importerRel);
  if (!target) return false;
  const self = importerRel.replace(/\.(ts|js)$/, '');
  return (target === 'roles' || target.startsWith('roles/')) && target !== self;
}

/**
 * Role-to-role scanner: the import specifiers in raw source `code` that
 * resolve into a sibling role file. `code` must be raw — no comment or string
 * stripping, because the specifiers themselves are string literals (the
 * codeOf idiom would erase them). The match covers `from '...'`, bare
 * side-effect imports (`import './sibling'`), and `export * from '...'`,
 * which importsIn's from-only regex would miss.
 */
function roleToRoleSpecs(code: string, importerRel: string): string[] {
  return [...code.matchAll(/\b(?:from|import)\s+['"]([^'"]+)['"]/g)]
    .map((m) => m[1]!)
    .filter((spec) => isRoleToRole(spec, importerRel));
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

  it('flags a role importing a sibling role in a violating snippet (scanner canary)', () => {
    // Fixture: a role reaching into a sibling role — the exact coupling the
    // S5 "roles behind the bus" architecture forbids; roles talk through the
    // orchestrator's page EventBus, never through each other's modules.
    expect(
      roleToRoleSpecs("import { detectFiles } from './detect-engine';", 'roles/compute-engine.ts'),
    ).toEqual(['./detect-engine']);
    expect(
      roleToRoleSpecs("import '../roles/render-engine';", 'roles/compute-engine.ts'),
    ).toEqual(['../roles/render-engine']);
    expect(
      roleToRoleSpecs("import { harden } from '../../roles/harden-engine';", 'roles/sub/compute-engine.ts'),
    ).toEqual(['../../roles/harden-engine']);
    // Bus, contracts, and engines/types remain the sanctioned imports…
    expect(
      roleToRoleSpecs("import type { EventBus } from '../bus/event-bus';", 'roles/compute-engine.ts'),
    ).toEqual([]);
    expect(
      roleToRoleSpecs("import type { PageTopicMap } from '../contracts/topics';", 'roles/compute-engine.ts'),
    ).toEqual([]);
    expect(
      roleToRoleSpecs("import type { FileNode } from '../engines/types';", 'roles/compute-engine.ts'),
    ).toEqual([]);
    // …a file is not its own sibling, and the rule only applies under roles/**.
    expect(roleToRoleSpecs("import './compute-engine';", 'roles/compute-engine.ts')).toEqual([]);
    expect(roleToRoleSpecs("import { x } from './y';", 'bus/event-bus.ts')).toEqual([]);
  });

  it('no role file imports another file under roles/', () => {
    const offenders: string[] = [];
    for (const file of walk(join(SRC, 'roles'))) {
      const importerRel = relToSrc(file);
      for (const spec of roleToRoleSpecs(readFileSync(file, 'utf8'), importerRel)) {
        offenders.push(`${importerRel} imports ${spec}`);
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

  it('roles/** holds all four S5 role modules so the role rules cannot pass vacuously', () => {
    expect(walk(join(SRC, 'roles')).length, 'src/roles has >= 4 modules').toBeGreaterThanOrEqual(4);
  });
});
