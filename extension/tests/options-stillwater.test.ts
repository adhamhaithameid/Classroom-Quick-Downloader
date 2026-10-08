// filepath: extension/tests/options-stillwater.test.ts
/**
 * Stillwater on the options surface (D4 follow-up finding q320): the
 * options entry imported no stylesheet, so every .cqd-options rule sat
 * dormant in popup/App.css and the page rendered unstyled. The fix ships
 * the shared token foundation (src/ui/stillwater.css) to both surface
 * entries and gives options its own sheet. These guards pin the
 * presentation contract only; behavior keeps its own feature tests
 * (options-page.test.ts):
 *   - both surface entries import the shared foundation sheet;
 *   - the settings card is the popup's quiet card (14px radius, soft
 *     shadow, hairline border);
 *   - the type goes through the --cqd-fs-* scale, never raw px;
 *   - the affiliation notice sits in the translucent footer band;
 *   - the reduce-motion conventions ship on the options surface.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(EXTENSION_ROOT, rel), 'utf8');

/** First declaration block of a flat CSS rule — same helper as the popup frame guard. */
function block(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `missing selector ${selector}`).toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('stillwater options surface', () => {
  const shared = read('src/ui/stillwater.css');
  const optionsCss = read('entrypoints/options/options.css');

  it('both surface entries import the shared foundation sheet', () => {
    expect(read('entrypoints/popup/App.tsx')).toMatch(/import\s+['"].*ui\/stillwater\.css['"]/);
    expect(read('entrypoints/options/OptionsApp.tsx')).toMatch(
      /import\s+['"].*ui\/stillwater\.css['"]/,
    );
  });

  it('the options entry ships its own stylesheet (q320: it shipped none)', () => {
    expect(read('entrypoints/options/OptionsApp.tsx')).toMatch(/import\s+['"]\.\/options\.css['"]/);
  });

  it('the shared sheet declares the approved token foundation', () => {
    expect(shared).toContain('--cqd-fs-legal: 10px;');
    expect(shared).toContain('--cqd-fs-heading: 17px;');
    expect(shared).toContain('--cqd-radius-xl: 14px;');
    expect(shared).toContain('--cqd-shadow-soft: 0 2px 8px rgba(15, 23, 42, 0.05);');
    expect(shared).toContain('--cqd-transition-fast: 200ms cubic-bezier(0.22, 1, 0.36, 1);');
  });

  it('the settings card is the quiet popup card (14px radius, soft depth)', () => {
    const card = block(optionsCss, '.cqd-options-card');
    expect(card).toContain('border-radius: var(--cqd-radius-xl)');
    expect(card).toContain('box-shadow: var(--cqd-shadow-soft)');
    expect(card).toContain('var(--cqd-border-subtle)');
  });

  it('options type goes through the scale (no raw px font sizes)', () => {
    const sizes = [...optionsCss.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)];
    expect(sizes).toEqual([]);
  });

  it('rows and notes read through the muted/main text tokens', () => {
    expect(block(optionsCss, '.cqd-options-description')).toContain('var(--cqd-text-muted)');
    expect(block(optionsCss, '.cqd-options-label-primary')).toContain('var(--cqd-blue)');
  });

  it('the notice sits in the translucent footer band with a hairline', () => {
    const band = block(optionsCss, '.cqd-options-affil');
    expect(band).toContain('border-top: 1px solid var(--cqd-border-subtle)');
    expect(band).toContain('background: rgba(15, 23, 42, 0.03)');
    expect(band).toContain('font-size: var(--cqd-fs-legal)');
  });

  it('motion collapse conventions ship on the options surface', () => {
    expect(shared).toContain('.cqd-reduce-motion');
    expect(shared).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
