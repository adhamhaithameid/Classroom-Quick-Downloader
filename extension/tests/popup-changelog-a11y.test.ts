import { act, createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../entrypoints/popup/App';

type LocalStorageData = Record<string, unknown>;

function readLocalValue(state: LocalStorageData, key: unknown): Record<string, unknown> {
  if (typeof key === 'string') {
    return { [key]: state[key] };
  }
  if (Array.isArray(key)) {
    return key.reduce<Record<string, unknown>>((acc, current) => {
      acc[current] = state[current];
      return acc;
    }, {});
  }
  return {};
}

function createChromeMock(initialState: LocalStorageData) {
  const state: LocalStorageData = { ...initialState };
  const listeners = new Set<(changes: unknown, area: string) => void>();

  const local = {
    get: vi.fn((key: unknown, callback?: (result: Record<string, unknown>) => void) => {
      const result = readLocalValue(state, key);
      if (typeof callback === 'function') {
        callback(result);
        return;
      }
      return Promise.resolve(result);
    }),
    set: vi.fn((next: Record<string, unknown>, callback?: () => void) => {
      Object.assign(state, next);
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    }),
  };

  return {
    runtime: {
      getManifest: () => ({ version: '1.3.0' }),
      lastError: null,
    },
    tabs: {
      query: vi.fn((_query: unknown, callback: (tabs: Array<{ id: number; url: string }>) => void) => {
        callback([{ id: 1, url: 'https://classroom.google.com/' }]);
      }),
      create: vi.fn(),
    },
    storage: {
      local,
      onChanged: {
        addListener: vi.fn((listener: (changes: unknown, area: string) => void) => {
          listeners.add(listener);
        }),
        removeListener: vi.fn((listener: (changes: unknown, area: string) => void) => {
          listeners.delete(listener);
        }),
      },
    },
  };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function waitForElement(container: HTMLElement, selector: string): Promise<HTMLElement | null> {
  for (let i = 0; i < 20; i += 1) {
    const item = container.querySelector(selector) as HTMLElement | null;
    if (item) return item;
    await act(async () => {
      await tick();
    });
  }
  return null;
}

describe('popup changelog accessibility', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useRealTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    localStorage.clear();
    const chromeMock = createChromeMock({
      extensionEnabled: true,
      cqd_changelog_seen_v1: [],
    });

    (globalThis as any).chrome = chromeMock;
    (globalThis as any).open = vi.fn();

    // Mock fetch for changelog to avoid network errors
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        entries: [],
        config: {},
        ok: true
      })
    })) as any;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
    delete (globalThis as any).chrome;
    delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
    vi.restoreAllMocks();
  });

  it('manages focus and ARIA attributes correctly for changelog modal', async () => {
    await act(async () => {
      flushSync(() => {
        root.render(createElement(App));
      });
      await tick();
      await tick();
    });

    // 1. Find and Click Version Button
    const versionBtn = await waitForElement(container, '.cqd-brand-version');
    expect(versionBtn).not.toBeNull();

    // Check initial focus
    await act(async () => {
      versionBtn?.focus();
      versionBtn?.click();
      await tick();
    });

    // 2. Verify Modal is Open and has ARIA attributes
    const modal = await waitForElement(container, '.cqd-changelog-overlay.open');
    expect(modal).not.toBeNull();
    expect(modal?.getAttribute('role')).toBe('dialog');
    expect(modal?.getAttribute('aria-modal')).toBe('true');
    expect(modal?.getAttribute('aria-labelledby')).toBe('changelog-title');

    // 3. Verify Focus moved to Close Button
    const closeBtn = container.querySelector('.cqd-cl-close') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.getAttribute('aria-label')).toBe('Close changelog');
    expect(document.activeElement).toBe(closeBtn);

    // 4. Verify Title ID
    const title = container.querySelector('.cqd-cl-title');
    expect(title?.getAttribute('id')).toBe('changelog-title');

    // 5. Close Modal via Escape Key
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await tick();
    });

    // 6. Verify Modal Closed
    expect(container.querySelector('.cqd-changelog-overlay.open')).toBeNull();

    // 7. Verify Focus Restored to Version Button
    expect(document.activeElement).toBe(versionBtn);
  });
});
