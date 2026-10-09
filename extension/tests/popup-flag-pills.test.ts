// filepath: extension/tests/popup-flag-pills.test.ts
/**
 * Phase 4 batch D2 (Stillwater) — the popup's flag-selection PILLS
 * (prototypes/popup-direction-a.html + components.html "A pills", owner
 * ballot: "both-flag card (A pills)").
 *
 * State mapping pinned here (the three pills ARE the three flat store keys;
 * the prototype lets every combination stand, so no pill forces another):
 *   Comment pill -> commentsFlagEnabled
 *   Edited pill  -> editedFlagEnabled
 *   Both pill    -> combinedFlagEnabled
 * Content-side rendering already handles all three flags — the pills only
 * re-present the toggles (saveSetting + cqd-flag-toggle via handleToggleFlag).
 *
 * Each pill carries the prototype's mini before/after preview (ring + badge
 * cycle). The preview must freeze on its AFTER state under both the in-app
 * .cqd-reduce-motion class and the OS media query — guard via the shipped
 * CSS (same convention as content-reduce-motion.test.ts).
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlagPills } from '../entrypoints/popup/App';

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const popupCss = (): string =>
  readFileSync(join(EXTENSION_ROOT, 'entrypoints/popup/App.css'), 'utf8');

describe('popup flag preview pills (A pills, both card)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  type Props = {
    comments?: boolean;
    edited?: boolean;
    combined?: boolean;
    disabled?: boolean;
    onToggle?: (key: 'commentsFlagEnabled' | 'editedFlagEnabled' | 'combinedFlagEnabled') => void;
  };

  function renderPills(props: Props = {}) {
    const onToggle =
      props.onToggle ??
      vi.fn((_key: 'commentsFlagEnabled' | 'editedFlagEnabled' | 'combinedFlagEnabled') => {});
    flushSync(() => {
      root.render(
        createElement(FlagPills, {
          comments: props.comments ?? true,
          edited: props.edited ?? false,
          combined: props.combined ?? false,
          disabled: props.disabled ?? false,
          onToggle,
        }),
      );
    });
    return { onToggle };
  }

  function pills(): HTMLButtonElement[] {
    return [...container.querySelectorAll<HTMLButtonElement>('.cqd-flag-pill')];
  }

  it('renders three pills in a labeled group: Comment / Edited / Both', () => {
    renderPills();

    const group = container.querySelector('[role="group"]') as HTMLElement | null;
    expect(group?.classList.contains('cqd-flag-pills')).toBe(true);
    expect(group?.getAttribute('aria-label')).toBe('Highlight changes');
    expect(pills().map((p) => p.dataset.flag)).toEqual([
      'commentsFlagEnabled',
      'editedFlagEnabled',
      'combinedFlagEnabled',
    ]);
    expect(pills().map((p) => p.textContent)).toEqual(['Comment', 'Edited', 'Both']);
  });

  it('aria-pressed mirrors each flat store key truthfully', () => {
    renderPills({ comments: true, edited: false, combined: true });

    expect(
      container.querySelector<HTMLButtonElement>('[data-flag="commentsFlagEnabled"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      container.querySelector<HTMLButtonElement>('[data-flag="editedFlagEnabled"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      container.querySelector<HTMLButtonElement>('[data-flag="combinedFlagEnabled"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('clicking a pill requests the toggle of its exact key (no cross-key writes)', () => {
    const { onToggle } = renderPills();

    container.querySelector<HTMLButtonElement>('[data-flag="commentsFlagEnabled"]')!.click();
    container.querySelector<HTMLButtonElement>('[data-flag="editedFlagEnabled"]')!.click();
    container.querySelector<HTMLButtonElement>('[data-flag="combinedFlagEnabled"]')!.click();

    expect(onToggle).toHaveBeenCalledTimes(3);
    expect(onToggle).toHaveBeenNthCalledWith(1, 'commentsFlagEnabled');
    expect(onToggle).toHaveBeenNthCalledWith(2, 'editedFlagEnabled');
    expect(onToggle).toHaveBeenNthCalledWith(3, 'combinedFlagEnabled');
  });

  it('the pills stay independent: Both does not clear Comment or Edited', () => {
    // The prototype's pills are independent toggles (popup-direction-a.html
    // toggles each aria-pressed freely) — this test pins that behavior.
    const state: Record<'commentsFlagEnabled' | 'editedFlagEnabled' | 'combinedFlagEnabled', boolean> = {
      commentsFlagEnabled: true,
      editedFlagEnabled: true,
      combinedFlagEnabled: false,
    };
    const onToggle = vi.fn((key: 'commentsFlagEnabled' | 'editedFlagEnabled' | 'combinedFlagEnabled') => {
      state[key] = !state[key];
    });
    renderPills({
      comments: state.commentsFlagEnabled,
      edited: state.editedFlagEnabled,
      combined: state.combinedFlagEnabled,
      onToggle,
    });

    container.querySelector<HTMLButtonElement>('[data-flag="combinedFlagEnabled"]')!.click();
    expect(state).toEqual({
      commentsFlagEnabled: true,
      editedFlagEnabled: true,
      combinedFlagEnabled: true,
    });
  });

  it('each pill carries the mini before/after preview (ring + badge, hidden from AT)', () => {
    renderPills();

    for (const pill of pills()) {
      const stage = pill.querySelector('.cqd-flag-pill-stage') as HTMLElement | null;
      expect(stage, pill.dataset.flag).not.toBeNull();
      expect(stage?.getAttribute('aria-hidden')).toBe('true');
      expect(stage?.querySelector('.cqd-flag-pill-post')).not.toBeNull();
      expect(stage?.querySelector('.cqd-flag-pill-ring')).not.toBeNull();
      expect(stage?.querySelector('.cqd-flag-pill-badge')).not.toBeNull();
    }
  });

  it('is disabled while settings load', () => {
    renderPills({ disabled: true });
    expect(pills().every((p) => p.disabled)).toBe(true);
  });

  it('the popup Flags section renders the pills wired to the shared store', async () => {
    const { act } = await import('react');
    const App = (await import('../entrypoints/popup/App')).default;
    const store: Record<string, unknown> = {};
    const getSpy = vi.fn((keys: unknown, cb?: (r: unknown) => void) => {
      const res: Record<string, unknown> = {};
      if (Array.isArray(keys)) for (const k of keys) res[k] = store[k];
      else res[keys as string] = store[keys as string];
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
    (chrome.storage.local as unknown as { get: unknown; set: unknown }).get = getSpy;
    (chrome.storage.local as unknown as { get: unknown; set: unknown }).set = setSpy;

    await act(async () => {
      root.render(createElement(App));
      await vi.advanceTimersByTimeAsync(50);
    });

    const group = container.querySelector('.cqd-flag-pills') as HTMLElement | null;
    expect(group).not.toBeNull();
    // The old per-flag toggle rows are replaced by the pills.
    expect(container.querySelector('.cqd-flag-toggle-row')).toBeNull();

    const both = container.querySelector<HTMLButtonElement>('[data-flag="combinedFlagEnabled"]')!;
    expect(both.getAttribute('aria-pressed')).toBe('true'); // default ON

    await act(async () => {
      both.click();
    });
    expect(store.combinedFlagEnabled).toBe(false);
    expect(both.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('flag pill preview collapses under reduced motion (batch D1 conventions)', () => {
  it('the in-app .cqd-reduce-motion class freezes the preview on its AFTER state', () => {
    const css = popupCss();
    // animation: none beats the cycle (batch 1's global 0.01ms collapse only
    // shortens it, which would end on the BEFORE frame — the prototype's
    // convention is to freeze on the flagged result instead).
    expect(css).toMatch(/\.cqd-reduce-motion \.cqd-flag-pill-(ring|badge)[^{]*\{[^}]*animation:\s*none/);
  });

  it('the OS prefers-reduced-motion media query freezes the preview too', () => {
    const css = popupCss();
    // Anchor at the flag-pill section itself: App.css now carries several
    // media-query blocks (Stillwater D3 added the coffee shimmer's), so
    // "first block in the file" is no longer the flag block.
    const flagSection = css.indexOf('.cqd-flag-pill-ring');
    expect(flagSection).toBeGreaterThan(-1);
    const media = css.indexOf('@media (prefers-reduced-motion: reduce)', flagSection);
    expect(media).toBeGreaterThan(-1);
    const mediaBlock = css.slice(media, css.indexOf('}', css.indexOf('.cqd-flag-pill', media)));
    expect(mediaBlock).toContain('.cqd-flag-pill-ring');
    expect(mediaBlock).toContain('.cqd-flag-pill-badge');
    expect(mediaBlock).toMatch(/animation:\s*none/);
  });

  it('the preview cycle is defined against the prototype timing (5.2s loop)', () => {
    const css = popupCss();
    expect(css).toContain('cqd-flag-pill-ring-cycle');
    expect(css).toContain('cqd-flag-pill-badge-cycle');
    expect(css).toMatch(/cqd-flag-pill-ring-cycle\s+5\.2s/);
  });
});
