// filepath: extension/tests/ui-typography-scale.guard.test.ts
/**
 * Stillwater typography guard (Phase 4 batch D1, commit 2).
 *
 * AUDIT.md findings 1-5, applied with the approved Direction A tokens
 * (prototypes/popup-direction-a.html §03 "The only scale used in this
 * direction"):
 *   - ONE type scale: 11 micro · 12 caption/control · 13 body · 15 title
 *     · 17 heading; 10 stays reserved for the legal line (the popup ships
 *     no legal line today, so no 10px exists on these surfaces).
 *   - ONE weight ramp: 400 / 500 / 600 only — 700/800/900 nowhere.
 *   - ONE font stack everywhere, injected pills included: the prototype's
 *     --font value. The old three stacks (system-ui variants + 'Google
 *     Sans', Roboto) and the dead Vite Inter stylesheet are gone.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(EXTENSION_ROOT, rel), 'utf8');

const STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const SIZE_TOKENS = [
  '--cqd-fs-legal: 10px;',
  '--cqd-fs-micro: 11px;',
  '--cqd-fs-caption: 12px;',
  '--cqd-fs-body: 13px;',
  '--cqd-fs-title: 15px;',
  '--cqd-fs-heading: 17px;',
];

/** Every `font-size: Npx` declaration in a CSS string. */
function fontSizes(css: string): number[] {
  return [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) =>
    Number.parseFloat(m[1]),
  );
}

/** Every `font-weight: N` declaration in a CSS string. */
function fontWeights(css: string): number[] {
  return [...css.matchAll(/font-weight:\s*(\d+)/g)].map((m) => Number.parseInt(m[1], 10));
}

describe('Stillwater type scale — popup + options (stillwater.css + surface sheets)', () => {
  // The token foundation moved to the shared sheet (q320); the popup and
  // options surface rules live in their entrypoint sheets.
  const stillwaterCss = read('src/ui/stillwater.css');
  const appCss = read('entrypoints/popup/App.css');
  const optionsCss = read('entrypoints/options/options.css');

  it('declares the reconciled font stack and the full size ramp as tokens', () => {
    expect(stillwaterCss).toContain('--cqd-font:');
    for (const token of SIZE_TOKENS) {
      expect(stillwaterCss).toContain(token);
    }
  });

  it('every font-size goes through the tokens (no raw px sizes left)', () => {
    // The scale lives in the --cqd-fs-* tokens; declarations reference them.
    expect(fontSizes(appCss)).toEqual([]);
    expect(fontSizes(optionsCss)).toEqual([]);
    expect(fontSizes(stillwaterCss)).toEqual([]);
  });

  it('the token ramp is exactly the Stillwater scale (10 legal-only … 17 heading)', () => {
    const defined = [...stillwaterCss.matchAll(/--cqd-fs-([a-z]+):\s*(\d+)px/g)].map(
      (m) => `${m[1]}:${m[2]}`,
    );
    expect(defined.sort()).toEqual([
      'body:13',
      'caption:12',
      'heading:17',
      'legal:10',
      'micro:11',
      'title:15',
    ]);
  });

  it('uses only the 400/500/600 weight ramp', () => {
    const weights = [
      ...new Set([
        ...fontWeights(appCss),
        ...fontWeights(optionsCss),
        ...fontWeights(stillwaterCss),
      ]),
    ].sort((a, b) => a - b);
    for (const weight of weights) {
      expect([400, 500, 600]).toContain(weight);
    }
    expect(weights).toContain(500);
    expect(weights).toContain(600);
  });

  it('the dead Vite dark-theme Inter stylesheet is gone (audit finding 1)', () => {
    let missing = false;
    try {
      read('entrypoints/popup/style.css');
    } catch {
      missing = true;
    }
    expect(missing).toBe(true);
    expect(read('entrypoints/popup/main.tsx')).not.toMatch(
      /^\s*import\s+['"]\.\/style\.css['"]/m,
    );
  });
});

describe('Stillwater stack — injected content UI (pills, buttons, badges)', () => {
  const SOURCES = [
    'entrypoints/content/styles.ts',
    'src/v2/render/button-styles.ts',
    'src/v2/render/flag-styles.ts',
  ];

  it('every font-family declaration is the single prototype stack (audit finding 5)', () => {
    for (const file of SOURCES) {
      const css = read(file);
      const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
      expect(families.length, file).toBeGreaterThan(0);
      for (const family of families) {
        expect(family, file).toBe(STACK);
      }
      expect(css, file).not.toMatch(/Inter\s*,|Google Sans/);
    }
  });

  it('content UI text stays on the 11/12/13 micro/body steps (audit finding 3)', () => {
    for (const file of SOURCES) {
      const sizes = [...new Set(fontSizes(read(file)))].sort((a, b) => a - b);
      expect(sizes.length, file).toBeGreaterThan(0);
      for (const size of sizes) {
        expect(size, file).toBeGreaterThanOrEqual(11);
        expect(size, file).toBeLessThanOrEqual(13);
      }
    }
  });
});
