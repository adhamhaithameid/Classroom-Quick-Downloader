import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* Guards for the magnetic CTA system. These read source files directly (same
   approach as the SEO regression guards) because the interesting invariants
   are structural, not runtime: where the effect is wired, what it must never
   touch, and that the shipped feel constants stay in sync with the approved
   prototype. The motion math itself is covered by magneticField.test.ts. */

const WEBSITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ACTION_SRC = 'src/lib/actions/magnetic.ts';
const MOTION_SRC = 'src/lib/motion/magneticField.ts';
const APP_CSS = 'src/app.css';
const PROTOTYPE_HTML = 'prototype-magnetic.html';

/* Every file allowed to wire the effect, with its exact directive count.
   A new use:magnetic anywhere else fails the sweep test below. */
const WIRED_FILES: Record<string, number> = {
  'src/routes/overview/+page.svelte': 2, // hero loop (conditional) + silly reveal
  'src/routes/overview-editor/+page.svelte': 3, // hero + silly + final, all conditional or green
  'src/lib/components/SeoContentPage.svelte': 1, // primary CTA, covers all guide pages
  'src/routes/privacy/+page.svelte': 1,
  'src/routes/faq/+page.svelte': 1,
  'src/routes/uninstall/+page.svelte': 2, // detected-browser reinstall + submit while enabled
  'src/routes/404/+page.svelte': 1,
  'src/routes/+error.svelte': 1
};

/* Navbar, footer, and anything else must stay magnetic-free. */
const FORBIDDEN_FILES = ['src/routes/+layout.svelte', 'src/lib/components/SiteFooter.svelte'];

function read(path: string): string {
  return readFileSync(join(WEBSITE_ROOT, path), 'utf8');
}

function* walkSvelte(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walkSvelte(full);
    else if (name.endsWith('.svelte')) yield full;
  }
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('magnetic wiring scope', () => {
  it('wires exactly the approved elements, no more no less', () => {
    for (const [file, expected] of Object.entries(WIRED_FILES)) {
      expect(countOccurrences(read(file), 'use:magnetic'), `use:magnetic count in ${file}`).toBe(
        expected
      );
    }
  });

  it('never touches the navbar or the footer', () => {
    for (const file of FORBIDDEN_FILES) {
      expect(countOccurrences(read(file), 'use:magnetic'), `${file} must stay magnetic-free`).toBe(
        0
      );
    }
  });

  it('no component outside the approved set wires the effect', () => {
    const wired = new Set(Object.keys(WIRED_FILES));
    for (const full of walkSvelte(join(WEBSITE_ROOT, 'src'))) {
      const rel = full.slice(WEBSITE_ROOT.length + 1);
      if (wired.has(rel)) continue;
      const src = readFileSync(full, 'utf8');
      expect(countOccurrences(src, 'use:magnetic'), `unexpected use:magnetic in ${rel}`).toBe(0);
    }
  });

  it('hero wiring stays conditional on the green detected-browser variant', () => {
    const overview = read('src/routes/overview/+page.svelte');
    expect(overview).toContain('use:magnetic={b === detectedBrowser}');

    const uninstall = read('src/routes/uninstall/+page.svelte');
    expect(uninstall).toContain('use:magnetic={isDetected}');
    expect(uninstall).toContain('use:magnetic={submitState !== \'sending\'}');
  });
});

describe('magnetic transform-ownership contract', () => {
  it('app.css keeps the magnetic-live rule that unsets transform transitions', () => {
    const css = read(APP_CSS);
    const ruleStart = css.indexOf('.magnetic-live {');
    expect(ruleStart).toBeGreaterThan(-1);
    const rule = css.slice(ruleStart, css.indexOf('}', ruleStart));
    expect(rule).toContain('transition-property');
    expect(rule).not.toContain('transform');
  });

  it('the action is the only place that toggles the marker class', () => {
    const action = read(ACTION_SRC);
    expect(action).toContain("classList.add('magnetic-live')");
    expect(action).toContain("classList.remove('magnetic-live')");
    for (const file of Object.keys(WIRED_FILES)) {
      expect(read(file).includes('magnetic-live'), `${file} must not toggle the class`).toBe(false);
    }
  });
});

describe('magnetic feel stays in sync with the approved prototype', () => {
  it('MAGNETIC_DEFAULTS matches the prototype CONFIG exactly', () => {
    const prod = read(MOTION_SRC);
    const proto = read(PROTOTYPE_HTML);

    const keys = ['radius', 'strength', 'stiffness', 'damping', 'maxShift'] as const;
    const defaults: Record<string, number> = {};
    const block = prod.slice(prod.indexOf('MAGNETIC_DEFAULTS'), prod.indexOf('};', prod.indexOf('MAGNETIC_DEFAULTS')));
    for (const key of keys) {
      defaults[key] = Number(block.match(new RegExp(`${key}:\\s*([0-9.]+)`))?.[1]);
      expect(Number.isFinite(defaults[key]), `${key} parsed from magneticField`).toBe(true);
    }

    const configMatch = proto.match(/const CONFIG = \{([^}]*)\}/);
    expect(configMatch).toBeTruthy();
    for (const key of keys) {
      const protoValue = Number(configMatch![1].match(new RegExp(`${key}:\\s*([0-9.]+)`))?.[1]);
      expect(protoValue).toBe(defaults[key]);
    }
  });
});
