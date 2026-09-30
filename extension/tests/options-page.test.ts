// filepath: extension/tests/options-page.test.ts
/**
 * 0h4d.1.8 task 3 — the options page. All settings present, toggles flip
 * storage through the shared store (flat keys), live re-render on external
 * changes, and the page opens via chrome.runtime.openOptionsPage from the
 * popup link.
 */
import { createElement } from 'react';
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OptionsApp } from '../entrypoints/options/OptionsApp';

type LocalArea = {
  get: (keys: unknown, cb: (r: unknown) => void) => void;
  set: (kv: unknown, cb?: () => void) => void;
};

describe('options page (0h4d.1.8)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, unknown>;
  let changeListeners: Array<(c: Record<string, { newValue?: unknown }>, area: string) => void>;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    store = {};
    changeListeners = [];
    const getSpy = vi.fn((keys: unknown, cb: (r: unknown) => void) => {
      const res: Record<string, unknown> = {};
      if (Array.isArray(keys)) for (const k of keys) res[k] = store[k];
      cb(res);
    });
    const setSpy = vi.fn((kv: Record<string, unknown>, cb?: () => void) => {
      Object.assign(store, kv);
      for (const l of changeListeners) {
        const changes: Record<string, { newValue?: unknown }> = {};
        for (const k of Object.keys(kv)) changes[k] = { newValue: kv[k] };
        l(changes, 'local');
      }
      cb?.();
    });
    (chrome.storage.local as unknown as LocalArea).get = getSpy as unknown as LocalArea['get'];
    (chrome.storage.local as unknown as LocalArea).set = setSpy as unknown as LocalArea['set'];
    (chrome.storage.onChanged as any) = {
      addListener: vi.fn((l: typeof changeListeners[number]) => changeListeners.push(l)),
      removeListener: vi.fn((l: typeof changeListeners[number]) => {
        const i = changeListeners.indexOf(l);
        if (i >= 0) changeListeners.splice(i, 1);
      }),
    };
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  function render() {
    flushSync(() => {
      root.render(createElement(OptionsApp));
    });
  }

  /** Fake timers are global (setup.ts) — pump them so async effects settle. */
  async function settle(): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
  }

  it('renders every settings row with a toggle', async () => {
    render();
    await settle();
    const rows = [...container.querySelectorAll('.cqd-options-row')];
    expect(rows).toHaveLength(5);
    const labels = [...container.querySelectorAll('.cqd-options-label')].map((l) => l.textContent);
    expect(labels).toContain('Enable Extension');
    expect(labels).toContain('Comment flags');
    const switches = [...container.querySelectorAll('[role="switch"]')];
    expect(switches).toHaveLength(5);
    expect(switches.every((s) => s.getAttribute('aria-checked') === 'true')).toBe(true);
  });

  it('clicking a toggle flips storage and re-renders (live apply)', async () => {
    render();
    await settle();
    const extensionToggle = container.querySelector(
      '[aria-label="Enable Extension"]',
    ) as HTMLButtonElement;
    await act(async () => {
      extensionToggle.click();
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(store.extensionEnabled).toBe(false);
    const toggles = [...container.querySelectorAll('[role="switch"]')];
    const target = container.querySelector('[aria-label="Enable Extension"]');
    expect(target?.getAttribute('aria-checked')).toBe('false');
    expect(toggles.every((s) => s.getAttribute('aria-checked') === 'true')).toBe(false);
  });

  it('re-renders when storage changes externally (popup ↔ options sync)', async () => {
    render();
    await settle();
    // Simulate the popup flipping a flag.
    await act(async () => {
      store.commentsFlagEnabled = false;
      for (const l of changeListeners) {
        l({ commentsFlagEnabled: { newValue: false } }, 'local');
      }
      await vi.advanceTimersByTimeAsync(50);
    });
    const chip = container.querySelector('[aria-label="Comment flags"]');
    expect(chip?.getAttribute('aria-checked')).toBe('false');
  });
});
