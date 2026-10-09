// filepath: extension/tests/popup-affil-notice.test.ts
/**
 * Phase 4 batch D4 commit 3 — the approved "Not affiliated with Google"
 * notice (legal.html surface 03, carried through legal-round2.html's
 * popup-footer composite) ships in the popup footer and the options page
 * footer. Guards: exact approved copy with the bolded lead sentence, the
 * 10px legal-only type step for the treatment, and presence on both
 * surfaces. Hardcoded English matches the popup's current convention (no
 * locale additions); the i18n sweep bead will pick it up.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../entrypoints/popup/App';
import { OptionsApp } from '../entrypoints/options/OptionsApp';

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(EXTENSION_ROOT, rel), 'utf8');

const NOTICE_TEXT = "Not affiliated with Google. Downloads belong to their owners — follow your school's policies.";

type LocalArea = {
  get: (keys: unknown, cb: (r: Record<string, unknown>) => void) => void;
  set: (kv: Record<string, unknown>, cb?: () => void) => void;
};

function installChromeMock(tabUrl: string): void {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      getManifest: () => ({ version: '1.3.0' }),
      lastError: null,
    },
    tabs: {
      query: vi.fn((_q: unknown, cb: (tabs: Array<{ id: number; url: string }>) => void) => {
        cb([{ id: 1, url: tabUrl }]);
      }),
      create: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn((_k: unknown, cb: (r: Record<string, unknown>) => void) => {
          cb({ extensionEnabled: true, cqd_changelog_seen_v1: [] });
        }) as unknown as LocalArea['get'],
        set: vi.fn(),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  };
}

describe('affiliation notice (approved legal surface)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    localStorage.clear();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    delete (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.restoreAllMocks();
  });

  it('popup footer carries the notice with the bolded lead sentence', async () => {
    installChromeMock('https://classroom.google.com/');
    flushSync(() => {
      root.render(createElement(App));
    });
    await new Promise((r) => setTimeout(r, 0));

    const notice = container.querySelector('.cqd-footer-affil');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toBe(NOTICE_TEXT);
    const lead = notice?.querySelector('strong');
    expect(lead?.textContent).toBe('Not affiliated with Google.');
  });

  it('options footer repeats the notice verbatim (consistency surface)', async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn((_k: unknown, cb: (r: Record<string, unknown>) => void) => {
            cb({});
          }),
          set: vi.fn(),
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    };
    flushSync(() => {
      root.render(createElement(OptionsApp));
    });
    await new Promise((r) => setTimeout(r, 0));

    const notice = container.querySelector('.cqd-options-affil');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toBe(NOTICE_TEXT);
  });

  it('the treatment uses the 10px legal-only step of the type scale', () => {
    const css = read('entrypoints/popup/App.css');
    const start = css.indexOf('.cqd-footer-affil {');
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toContain('font-size: var(--cqd-fs-legal)');
  });
});
