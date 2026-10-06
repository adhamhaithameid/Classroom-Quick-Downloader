// filepath: extension/tests/ui-water-fill.guard.test.ts
/**
 * Stillwater water-fill guard (Phase 4 batch D3, commit 1).
 *
 * The approved liquid loading treatment (prototypes/effects.html A1-A3)
 * ships as CSS-only pseudo-element layers inside the THREE injected button
 * sheets, fed by the EXISTING progress plumbing:
 *   - single pills: indeterminate slosh under .cqd-loading, determinate
 *     rise with byte-level progress (--cqd-progress) under .cqd-trying;
 *   - Download All: the tank — fill height = files done / files total, fed
 *     by --cqd-progress (V1 machines) or .cqd-all-busy + --cqd-progress
 *     (v2 machine).
 * Pins: the water layers exist in every sheet, terminal states stay out of
 * the water, and both reduce-motion gates keep a static level (never a
 * blank or frozen-odd state).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(EXTENSION_ROOT, rel), 'utf8');

// The three sheets a Classroom page can carry (flag-styles has no buttons).
const SHEETS: Array<{ id: string; label: string }> = [
  { id: 'cqd-style', label: 'V1 full sheet' },
  { id: 'cqd-sw-style', label: 'student-work sheet' },
  { id: 'cqd-v2-button-styles', label: 'v2 sheet' },
];

/** Render the three real button sheets into jsdom (fresh modules). */
async function injectAllSheets(): Promise<void> {
  vi.resetModules();
  const styles = await import('../entrypoints/content/styles');
  styles.injectStyles();
  styles.injectStudentWorkStyles();
  const buttonStyles = await import('../src/v2/render/button-styles');
  buttonStyles.injectV2Styles();
}

function sheetCss(id: string): string {
  return document.getElementById(id)?.textContent ?? '';
}

/** The WATER FILL … END WATER FILL section of a sheet. */
function waterSection(css: string): string {
  const match = css.match(/WATER FILL[\s\S]*END WATER FILL/);
  expect(match, 'water section present').not.toBeNull();
  return match?.[0] ?? '';
}

const TERMINAL_CLASSES = [
  'cqd-success',
  'cqd-error',
  'cqd-cancelled',
  'cqd-all-success',
  'cqd-all-error',
  'cqd-all-cancelled',
];

describe('water fill ships in every button sheet', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('defines the fill custom property, the slosh and the wave keyframes', async () => {
    await injectAllSheets();
    for (const { id, label } of SHEETS) {
      const section = waterSection(sheetCss(id));
      expect(section, label).toContain('@property --cqd-fill');
      expect(section, label).toMatch(/@keyframes\s+\S*[Ss]losh/);
      expect(section, label).toMatch(/@keyframes\s+\S*[Ww]ave/);
    }
  });

  it('draws the crest as an inline SVG data URL — no images, no new deps', async () => {
    await injectAllSheets();
    for (const { id, label } of SHEETS) {
      const section = waterSection(sheetCss(id));
      expect(section, label).toContain('url("data:image/svg+xml');
    }
  });

  it('single pill: water layers exist for the loading state in every sheet', async () => {
    await injectAllSheets();
    for (const { id, label } of SHEETS) {
      const section = waterSection(sheetCss(id));
      expect(section, label).toMatch(/cqd-loading::before/);
      expect(section, label).toMatch(/cqd-loading::after/);
    }
  });

  it('single pill: the trying state tracks byte-level progress (--cqd-progress)', async () => {
    await injectAllSheets();
    // V1 only: the v2 pipeline never puts a single button into 'trying' —
    // its in-flight state is the indeterminate slosh, and the byte-level
    // progress feed (CQD_DOWNLOAD_STATUS) belongs to the V1 message handler.
    for (const id of ['cqd-style', 'cqd-sw-style']) {
      const section = waterSection(sheetCss(id));
      expect(section, id).toMatch(/cqd-trying::before[^}]*--cqd-progress/);
    }
  });

  it('v2 Download All tank is gated on .cqd-all-busy', async () => {
    await injectAllSheets();
    const section = waterSection(sheetCss('cqd-v2-button-styles'));
    expect(section).toMatch(/cqd-download-all-btn\.cqd-all-busy::before/);
    expect(section).toMatch(/cqd-download-all-btn\.cqd-all-busy::after/);
  });

  it('V1 Download All tank is gated on the existing [data-cqd-group-active] busy mark', async () => {
    await injectAllSheets();
    for (const id of ['cqd-style', 'cqd-sw-style']) {
      const section = waterSection(sheetCss(id));
      expect(section, id).toMatch(
        /\[data-cqd-group-active="1"\][^{]*cqd-download-all-btn[^{]*::before/,
      );
    }
  });
});

describe('terminal states keep their current visuals — the water is loading-only', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('no terminal class survives outside a :not(...) exclusion in the water section', async () => {
    await injectAllSheets();
    for (const { id, label } of SHEETS) {
      const section = waterSection(sheetCss(id));
      const stripped = section.replace(/:not\([^)]*\)/g, '');
      for (const cls of TERMINAL_CLASSES) {
        expect(stripped, `${label} leaks ${cls}`).not.toContain(cls);
      }
    }
  });

  it('the V1 tank fill excludes all four group terminal classes while busy', async () => {
    await injectAllSheets();
    for (const id of ['cqd-style', 'cqd-sw-style']) {
      const section = waterSection(sheetCss(id));
      for (const cls of ['cqd-all-success', 'cqd-all-error', 'cqd-all-cancel', 'cqd-all-cancelled']) {
        expect(section, `${id}: ${cls}`).toMatch(new RegExp(`:not\\([^)]*${cls}`));
      }
    }
  });

  it('no water rule ever sets a green/red terminal background', async () => {
    await injectAllSheets();
    for (const { id, label } of SHEETS) {
      const section = waterSection(sheetCss(id));
      // The approved loading washes only: white (V1 solid pills) and the
      // blue loading hue (v2 light pills) + the dark-theme light blue.
      expect(section, label).toMatch(/rgba\(255,\s*255,\s*255|rgba\(26,\s*115,\s*232|rgba\(138,\s*180,\s*248/);
      expect(section, label).not.toMatch(/--cqd-color-success|--cqd-color-error|--cqd-color-cancel/);
    }
  });
});

describe('reduce-motion static fallbacks in every sheet (both gates)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('water statics exist under the OS media query AND the in-app class', async () => {
    await injectAllSheets();
    for (const { id, label } of SHEETS) {
      const section = waterSection(sheetCss(id));
      const media = section.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
      expect(media.length, `${label}: OS gate`).toBeGreaterThan(0);
      expect(section, label).toMatch(/html\.cqd-reduce-motion[^{]*\{/);
    }
  });

  it('the crest dies (display: none) and the slosh freezes at its mid level, never blank', async () => {
    await injectAllSheets();
    for (const { id, label } of SHEETS) {
      const section = waterSection(sheetCss(id));
      const media = section.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
      expect(media, label).toContain('display: none');
      expect(media, label).toContain('height: 24%');
      expect(media, label).toContain('animation: none');
      // The in-app gate carries the same contract.
      const inApp = section.split('html.cqd-reduce-motion').slice(1).join('');
      expect(inApp, label).toContain('display: none');
      expect(inApp, label).toContain('height: 24%');
      expect(inApp, label).toContain('animation: none');
    }
  });

  it('the in-app statics stay scoped to CQD artifacts (never the host page)', async () => {
    await injectAllSheets();
    for (const { id, label } of SHEETS) {
      const section = waterSection(sheetCss(id));
      for (const match of section.matchAll(/html\.cqd-reduce-motion\s+([^,{]+)[,{]/g)) {
        expect(match[1], `${label}: ${match[1]}`).toContain('.cqd-');
      }
    }
  });
});

describe('v2 machine feeds the water (unit)', () => {
  // Real coverage lives in v2-download-all-controller.test.ts; this guard
  // pins that the sheet's busy hook and the machine's feed agree on names.
  it('the busy class and progress custom property names match the machine feed', () => {
    const controller = read('src/v2/render/download-all-controller.ts');
    expect(controller).toContain("classList.add('cqd-all-busy')");
    expect(controller).toContain("setProperty('--cqd-progress'");
    expect(controller).toContain("classList.remove('cqd-all-busy')");
  });
});
