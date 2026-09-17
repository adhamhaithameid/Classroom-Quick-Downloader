import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  ACTION_BUTTON_PATTERNS,
  findActionButtonPattern,
} from '../../../src/core/detect/action-buttons';

describe('core/detect/action-buttons', () => {
  it('is the union of the two historical literal tables', () => {
    const sources = new Set(ACTION_BUTTON_PATTERNS.map((p) => p.source));
    // keyword-scoring table (combined Arabic alternation form)
    for (const source of [
      'add\\s+(?:class\\s+)?comment',
      '(?:اضافة|إضافة|أضف)\\s+تعليق',
      'добавить\\s+комментарий',
      'コメントを追加',
      '添加评论',
      'ajouter.*commentaire',
      'kommentar.*hinzufügen',
      'añadir.*comentario',
      'write.*comment',
      'type.*comment',
      'post.*comment',
      'new\\s+comment',
      'leave.*comment',
    ]) {
      expect(sources.has(source), source).toBe(true);
    }
    // smart-detector's split Arabic variants are kept too
    for (const source of ['اضافة\\s+تعليق', 'إضافة\\s+تعليق', 'أضف\\s+تعليق']) {
      expect(sources.has(source), source).toBe(true);
    }
  });

  it('has no duplicate regex sources', () => {
    const sources = ACTION_BUTTON_PATTERNS.map((p) => p.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('matches the English action buttons it exists to exclude', () => {
    expect(ACTION_BUTTON_PATTERNS.some((p) => p.test('Add class comment'))).toBe(true);
    expect(ACTION_BUTTON_PATTERNS.some((p) => p.test('Add comment'))).toBe(true);
    expect(ACTION_BUTTON_PATTERNS.some((p) => p.test('إضافة تعليق'))).toBe(true);
  });

  it('looks patterns up by source and fails loudly on a miss', () => {
    expect(findActionButtonPattern('add\\s+(?:class\\s+)?comment').test('Add comment')).toBe(true);
    expect(() => findActionButtonPattern('nonexistent.*pattern')).toThrow();
    // The error carries the drifted source so the maintainer can diff the tables.
    expect(() => findActionButtonPattern('nonexistent.*pattern')).toThrow(
      'action-button pattern is not in the canonical table: nonexistent.*pattern',
    );
  });

  // D3 fitness — the whole point of the canonical table is that copies die.
  // A regex re-declared anywhere under src/ or entrypoints/ means the table
  // has started drifting again. The sanctioned ways to name a pattern outside
  // this module are importing ACTION_BUTTON_PATTERNS itself or a
  // findActionButtonPattern('...') lookup. V1's plain-phrase exclusion list
  // (detection-keywords) is a different matcher on purpose; its overlap with
  // the canonical sources is the V1/V2 exclusion asymmetry tracked by D14.
  it('is the only home of the table — no pattern source reappears in the source tree', () => {
    const extensionRoot = resolve(process.cwd());
    const scannedDirs = [join(extensionRoot, 'src'), join(extensionRoot, 'entrypoints')];
    const canonicalFile = join(extensionRoot, 'src', 'core', 'detect', 'action-buttons.ts');

    // Regex-shaped sources only: a copied TABLE always carries them. Plain
    // phrases without metachars (e.g. コメントを追加) are shared with V1's
    // phrase list and belong to D14, not to the regex-table drift this guards.
    const regexSources = ACTION_BUTTON_PATTERNS.map((p) => p.source).filter((source) =>
      /[$()*+?.[\]{}|\\^]/.test(source),
    );
    expect(regexSources.length).toBeGreaterThan(0);

    function* tsFiles(dir: string): Generator<string> {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
          if (entry === 'node_modules' || entry.startsWith('.')) continue;
          yield* tsFiles(path);
        } else if (entry.endsWith('.ts')) {
          yield path;
        }
      }
    }

    const violations: string[] = [];
    for (const dir of scannedDirs) {
      for (const file of tsFiles(dir)) {
        if (file === canonicalFile) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
          if (line.includes('findActionButtonPattern')) return;
          for (const source of regexSources) {
            if (line.includes(source)) {
              violations.push(`${file}:${index + 1}: "${source}"`);
            }
          }
        });
      }
    }

    expect(violations).toEqual([]);
  });
});
