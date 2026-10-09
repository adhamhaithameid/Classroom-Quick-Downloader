// filepath: extension/tests/content-reduce-motion.test.ts
/**
 * In-app Reduce Motion (Phase 4 batch D1, commit 3) — content-script side.
 *
 * The reducedMotionPreferred key stays FLAT in chrome.storage.local (store
 * compat rule) and the content side mirrors it onto <html> as the
 * .cqd-reduce-motion class (same pattern as the v2 cqd-flag-toggle live
 * apply). Scoping rule: the class only scopes CSS collapse to CQD's OWN
 * artifacts — never to the host page's motion.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REDUCE_MOTION_KEY, applyReduceMotionClass } from '../entrypoints/content/reduce-motion';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * installReduceMotion carries a module-level install guard (one listener per
 * page bundle), so each test needs a fresh module instance — resetModules in
 * beforeEach + a dynamic import here.
 */
async function loadModule() {
  return await import('../entrypoints/content/reduce-motion');
}

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(EXTENSION_ROOT, rel), 'utf8');

type ChangeListener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

function installStorageWithListeners(initial: Record<string, unknown>) {
  const store: Record<string, unknown> = { ...initial };
  const listeners: ChangeListener[] = [];
  (chrome.storage.local as unknown as { get: (k: string, cb: (r: unknown) => void) => void }).get =
    vi.fn((key: string, cb: (r: unknown) => void) => {
      cb({ [key]: store[key] });
    });
  (chrome.storage.onChanged as unknown as { addListener: (l: ChangeListener) => void }) = {
    addListener: vi.fn((l: ChangeListener) => listeners.push(l)),
  };
  return { store, listeners };
}

describe('content reduce-motion mirror (in-app setting)', () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.className = '';
    vi.restoreAllMocks();
  });

  it('uses the flat reducedMotionPreferred key (store compat rule)', () => {
    expect(REDUCE_MOTION_KEY).toBe('reducedMotionPreferred');
  });

  it('applyReduceMotionClass toggles .cqd-reduce-motion on <html>', () => {
    applyReduceMotionClass(true);
    expect(document.documentElement.classList.contains('cqd-reduce-motion')).toBe(true);
    applyReduceMotionClass(false);
    expect(document.documentElement.classList.contains('cqd-reduce-motion')).toBe(false);
  });

  it('installReduceMotion reads storage once and applies the saved value', async () => {
    const { installReduceMotion } = await loadModule();
    installStorageWithListeners({ [REDUCE_MOTION_KEY]: true });
    installReduceMotion();
    expect(document.documentElement.classList.contains('cqd-reduce-motion')).toBe(true);
  });

  it('installReduceMotion treats missing values as OFF (default false)', async () => {
    const { installReduceMotion } = await loadModule();
    installStorageWithListeners({});
    installReduceMotion();
    expect(document.documentElement.classList.contains('cqd-reduce-motion')).toBe(false);
  });

  it('storage changes apply live (popup toggle reaches the page without a reload)', async () => {
    const { installReduceMotion } = await loadModule();
    const { listeners } = installStorageWithListeners({});
    installReduceMotion();

    expect(listeners).toHaveLength(1);
    listeners[0]({ [REDUCE_MOTION_KEY]: { newValue: true } }, 'local');
    expect(document.documentElement.classList.contains('cqd-reduce-motion')).toBe(true);

    listeners[0]({ [REDUCE_MOTION_KEY]: { newValue: false } }, 'local');
    expect(document.documentElement.classList.contains('cqd-reduce-motion')).toBe(false);

    // Other areas and other keys are ignored.
    listeners[0]({ extensionEnabled: { newValue: false } }, 'local');
    listeners[0]({ [REDUCE_MOTION_KEY]: { newValue: true } }, 'sync');
    expect(document.documentElement.classList.contains('cqd-reduce-motion')).toBe(false);
  });

  it('is safe without chrome and installs once per page', async () => {
    const { installReduceMotion } = await loadModule();
    const chromeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
    // @ts-expect-error - test-only global delete
    delete globalThis.chrome;
    expect(() => installReduceMotion()).not.toThrow();
    expect(document.documentElement.classList.contains('cqd-reduce-motion')).toBe(false);
    if (chromeDescriptor) Object.defineProperty(globalThis, 'chrome', chromeDescriptor);
  });

  it('repeated installs share one storage listener (idempotent per page)', async () => {
    const { installReduceMotion } = await loadModule();
    const { listeners } = installStorageWithListeners({});
    installReduceMotion();
    installReduceMotion();
    installReduceMotion();
    expect(listeners).toHaveLength(1);
  });
});

describe('reduce-motion CSS is shipped on every injected surface', () => {
  // The four sheets a Classroom page can carry, by injected style-element id.
  const SHEET_IDS = ['cqd-style', 'cqd-sw-style', 'cqd-v2-button-styles', 'cqd-v2-flag-styles'];

  /** Render all four real sheets into jsdom (fresh modules, no mocks). */
  async function injectAllSheets(): Promise<void> {
    vi.resetModules();
    const styles = await import('../entrypoints/content/styles');
    styles.injectStyles();
    styles.injectStudentWorkStyles();
    const buttonStyles = await import('../src/v2/render/button-styles');
    buttonStyles.injectV2Styles();
    const flagStyles = await import('../src/v2/render/flag-styles');
    flagStyles.injectFlagStyles();
  }

  function sheetCss(id: string): string {
    return document.getElementById(id)?.textContent ?? '';
  }

  it('each sheet gates animations behind the OS media query AND the in-app class', async () => {
    await injectAllSheets();
    for (const id of SHEET_IDS) {
      const css = sheetCss(id);
      expect(css, id).toContain('@media (prefers-reduced-motion: reduce)');
      expect(css, id).toContain('html.cqd-reduce-motion');
    }
  });

  it('the collapse is scoped to CQD artifacts, never the host page', async () => {
    await injectAllSheets();
    for (const id of SHEET_IDS) {
      const css = sheetCss(id);
      // The in-app rule must always carry a CQD class after the root hook.
      for (const match of css.matchAll(/html\.cqd-reduce-motion\s+([^,{]+)[,{]/g)) {
        expect(match[1], `${id}: ${match[1]}`).toContain('.cqd-');
      }
    }
  });

  it('App.css collapses animation under the root class and the OS query', () => {
    const css = read('entrypoints/popup/App.css');
    expect(css).toContain('.cqd-reduce-motion');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
