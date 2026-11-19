import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard: static asset references must resolve to real files. The 2026-11-18
// website smoke crawl found two shipped anti-patterns:
//  1. `images/{b}.svg` — a template placeholder that was never interpolated,
//     so every footer install CTA requested a literal `{b}` file (404).
//  2. `poster="{resolve('')}/images/…"` — `resolve('')` returns `..` on
//     nested routes, building `..//images/…` (double slash → broken URL,
//     ERR_NAME_NOT_RESOLVED on the /watch pages).
// Both must stay fixed; asset attributes go through `resolvePath`, and every
// referenced asset file must exist in static/images.

function walkSvelte(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkSvelte(full));
    else if (entry.endsWith('.svelte')) out.push(full);
  }
  return out;
}

const SRC_DIR = new URL('.', import.meta.url).pathname;
const IMAGES_DIR = new URL('../../static/images/', import.meta.url).pathname;
const svelteFiles = walkSvelte(SRC_DIR);

describe('static asset references', () => {
  it('never ships an uninterpolated {placeholder} asset path', () => {
    const offenders = svelteFiles
      .filter((file) => readFileSync(file, 'utf8').includes('images/{b}.svg'))
      .map((file) => file.replace(SRC_DIR, ''));
    expect(offenders, `files still shipping images/{b}.svg: ${offenders.join(', ')}`).toEqual([]);
  });

  it('builds image asset attributes through resolvePath, not resolve("") concat', () => {
    const offenders = svelteFiles
      .filter((file) => /(?:src|poster)=["'{]*\{?resolve\(['"]{2}\)/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(SRC_DIR, ''));
    expect(
      offenders,
      `files building asset URLs from resolve(''): ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('references only image files that exist in static/images', () => {
    const referenced = new Set<string>();
    for (const file of svelteFiles) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/images\/([A-Za-z0-9._-]+\.(?:svg|webp|png|jpg))/g)) {
        referenced.add(match[1]);
      }
    }
    expect(referenced.size, 'expected the scan to see real asset references').toBeGreaterThan(0);
    const missing = [...referenced].filter((name) => {
      try {
        return !statSync(join(IMAGES_DIR, name)).isFile();
      } catch {
        return true;
      }
    });
    expect(missing, `referenced images missing from static/images: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('interpolates the per-browser footer icon from the loop key', () => {
    const footer = readFileSync(
      new URL('../lib/components/SiteFooter.svelte', import.meta.url),
      'utf8',
    );
    expect(footer).toContain('`images/${b}.svg`');
  });
});
