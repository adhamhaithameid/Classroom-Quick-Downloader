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

async function waitForLegendItem(container: HTMLElement): Promise<HTMLLIElement | null> {
  for (let i = 0; i < 20; i += 1) {
    const item = container.querySelector('.cqd-legend-item') as HTMLLIElement | null;
    if (item) return item;
    await act(async () => {
      await tick();
    });
  }
  return null;
}

describe('popup legend keyboard accessibility', () => {
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
      local_stats: {
        total: 3,
        byType: {
          pdf: 2,
          doc: 1,
        },
      },
      extensionEnabled: true,
      cqd_changelog_seen_v1: [],
    });

    (globalThis as any).chrome = chromeMock;
    (globalThis as any).open = vi.fn();
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

  it('allows legend items to be focused and controlled via keyboard', async () => {
    await act(async () => {
      flushSync(() => {
        root.render(createElement(App));
      });
      await tick();
      await tick();
    });

    const legendItem = await waitForLegendItem(container);
    expect(legendItem).not.toBeNull();
    expect(legendItem?.getAttribute('tabindex')).toBe('0');
    expect(legendItem?.getAttribute('role')).toBe('button');

    const versionButton = container.querySelector('.cqd-brand-version') as HTMLButtonElement | null;
    expect(versionButton).not.toBeNull();

    await act(async () => {
      versionButton?.click();
      await tick();
    });

    const releaseNotesLink = container.querySelector('.cqd-cl-footer-link-secondary') as HTMLAnchorElement | null;
    expect(releaseNotesLink).not.toBeNull();
    const releaseHref = releaseNotesLink?.getAttribute('href') ?? '';
    expect(releaseHref.length).toBeGreaterThan(0);
    expect(/\/changelog|CHANGELOG\.md/.test(releaseHref)).toBe(true);

    await act(async () => {
      legendItem?.focus();
      await tick();
    });
    expect(container.querySelector('.cqd-legend-item.hovered')).not.toBeNull();

    await act(async () => {
      legendItem?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await tick();
    });
    expect(container.querySelector('.cqd-legend-item.hovered')).not.toBeNull();

    await act(async () => {
      legendItem?.blur();
      await tick();
    });
    expect(container.querySelector('.cqd-legend-item.hovered')).toBeNull();
  });
});
