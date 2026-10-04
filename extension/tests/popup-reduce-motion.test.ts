// filepath: extension/tests/popup-reduce-motion.test.ts
/**
 * In-app Reduce Motion (Phase 4 batch D1, commit 3) — popup surface.
 *
 * The reducedMotionPreferred toggle (store: flat key, default false) must
 * put the .cqd-reduce-motion root class on the popup root <main> when ON
 * and drop it when OFF. The row renders in the General settings section
 * (Stillwater: settings are labeled rows); the OS prefers-reduced-motion
 * media query stays independent in CSS.
 */
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../entrypoints/popup/App';

type LocalArea = {
  get: (keys: unknown, cb: (r: unknown) => void) => void;
  set: (kv: unknown, cb?: () => void) => void;
};

describe('popup reduce-motion root class', () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, unknown>;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    store = {};
    const getSpy = vi.fn((keys: unknown, cb?: (r: unknown) => void) => {
      const res: Record<string, unknown> = {};
      if (Array.isArray(keys)) for (const k of keys) res[k] = store[k];
      else res[keys as string] = store[keys as string];
      // Some callers (utils/changelog.ts) await promise-style get() — no cb.
      if (typeof cb === 'function') {
        cb(res);
        return;
      }
      return Promise.resolve(res);
    });
    const setSpy = vi.fn((kv: Record<string, unknown>, cb?: () => void) => {
      Object.assign(store, kv);
      cb?.();
    });
    (chrome.storage.local as unknown as LocalArea).get = getSpy as unknown as LocalArea['get'];
    (chrome.storage.local as unknown as LocalArea).set = setSpy as unknown as LocalArea['set'];
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  /** Fake timers are global (setup.ts) — settle the async settings load. */
  async function renderApp(): Promise<void> {
    await act(async () => {
      root.render(createElement(App));
      await vi.advanceTimersByTimeAsync(50);
    });
  }

  function appRoot(): HTMLElement {
    return container.querySelector('main.cqd-app') as HTMLElement;
  }

  function reduceMotionSwitch(): HTMLInputElement {
    return container.querySelector(
      'input[type="checkbox"][role="switch"][aria-label="Reduce motion"]',
    ) as HTMLInputElement;
  }

  it('renders the Reduce motion row, OFF by default, without the root class', async () => {
    await renderApp();

    expect(reduceMotionSwitch()).not.toBeNull();
    expect(reduceMotionSwitch().getAttribute('aria-checked')).toBe('false');
    expect(appRoot().classList.contains('cqd-reduce-motion')).toBe(false);
  });

  it('toggling the setting ON adds .cqd-reduce-motion to the popup root', async () => {
    await renderApp();

    await act(async () => {
      reduceMotionSwitch().click();
    });

    expect(reduceMotionSwitch().getAttribute('aria-checked')).toBe('true');
    expect(appRoot().classList.contains('cqd-reduce-motion')).toBe(true);
    // Persisted through the shared store's flat key.
    expect(store.reducedMotionPreferred).toBe(true);
  });

  it('toggling OFF removes the root class again', async () => {
    store.reducedMotionPreferred = true;
    await renderApp();

    expect(appRoot().classList.contains('cqd-reduce-motion')).toBe(true);
    await act(async () => {
      reduceMotionSwitch().click();
    });
    expect(appRoot().classList.contains('cqd-reduce-motion')).toBe(false);
    expect(store.reducedMotionPreferred).toBe(false);
  });
});
