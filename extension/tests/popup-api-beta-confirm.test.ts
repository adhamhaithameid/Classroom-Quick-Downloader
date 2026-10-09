// filepath: extension/tests/popup-api-beta-confirm.test.ts
/**
 * Legal round 2, surface 03 Treatment 2 — the owner-approved confirm card
 * (legal-round2.html, stage 03 T2). The FIRST API (beta) pick opens a small
 * card that states the three facts as choices — Google's own OAuth screen
 * carries the grant, the sign-in is used only while a beta download runs,
 * and one click returns to New at any time — and the user confirms.
 * Decisions pinned here:
 *   - The card intercepts the selection seam (handleEngineModeSelect): the
 *     stored mode and the segment stay on the previous engine until the user
 *     confirms; declining (Stay on New) returns to the previous selection.
 *   - Confirming persists apiBetaConfirmed (flat settings key, default
 *     false) and proceeds with the v3 switch in the same action.
 *   - Later picks skip the card entirely — one active moment, then quiet.
 *   - The arrow-key path shares the seam, so keyboard selection is gated too.
 */
import { createElement } from 'react';
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../entrypoints/popup/App';

type LocalArea = {
  get: (keys: unknown, cb: (r: Record<string, unknown>) => void) => void;
  set: (kv: Record<string, unknown>, cb?: () => void) => void;
};

function installChromeMock(initial: Record<string, unknown> = {}): { store: Record<string, unknown> } {
  const store: Record<string, unknown> = { ...initial };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      getManifest: () => ({ version: '1.8.9', oauth2: { client_id: 'client-id' } }),
      lastError: null,
      openOptionsPage: vi.fn(),
    },
    identity: { getAuthToken: () => {} },
    tabs: {
      query: vi.fn((_q: unknown, cb: (tabs: Array<{ id: number; url: string }>) => void) => {
        cb([{ id: 1, url: 'https://classroom.google.com/' }]);
      }),
      sendMessage: vi.fn((_t: number, _msg: unknown, cb?: () => void) => {
        cb?.();
      }),
      create: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn((keys: unknown, cb?: (r: Record<string, unknown>) => void) => {
          const res: Record<string, unknown> = {};
          if (Array.isArray(keys)) for (const k of keys) res[k] = store[k];
          else res[keys as string] = store[keys as string];
          cb?.(res);
          return Promise.resolve(res);
        }) as unknown as LocalArea['get'],
        set: vi.fn((kv: Record<string, unknown>, cb?: () => void) => {
          Object.assign(store, kv);
          cb?.();
          return Promise.resolve();
        }),
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  };
  return { store };
}

describe('popup API beta confirm card (legal round 2, surface 03 T2)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // setup.ts turns fake timers on globally; the async chrome mock settles
    // on real macrotasks.
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  const tick = () => new Promise((r) => setTimeout(r, 0));

  /** Wait for the Classroom branch (the engine radiogroup) to render. */
  async function waitForEngineRow(): Promise<void> {
    for (let i = 0; i < 40; i += 1) {
      if (container.querySelector('[data-mode="v3"]')) return;
      await act(async () => {
        await tick();
      });
    }
    throw new Error('engine radiogroup never rendered');
  }

  async function renderPopup(initial: Record<string, unknown> = {}): Promise<{ store: Record<string, unknown> }> {
    const ctx = installChromeMock(initial);
    flushSync(() => {
      root.render(createElement(App));
    });
    // Let the async loads (settings, engine mode, version) settle and the
    // Classroom branch render (popup-legend-a11y's act+tick convention).
    await act(async () => {
      await tick();
    });
    await waitForEngineRow();
    return ctx;
  }

  function radio(mode: string): HTMLButtonElement {
    return container.querySelector<HTMLButtonElement>(`[data-mode="${mode}"]`)!;
  }

  function confirmCard(): HTMLElement | null {
    return container.querySelector('.cqd-api-confirm');
  }

  it('the first API pick opens the confirm card and keeps the previous engine selected', async () => {
    const { store } = await renderPopup();

    flushSync(() => {
      radio('v3').click();
    });

    const card = confirmCard();
    expect(card).not.toBeNull();
    expect(card?.getAttribute('aria-label')).toBe('Before you switch to the beta');
    // The three facts: Google's screen, scoped sign-in, the way back.
    const text = card?.textContent ?? '';
    expect(text).toContain("Google asks for permission on Google's own screen.");
    expect(text).toContain('Your sign-in is used only while you run a beta download — never in the background.');
    expect(text).toContain('One click returns you to New at any time.');

    // Nothing committed: New stays checked, no mode write, gate still closed
    // (the store's migration write back-fills apiBetaConfirmed FALSE — the
    // documented self-heal — so "not confirmed" is the assertion).
    expect(radio('v3').getAttribute('aria-checked')).toBe('false');
    expect(radio('v2').getAttribute('aria-checked')).toBe('true');
    expect(store['cqdV2Mode']).toBeUndefined();
    expect(Boolean(store['apiBetaConfirmed'])).toBe(false);
  });

  it('confirming persists apiBetaConfirmed and proceeds with the v3 switch', async () => {
    const { store } = await renderPopup();

    flushSync(() => {
      radio('v3').click();
    });
    const tryBtn = container.querySelector<HTMLButtonElement>('.cqd-api-confirm-try')!;
    flushSync(() => {
      tryBtn.click();
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(store['apiBetaConfirmed']).toBe(true);
    expect(store['cqdV2Mode']).toBe('v3');
    expect(radio('v3').getAttribute('aria-checked')).toBe('true');
    expect(confirmCard()).toBeNull();
  });

  it('declining (Stay on New) returns to the previous selection without any write', async () => {
    const { store } = await renderPopup();

    flushSync(() => {
      radio('v3').click();
    });
    const stayBtn = container.querySelector<HTMLButtonElement>('.cqd-api-confirm-stay')!;
    flushSync(() => {
      stayBtn.click();
    });

    expect(confirmCard()).toBeNull();
    expect(radio('v2').getAttribute('aria-checked')).toBe('true');
    expect(radio('v3').getAttribute('aria-checked')).toBe('false');
    expect(store['cqdV2Mode']).toBeUndefined();
    expect(Boolean(store['apiBetaConfirmed'])).toBe(false);
  });

  it('a confirmed install skips the card — later picks switch immediately', async () => {
    const { store } = await renderPopup({ apiBetaConfirmed: true, cqdV2Mode: 'v2' });

    flushSync(() => {
      radio('v3').click();
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(confirmCard()).toBeNull();
    expect(store['cqdV2Mode']).toBe('v3');
    expect(radio('v3').getAttribute('aria-checked')).toBe('true');
  });

  it('the arrow-key path shares the seam: keyboard v3 pick is gated too', async () => {
    const { store } = await renderPopup();

    const v2 = radio('v2');
    v2.focus();
    // Radiogroup keydown handler is on the group; dispatch from the segment.
    v2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await act(async () => {
      await tick();
    });

    expect(confirmCard()).not.toBeNull();
    expect(store['cqdV2Mode']).toBeUndefined();
    expect(radio('v2').getAttribute('aria-checked')).toBe('true');
  });

  it('picking another engine while the card is open closes the card and switches', async () => {
    const { store } = await renderPopup();

    flushSync(() => {
      radio('v3').click();
    });
    expect(confirmCard()).not.toBeNull();

    flushSync(() => {
      radio('legacy').click();
    });

    expect(confirmCard()).toBeNull();
    expect(store['cqdV2Mode']).toBe('legacy');
    expect(radio('legacy').getAttribute('aria-checked')).toBe('true');
  });
});
