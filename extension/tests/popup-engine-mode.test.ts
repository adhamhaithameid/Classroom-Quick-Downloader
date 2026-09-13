// filepath: extension/tests/popup-engine-mode.test.ts
/**
 * S6/G2 T4 — the Engine Mode control (#684). Decisions pinned here:
 *   - Placement: a SEPARATE settings control (not folded into flag toggles).
 *   - Options: Legacy / New. The API option stays hidden until S13 OAuth.
 *   - Selecting an option calls onSelect with the exact EngineMode value;
 *     persistence + live-switch messages stay the App wiring's job.
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineModeRow } from '../entrypoints/popup/App';

describe('popup engine mode control (#684)', () => {
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

  function renderRow(props: {
    mode?: string;
    loading?: boolean;
    onSelect?: (mode: 'legacy' | 'v2') => void;
  } = {}) {
    const onSelect = props.onSelect ?? vi.fn();
    flushSync(() => {
      root.render(
        createElement(EngineModeRow, {
          mode: props.mode ?? 'legacy',
          loading: props.loading ?? false,
          onSelect,
        }),
      );
    });
    return { onSelect };
  };

  it('renders Legacy and New options with the current mode marked selected', () => {
    renderRow({ mode: 'legacy' });

    const group = container.querySelector('.cqd-engine-mode') as HTMLElement | null;
    expect(group).not.toBeNull();
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-engine-mode-option')];
    expect(buttons.map((b) => b.dataset.mode)).toEqual(['legacy', 'v2']);
    expect(buttons.find((b) => b.dataset.mode === 'legacy')?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons.find((b) => b.dataset.mode === 'v2')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('marks v2 selected when the stored mode is v2', () => {
    renderRow({ mode: 'v2' });
    const v2 = container.querySelector<HTMLButtonElement>('[data-mode="v2"]');
    expect(v2?.getAttribute('aria-pressed')).toBe('true');
  });

  it('selecting an option calls onSelect with the exact mode value', () => {
    const { onSelect } = renderRow({ mode: 'legacy' });

    const v2 = container.querySelector<HTMLButtonElement>('[data-mode="v2"]')!;
    v2.click();
    expect(onSelect).toHaveBeenCalledWith('v2');

    flushSync(() => {
      root.render(
        createElement(EngineModeRow, {
          mode: 'v2',
          loading: false,
          onSelect,
        }),
      );
    });
    const legacy = container.querySelector<HTMLButtonElement>('[data-mode="legacy"]')!;
    legacy.click();
    expect(onSelect).toHaveBeenCalledWith('legacy');
  });

  it('the API option is not rendered (hidden until S13 OAuth)', () => {
    renderRow();
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-engine-mode-option')];
    expect(buttons.some((b) => b.dataset.mode === 'v3' || b.dataset.mode === 'api')).toBe(false);
  });

  it('is disabled while loading', () => {
    renderRow({ loading: true });
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-engine-mode-option')];
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
