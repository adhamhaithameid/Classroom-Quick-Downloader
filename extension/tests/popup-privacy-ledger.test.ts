// filepath: extension/tests/popup-privacy-ledger.test.ts
/**
 * Legal round 2, surface 01 Treatment 2 + surface 05 Treatment 1 — the
 * owner-approved treatments:
 *   - Popup: the "Privacy & data" pill expands the Reads / Keeps / Sends
 *     ledger card in place (legal-round2.html, stage 01 T2). One tap, three
 *     directions; "Got it" closes and hands focus back to the pill.
 *   - Options: the Limited Use two-line block — the plain-language line
 *     first, the verbatim Chrome Web Store sentence second, fixed order
 *     (legal-round2.html, stage 05 T1).
 * Copy rules pinned here: short sentences, plain words, and the Sends row is
 * TRUTHFUL — the extension sends anonymous usage counts (download outcomes)
 * to the operator's worker (entrypoints/utils/analytics), so "nothing is
 * sent" would be a lie. Hardcoded English matches the popup/options
 * convention (the i18n sweep bead will adopt these strings).
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

const LIMITED_USE_SENTENCE =
  'The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.';

type LocalArea = {
  get: (keys: unknown, cb: (r: Record<string, unknown>) => void) => void;
  set: (kv: Record<string, unknown>, cb?: () => void) => void;
};

function installChromeMock(): void {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      getManifest: () => ({ version: '1.8.9' }),
      lastError: null,
    },
    tabs: {
      query: vi.fn((_q: unknown, cb: (tabs: Array<{ id: number; url: string }>) => void) => {
        cb([{ id: 1, url: 'https://classroom.google.com/' }]);
      }),
      create: vi.fn(),
    },
    storage: {
      local: {
        // Callback form (settings store) AND promise form (changelog
        // isVersionSeen) both hit this mock — support both shapes.
        get: vi.fn((k: unknown, cb?: (r: Record<string, unknown>) => void) => {
          const res: Record<string, unknown> = {};
          void k;
          cb?.(res);
          return Promise.resolve(res);
        }) as unknown as LocalArea['get'],
        set: vi.fn((_kv: Record<string, unknown>, cb?: () => void) => {
          cb?.();
          return Promise.resolve();
        }),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  };
}

describe('popup privacy ledger (legal round 2, surface 01 T2)', () => {
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

  function renderPopup(): void {
    installChromeMock();
    flushSync(() => {
      root.render(createElement(App));
    });
  }

  it('footer carries the collapsed "Privacy & data" pill next to the approved notice', async () => {
    renderPopup();
    await new Promise((r) => setTimeout(r, 0));

    // The approved affiliation notice is untouched (dccfc737).
    expect(container.querySelector('.cqd-footer-affil')).not.toBeNull();

    const pill = container.querySelector<HTMLButtonElement>('.cqd-priv-pill');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toContain('Privacy & data');
    expect(pill?.getAttribute('aria-expanded')).toBe('false');
    expect(pill?.getAttribute('aria-controls')).toBe('cqd-priv-ledger');

    // Collapsed: the ledger panel exists but is hidden and untabbable.
    const wrap = container.querySelector('.cqd-priv-ledger-wrap');
    expect(wrap).not.toBeNull();
    expect(wrap?.classList.contains('open')).toBe(false);
  });

  it('one tap expands the ledger with the three data directions', async () => {
    renderPopup();
    await new Promise((r) => setTimeout(r, 0));

    const pill = container.querySelector<HTMLButtonElement>('.cqd-priv-pill')!;
    flushSync(() => {
      pill.click();
    });

    expect(pill.getAttribute('aria-expanded')).toBe('true');
    const wrap = container.querySelector('.cqd-priv-ledger-wrap');
    expect(wrap?.classList.contains('open')).toBe(true);

    const ledger = container.querySelector('[aria-label="Privacy and data summary"]');
    expect(ledger).not.toBeNull();
    const text = ledger?.textContent ?? '';
    expect(ledger?.querySelector('h4')?.textContent).toBe('Where your files and data go');

    // Reads — concrete nouns only.
    expect(text).toContain('Reads');
    expect(text).toContain('The Classroom pages you open, to find posts and attachments.');
    // Keeps — settings and history stay on device.
    expect(text).toContain('Keeps on this device');
    expect(text).toContain('Your settings and your download history. They stay on this device.');
  });

  it('the Sends row is truthful about anonymous usage stats (never "nothing is sent")', async () => {
    renderPopup();
    await new Promise((r) => setTimeout(r, 0));

    flushSync(() => {
      (container.querySelector<HTMLButtonElement>('.cqd-priv-pill')! as HTMLButtonElement).click();
    });

    const text = container.querySelector('[aria-label="Privacy and data summary"]')?.textContent ?? '';
    expect(text).toContain('Sends');
    // The analytics payload (entrypoints/utils/analytics/types.ts) carries
    // outcomes, file types, browser, OS, extension version, language,
    // duration buckets, bypass flag, error types, and timestamps; the
    // uninstall URL adds source/browser/version + totals. The row enumerates
    // honestly — a reader must not conclude the list is narrower than it is.
    expect(text).toContain('Anonymous usage stats');
    expect(text).toContain('outcomes, file types, browser, system, app version, language, timing, and errors');
    expect(text).toContain('Never file names or file contents.');
    expect(text).toContain('Files travel from Google to you, directly.');
    expect(text.toLowerCase()).not.toContain('nothing to the developer');
  });

  it('"Got it" closes the ledger and returns focus to the pill (keyboard round trip)', async () => {
    renderPopup();
    await new Promise((r) => setTimeout(r, 0));

    const pill = container.querySelector<HTMLButtonElement>('.cqd-priv-pill')!;
    flushSync(() => {
      pill.click();
    });
    expect(pill.getAttribute('aria-expanded')).toBe('true');

    const close = container.querySelector<HTMLButtonElement>('.cqd-priv-ledger-close')!;
    close.focus();
    flushSync(() => {
      close.click();
    });

    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(pill);
  });

  it('the treatment keeps the ledger type small (micro/caption steps, no body-size walls)', () => {
    const css = read('entrypoints/popup/App.css');
    const start = css.indexOf('.cqd-priv-ledger {');
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toContain('var(--cqd-border-subtle)');
    const heading = css.indexOf('.cqd-priv-ledger h4 {');
    expect(heading).toBeGreaterThan(-1);
  });
});

describe('options Limited Use block (legal round 2, surface 05 T1)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn((_k: unknown, cb: (r: Record<string, unknown>) => void) => {
            cb({});
          }),
          set: vi.fn((_kv: Record<string, unknown>, cb?: () => void) => {
            cb?.();
          }),
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    };
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    delete (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.restoreAllMocks();
  });

  it('renders the plain line first and the verbatim Limited Use sentence second', async () => {
    flushSync(() => {
      root.render(createElement(OptionsApp));
    });
    await new Promise((r) => setTimeout(r, 0));

    const block = container.querySelector('.cqd-options-lu');
    expect(block).not.toBeNull();
    expect(block?.querySelector('h4')?.textContent).toBe('API (beta) — data use');

    const paragraphs = [...(block?.querySelectorAll('p') ?? [])];
    expect(paragraphs.length).toBe(2);
    // Plain language a student understands, then the legal sentence verbatim.
    expect(paragraphs[0].classList.contains('cqd-options-lu-line')).toBe(false);
    expect(paragraphs[0].textContent).toBe(
      'The beta only lists and downloads files from classrooms you are enrolled in.',
    );
    expect(paragraphs[1].classList.contains('cqd-options-lu-line')).toBe(true);
    expect(paragraphs[1].textContent).toBe(LIMITED_USE_SENTENCE);
  });

  it('the verbatim sentence is visually the dimmer footnote step', () => {
    const css = read('entrypoints/options/options.css');
    const start = css.indexOf('.cqd-options-lu-line {');
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toContain('var(--cqd-fs-legal)');
  });
});
