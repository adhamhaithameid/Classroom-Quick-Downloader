// filepath: extension/tests/options-permissions.test.ts
/**
 * Legal round 2, surface 02 Treatment 2 — the owner-approved "standing
 * reference" (legal-round2.html, stage 02 T2): the Options page carries a
 * permanent Permissions section; each row expands on tap to the
 * plain-language reason plus the exact mechanism name in faint type
 * (chrome.downloads / chrome.storage.local / chrome.identity). No first-run
 * interruption anywhere. Decisions pinned here:
 *   - Rows are real <button> heads (keyboard operable) with
 *     aria-expanded/aria-controls; the collapsed body leaves the tab order.
 *   - The identity row follows the prototype's note: it appears only for
 *     users who see the beta (isApiConfigured() — identity permission +
 *     oauth2 client_id, the same gate the popup's API segment reads).
 *   - Copy is the prototype's verbatim: short sentences, plain words,
 *     mechanism named, no legalese.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OptionsApp } from '../entrypoints/options/OptionsApp';

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(EXTENSION_ROOT, rel), 'utf8');

type ChromeShape = {
  runtime?: unknown;
  identity?: unknown;
  storage?: unknown;
  tabs?: unknown;
};

function installChromeMock(opts: { apiConfigured?: boolean } = {}): void {
  const chrome: ChromeShape = {
    storage: {
      local: {
        get: vi.fn((k: unknown, cb?: (r: Record<string, unknown>) => void) => {
          const res: Record<string, unknown> = {};
          void k;
          cb?.(res);
          return Promise.resolve(res);
        }),
        set: vi.fn((_kv: Record<string, unknown>, cb?: () => void) => {
          cb?.();
          return Promise.resolve();
        }),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  };
  if (opts.apiConfigured) {
    chrome.runtime = { getManifest: () => ({ oauth2: { client_id: 'client-id' } }) };
    chrome.identity = { getAuthToken: () => {} };
  }
  (globalThis as unknown as { chrome: unknown }).chrome = chrome;
}

describe('options permissions explainer (legal round 2, surface 02 T2)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // setup.ts turns fake timers on globally; the store's promises settle on
    // real macrotasks, so the render wait needs real timers (popup tests'
    // convention).
    vi.useRealTimers();
    vi.restoreAllMocks();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    installChromeMock({ apiConfigured: true });
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    delete (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.restoreAllMocks();
  });

  async function renderOptions(): Promise<void> {
    flushSync(() => {
      root.render(createElement(OptionsApp));
    });
    await new Promise((r) => setTimeout(r, 0));
  }

  function heads(): HTMLButtonElement[] {
    return [...container.querySelectorAll<HTMLButtonElement>('.cqd-perm-head')];
  }

  it('carries a standing Permissions section with the three permission rows', async () => {
    await renderOptions();

    const section = container.querySelector('.cqd-options-perms');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('aria-label')).toBe('Permissions');

    const names = heads().map((h) => h.querySelector('b')?.textContent);
    expect(names).toEqual(['Downloads', 'Storage', 'Your Google account']);

    // The mechanism named in faint type under each row name.
    const mechanisms = heads().map((h) => h.querySelector('small')?.textContent);
    expect(mechanisms).toEqual(['chrome.downloads', 'chrome.storage.local', 'chrome.identity · beta only']);
  });

  it('each head is a real button with aria wiring; Downloads starts expanded (prototype state)', async () => {
    await renderOptions();

    const [downloads, storage, identity] = heads();
    for (const head of heads()) {
      expect(head.getAttribute('aria-expanded')).not.toBeNull();
      expect(head.getAttribute('aria-controls')).not.toBeNull();
    }
    expect(downloads.getAttribute('aria-expanded')).toBe('true');
    expect(storage.getAttribute('aria-expanded')).toBe('false');
    expect(identity.getAttribute('aria-expanded')).toBe('false');
  });

  it('tap expands a row to the plain-language reason plus the scope note', async () => {
    await renderOptions();

    const storageHead = heads()[1];
    flushSync(() => {
      storageHead.click();
    });
    expect(storageHead.getAttribute('aria-expanded')).toBe('true');

    const bodyId = storageHead.getAttribute('aria-controls')!;
    const body = document.getElementById(bodyId);
    expect(body?.textContent).toContain('Remembers your settings on this device. It never stores your files.');
    expect(body?.textContent).toContain('Settings only — engine choice, highlights, flags.');

    flushSync(() => {
      storageHead.click();
    });
    expect(storageHead.getAttribute('aria-expanded')).toBe('false');
  });

  it('the Downloads reason names the job and the core-feature scope note', async () => {
    await renderOptions();

    const body = document.getElementById(heads()[0].getAttribute('aria-controls')!);
    expect(body?.textContent).toContain(
      'Saves the attachments you choose into your Downloads folder, and shows progress as they arrive.',
    );
    expect(body?.textContent).toContain('Core feature — nothing downloads without this.');
  });

  it('the identity reason scopes sign-in to the beta and keeps the token local', async () => {
    await renderOptions();

    const identityHead = heads()[2];
    flushSync(() => {
      identityHead.click();
    });

    const body = document.getElementById(identityHead.getAttribute('aria-controls')!);
    expect(body?.textContent).toContain('Used only when you start the API beta.');
    expect(body?.textContent).toContain('The sign-in token stays in your browser and never reaches the developer.');
    expect(body?.textContent).toContain('This row appears only for users who see the beta.');
  });

  it('the identity row appears only for users who see the beta (isApiConfigured gate)', async () => {
    installChromeMock({ apiConfigured: false });
    await renderOptions();

    const names = heads().map((h) => h.querySelector('b')?.textContent);
    expect(names).toEqual(['Downloads', 'Storage']);
  });

  it('the treatment styles the mechanism name as the faint small step', () => {
    const css = read('entrypoints/options/options.css');
    const start = css.indexOf('.cqd-perm-name small {');
    expect(start).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toContain('var(--cqd-fs-legal)');
  });
});
