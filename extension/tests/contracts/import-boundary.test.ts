// filepath: extension/tests/contracts/import-boundary.test.ts
/**
 * Enforces the one-way import rule of the detection seam.
 *
 *   Detect -> Decide -> Render
 *
 * Exactly one directory is allowed to know about keywords or page language.
 * If this test fails, someone reintroduced the coupling the seam removed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const SRC = resolve(process.cwd(), 'src');

/** Modules that make a file keyword-aware or language-aware. */
const FORBIDDEN = [
  'keyword-loader',
  'detection-keywords',
  'exclusion-engine',
  'smart-detector',
];

/**
 * The keyword layer itself. Files here are keyword-aware by definition, so
 * they cannot be "offenders" for importing each other.
 *
 * `detect/keyword/` is the seam's home. The two `v2/decision/` entries are the
 * legacy modules it wraps: `keyword-loader` owns the tables and page-language
 * detection, `exclusion-engine` reasons over matched page text. Both are
 * keyword-layer code that has not physically moved yet — relocating them under
 * `detect/keyword/` is a later, purely mechanical pass.
 *
 * `detection/index.ts` is a dead barrel (zero importers, left over from commit
 * 407a8484) that re-exports the V1 content scripts. The V1 path is keyword-
 * based by design and is explicitly untouched by this seam; it is stripped at
 * PRD Phase 4. Listed here so the boundary rule stays about the V2 path.
 */
const KEYWORD_LAYER = [
  'detect/keyword',
  'v2/decision/keyword-loader.ts',
  'v2/decision/exclusion-engine.ts',
  'detection/index.ts',
];

function inKeywordLayer(rel: string): boolean {
  return KEYWORD_LAYER.some((allowed) => rel === allowed || rel.startsWith(`${allowed}/`));
}

function walk(dir: string): string[] {
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
  const matches = source.matchAll(/from\s+['"]([^'"]+)['"]/g);
  return [...matches].map((m) => m[1]!);
}

describe('detection seam import boundary', () => {
  it('confines keyword and language imports to the keyword layer', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      if (inKeywordLayer(rel)) continue;

      for (const spec of importsIn(file)) {
        if (FORBIDDEN.some((f) => spec.includes(f))) {
          offenders.push(`${rel} imports ${spec}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the engine layer off the keyword modules', () => {
    // engines/ is orchestration. It reaches detection only through the seam.
    const offenders: string[] = [];

    for (const file of walk(join(SRC, 'engines'))) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      for (const spec of importsIn(file)) {
        if (FORBIDDEN.some((f) => spec.includes(f))) {
          offenders.push(`${rel} imports ${spec}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('lists only keyword-layer paths that actually exist', () => {
    // Stops the allowlist rotting into a way to silence real violations.
    for (const allowed of KEYWORD_LAYER) {
      expect(existsSync(join(SRC, allowed)), `${allowed} is allowlisted but absent`).toBe(true);
    }
  });

  it('keeps the decide layer free of any detect import', () => {
    const offenders: string[] = [];

    for (const file of walk(join(SRC, 'decide'))) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      for (const spec of importsIn(file)) {
        if (spec.includes('/detect/') || spec.includes('detect/keyword')) {
          offenders.push(`${rel} imports ${spec}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the contracts layer dependency-free apart from engine types', () => {
    const offenders: string[] = [];

    for (const file of walk(join(SRC, 'contracts'))) {
      const rel = relative(SRC, file).replace(/\\/g, '/');
      for (const spec of importsIn(file)) {
        if (spec.startsWith('.') && !spec.includes('engines/types') && !spec.startsWith('./')) {
          offenders.push(`${rel} imports ${spec}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
