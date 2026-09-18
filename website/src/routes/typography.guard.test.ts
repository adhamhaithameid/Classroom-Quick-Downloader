import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The Google Fonts stylesheet loads Plus Jakarta Sans wght 200..800, so
// any font-weight: 900 silently clamps to 800. Guard against the dead
// declaration creeping back.
const WEIGHT_FILES = [
  'src/routes/+error.svelte',
  'src/routes/404/+page.svelte',
  'src/routes/privacy/+page.svelte',
  'src/routes/changelog/+page.svelte',
  'src/routes/faq/+page.svelte',
  'src/routes/uninstall/+page.svelte',
  'src/routes/overview/+page.svelte'
] as const;

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('typography micro-pass guards', () => {
  it('does not declare font-weight 900 that the loaded font range cannot render', () => {
    for (const file of WEIGHT_FILES) {
      expect(read(file), `${file} still declares a 900 weight`).not.toMatch(/font-weight:\s*9\d\d/);
    }
  });

  it('balances headings and pretty-wraps paragraphs globally', () => {
    const css = read('src/app.css');
    expect(css).toMatch(/h1,\s*h2,\s*h3\s*\{[^}]*text-wrap:\s*balance/);
    expect(css).toMatch(/\bp\s*\{[^}]*text-wrap:\s*pretty/);
  });

  it('uses tabular numerals for animated counters and metric values', () => {
    const css = read('src/app.css');
    const metricBlock = css.match(/\.metric-value\s*\{[^}]*\}/)?.[0] ?? '';
    expect(metricBlock).toContain('font-variant-numeric: tabular-nums');

    const animated = read('src/lib/components/AnimatedNumber.svelte');
    const animatedBlock = animated.match(/\.animated-number\s*\{[^}]*\}/)?.[0] ?? '';
    expect(animatedBlock).toContain('font-variant-numeric: tabular-nums');
  });
});
