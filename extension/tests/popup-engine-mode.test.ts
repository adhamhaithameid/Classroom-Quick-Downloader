// filepath: extension/tests/popup-engine-mode.test.ts
/**
 * S6/G2 T4 — the Engine Mode control (#684); S13 T3 adds the API option.
 * Decisions pinned here:
 *   - Placement: a SEPARATE settings control (not folded into flag toggles).
 *   - Options: Legacy / New / API (beta). The API option is the S13 consent
 *     surface: DISABLED with a setup tooltip while the install lacks OAuth
 *     config (identity permission + oauth2 client_id — isApiConfigured()),
 *     enabled only when configured. Selecting it is the explicit consent
 *     that sets cqdV2Mode 'v3' (#398).
 *   - Selecting an option calls onSelect with the exact EngineMode value;
 *     persistence + live-switch messages stay the App wiring's job.
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineModeRow } from '../entrypoints/popup/App';

describe('popup engine mode control (#684, #398)', () => {
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
    apiConfigured?: boolean;
    onSelect?: (mode: 'legacy' | 'v2' | 'v3') => void;
  } = {}) {
    const onSelect = props.onSelect ?? vi.fn();
    flushSync(() => {
      root.render(
        createElement(EngineModeRow, {
          mode: props.mode ?? 'legacy',
          loading: props.loading ?? false,
          apiConfigured: props.apiConfigured ?? false,
          onSelect,
        }),
      );
    });
    return { onSelect };
  };

  it('renders Legacy, New and API options with the current mode marked selected', () => {
    renderRow({ mode: 'legacy' });

    const group = container.querySelector('.cqd-engine-mode') as HTMLElement | null;
    expect(group).not.toBeNull();
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-engine-mode-option')];
    expect(buttons.map((b) => b.dataset.mode)).toEqual(['legacy', 'v2', 'v3']);
    expect(buttons.find((b) => b.dataset.mode === 'legacy')?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons.find((b) => b.dataset.mode === 'v2')?.getAttribute('aria-pressed')).toBe('false');
    expect(buttons.find((b) => b.dataset.mode === 'v3')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('marks v2 selected when the stored mode is v2', () => {
    renderRow({ mode: 'v2' });
    const v2 = container.querySelector<HTMLButtonElement>('[data-mode="v2"]');
    expect(v2?.getAttribute('aria-pressed')).toBe('true');
  });

  it('selecting an option calls onSelect with the exact mode value', () => {
    const { onSelect } = renderRow({ mode: 'legacy', apiConfigured: true });

    const v2 = container.querySelector<HTMLButtonElement>('[data-mode="v2"]')!;
    v2.click();
    expect(onSelect).toHaveBeenCalledWith('v2');

    flushSync(() => {
      root.render(
        createElement(EngineModeRow, {
          mode: 'v2',
          loading: false,
          apiConfigured: true,
          onSelect,
        }),
      );
    });
    const legacy = container.querySelector<HTMLButtonElement>('[data-mode="legacy"]')!;
    legacy.click();
    expect(onSelect).toHaveBeenCalledWith('legacy');
  });

  it('the API option renders DISABLED with the setup tooltip when OAuth is not configured', () => {
    renderRow({ apiConfigured: false });

    const api = container.querySelector<HTMLButtonElement>('[data-mode="v3"]')!;
    expect(api.disabled).toBe(true);
    expect(api.getAttribute('title')).toBe('Requires OAuth setup (see docs)');

    // Disabled is the consent gate: clicking must not request the mode.
    api.click();
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-engine-mode-option')];
    expect(buttons.find((b) => b.dataset.mode === 'v3')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('the API option is enabled when the API is configured; selecting it requests v3 (explicit consent)', () => {
    const { onSelect } = renderRow({ apiConfigured: true });

    const api = container.querySelector<HTMLButtonElement>('[data-mode="v3"]')!;
    expect(api.disabled).toBe(false);
    api.click();
    expect(onSelect).toHaveBeenCalledWith('v3');
  });

  it('marks v3 selected when the stored mode is v3 (configured world)', () => {
    renderRow({ mode: 'v3', apiConfigured: true });
    const v3 = container.querySelector<HTMLButtonElement>('[data-mode="v3"]');
    expect(v3?.getAttribute('aria-pressed')).toBe('true');
  });

  it('is disabled while loading', () => {
    renderRow({ loading: true, apiConfigured: true });
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-engine-mode-option')];
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
