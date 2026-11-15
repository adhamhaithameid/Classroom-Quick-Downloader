// filepath: extension/tests/popup-engine-mode.test.ts
/**
 * S6/G2 T4 — the Engine Mode control (#684); S13 T3 adds the API option.
 * Phase 4 batch D2 (Stillwater) re-presents it as the approved SEGMENTED
 * control (prototypes/components.html option 1): three equal segments, the
 * selection marked with role="radio" + aria-checked inside a radiogroup,
 * arrow keys move the selection, focus stays visible.
 * Decisions pinned here:
 *   - Placement: a SEPARATE settings control (not folded into flag toggles).
 *   - Options: Legacy / New / API (beta). New renders SELECTED by default
 *     (fresh installs run DEFAULT_MODE 'v2' — the marked default).
 *   - The API option is the S13 consent surface: DISABLED with a setup
 *     tooltip while the install lacks OAuth config (identity permission +
 *     oauth2 client_id — isApiConfigured()), enabled only when configured.
 *     Selecting it is the explicit consent that sets cqdV2Mode 'v3' (#398).
 *   - Selecting an option (click or arrow key) calls onSelect with the exact
 *     EngineMode value; persistence + live-switch messages stay the App
 *     wiring's job.
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineModeRow, resolveEngineMode } from '../entrypoints/popup/App';

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
    onSelect?: (mode: 'legacy' | 'v2' | 'v3' | 'auto') => void;
  } = {}) {
    const onSelect = props.onSelect ?? vi.fn();
    flushSync(() => {
      root.render(
        createElement(EngineModeRow, {
          // The default mirrors the runtime: no saved value resolves to
          // DEFAULT_MODE 'v2' (mode-controller.ts readMode), so the control
          // renders New selected on fresh installs. The old pin here was
          // 'legacy' — the fresh-install label quirk (audit finding 12).
          mode: props.mode ?? 'v2',
          loading: props.loading ?? false,
          apiConfigured: props.apiConfigured ?? false,
          onSelect,
        }),
      );
    });
    return { onSelect };
  };

  function radios(): HTMLButtonElement[] {
    return [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  }

  it('renders a radiogroup of four radio segments (incl. Auto, hhpa.3), New checked by default', () => {
    renderRow();

    const group = container.querySelector('[role="radiogroup"]') as HTMLElement | null;
    expect(group).not.toBeNull();
    expect(group?.classList.contains('cqd-engine-mode')).toBe(true);
    expect(group?.getAttribute('aria-label')).toBe('Engine Mode');

    const buttons = radios();
    expect(buttons.map((b) => b.dataset.mode)).toEqual(['legacy', 'v2', 'v3', 'auto']);
    expect(buttons.find((b) => b.dataset.mode === 'v2')?.getAttribute('aria-checked')).toBe('true');
    expect(buttons.find((b) => b.dataset.mode === 'legacy')?.getAttribute('aria-checked')).toBe('false');
    expect(buttons.find((b) => b.dataset.mode === 'v3')?.getAttribute('aria-checked')).toBe('false');
  });

  it('a saved legacy value still renders Legacy checked (one-click rollback intact)', () => {
    renderRow({ mode: 'legacy' });

    const buttons = radios();
    expect(buttons.find((b) => b.dataset.mode === 'legacy')?.getAttribute('aria-checked')).toBe('true');
    expect(buttons.find((b) => b.dataset.mode === 'v2')?.getAttribute('aria-checked')).toBe('false');
    expect(buttons.find((b) => b.dataset.mode === 'v3')?.getAttribute('aria-checked')).toBe('false');
  });

  it('a saved v2 value renders New checked', () => {
    renderRow({ mode: 'v2' });
    const v2 = container.querySelector<HTMLButtonElement>('[data-mode="v2"]');
    expect(v2?.getAttribute('aria-checked')).toBe('true');
  });

  it('uses roving tabindex: only the checked segment is tabbable', () => {
    renderRow({ mode: 'legacy' });

    const buttons = radios();
    expect(buttons.find((b) => b.dataset.mode === 'legacy')?.tabIndex).toBe(0);
    expect(buttons.find((b) => b.dataset.mode === 'v2')?.tabIndex).toBe(-1);
    expect(buttons.find((b) => b.dataset.mode === 'v3')?.tabIndex).toBe(-1);
  });

  it('resolveEngineMode mirrors readMode(): missing/invalid storage falls back to v2', () => {
    // No saved value (fresh install), empty string, corruption, removal.
    expect(resolveEngineMode(undefined)).toBe('v2');
    expect(resolveEngineMode(null)).toBe('v2');
    expect(resolveEngineMode('')).toBe('v2');
    expect(resolveEngineMode('shadow')).toBe('v2'); // not a popup mode
    expect(resolveEngineMode(42)).toBe('v2');
  });

  it('resolveEngineMode passes saved modes through unchanged', () => {
    expect(resolveEngineMode('legacy')).toBe('legacy');
    expect(resolveEngineMode('v2')).toBe('v2');
    expect(resolveEngineMode('v3')).toBe('v3');
    expect(resolveEngineMode('auto')).toBe('auto');
  });

  it('clicking a segment calls onSelect with the exact mode value', () => {
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

  it('ArrowRight moves the selection to the next segment (selection follows focus)', () => {
    const { onSelect } = renderRow({ mode: 'legacy', apiConfigured: true });

    const legacy = container.querySelector<HTMLButtonElement>('[data-mode="legacy"]')!;
    legacy.focus();
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    legacy.dispatchEvent(event);

    expect(onSelect).toHaveBeenCalledWith('v2');
    expect(document.activeElement).toBe(container.querySelector('[data-mode="v2"]'));
  });

  it('ArrowLeft wraps backwards from Legacy to the last segment', () => {
    const { onSelect } = renderRow({ mode: 'legacy', apiConfigured: true });

    const legacy = container.querySelector<HTMLButtonElement>('[data-mode="legacy"]')!;
    legacy.focus();
    legacy.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith('auto');
    expect(document.activeElement).toBe(container.querySelector('[data-mode="auto"]'));
  });

  it('arrow navigation skips the disabled API segment and lands on Auto (hhpa.3)', () => {
    const { onSelect } = renderRow({ mode: 'v2', apiConfigured: false });

    const v2 = container.querySelector<HTMLButtonElement>('[data-mode="v2"]')!;
    v2.focus();
    v2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith('auto');
    expect(onSelect).not.toHaveBeenCalledWith('v3');
    expect(document.activeElement).toBe(container.querySelector('[data-mode="auto"]'));
  });

  it('the Auto option (hhpa.3) is always enabled and requests auto', () => {
    const { onSelect } = renderRow({ mode: 'v2' });

    const auto = container.querySelector<HTMLButtonElement>('[data-mode="auto"]')!;
    expect(auto.disabled).toBe(false);
    auto.click();
    expect(onSelect).toHaveBeenCalledWith('auto');
  });

  it('the API option renders DISABLED with the setup tooltip when OAuth is not configured', () => {
    renderRow({ apiConfigured: false });

    const api = container.querySelector<HTMLButtonElement>('[data-mode="v3"]')!;
    expect(api.disabled).toBe(true);
    expect(api.getAttribute('title')).toBe('Requires OAuth setup (see docs)');

    // Disabled is the consent gate: clicking must not request the mode.
    api.click();
    const buttons = radios();
    expect(buttons.find((b) => b.dataset.mode === 'v3')?.getAttribute('aria-checked')).toBe('false');
  });

  it('the API option is enabled when the API is configured; selecting it requests v3 (explicit consent)', () => {
    const { onSelect } = renderRow({ apiConfigured: true });

    const api = container.querySelector<HTMLButtonElement>('[data-mode="v3"]')!;
    expect(api.disabled).toBe(false);
    api.click();
    expect(onSelect).toHaveBeenCalledWith('v3');
  });

  it('marks v3 checked when the stored mode is v3 (configured world)', () => {
    renderRow({ mode: 'v3', apiConfigured: true });
    const v3 = container.querySelector<HTMLButtonElement>('[data-mode="v3"]');
    expect(v3?.getAttribute('aria-checked')).toBe('true');
  });

  it('is disabled while loading', () => {
    renderRow({ loading: true, apiConfigured: true });
    const buttons = radios();
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
