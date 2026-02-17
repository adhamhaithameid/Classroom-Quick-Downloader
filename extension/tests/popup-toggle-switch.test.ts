import { createElement, type ComponentProps } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToggleRow } from '../entrypoints/popup/App';

describe('popup toggle switch accessibility', () => {
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

  function renderToggleRow(
    overrides: Partial<ComponentProps<typeof ToggleRow>> = {},
  ) {
    const onToggle = vi.fn();

    flushSync(() => {
      root.render(
        createElement(ToggleRow, {
          label: 'Enable Extension',
          checked: false,
          onToggle,
          ...overrides,
        }),
      );
    });

    const switchLabel = container.querySelector('.cqd-switch') as HTMLLabelElement | null;
    const input = container.querySelector(
      '.cqd-switch input[type="checkbox"]',
    ) as HTMLInputElement | null;

    return { onToggle, switchLabel, input };
  }

  it('uses a native checkbox input with a11y label and no custom switch role wrapper', () => {
    const { switchLabel, input } = renderToggleRow();

    expect(switchLabel).not.toBeNull();
    expect(switchLabel?.getAttribute('role')).toBeNull();
    expect(switchLabel?.getAttribute('tabindex')).toBeNull();

    expect(input).not.toBeNull();
    expect(input?.getAttribute('aria-label')).toBe('Enable Extension');
    expect(input?.checked).toBe(false);
  });

  it('toggles when pressing Enter on the native checkbox input', () => {
    const { onToggle, input } = renderToggleRow();
    expect(input).not.toBeNull();

    input?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not toggle when disabled, including Enter key handling', () => {
    const { onToggle, input } = renderToggleRow({ disabled: true });
    expect(input).not.toBeNull();
    expect(input?.disabled).toBe(true);

    input?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    input?.click();

    expect(onToggle).not.toHaveBeenCalled();
  });
});
