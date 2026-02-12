import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadButtonState() {
  vi.resetModules();
  vi.doMock('../entrypoints/content/icons', () => ({
    DOWNLOAD_ICON_SVG_URL: 'download-icon',
    SUCCESS_ICON_SVG_URL: 'success-icon',
    ERROR_ICON_SVG_URL: 'error-icon',
    CANCEL_ICON_SVG_URL: 'cancel-icon',
  }));
  vi.doMock('../entrypoints/content/i18n', () => ({
    t: vi.fn((key: string) => key),
  }));
  return import('../entrypoints/content/button-state');
}

function makeButton(): HTMLButtonElement {
  const button = document.createElement('button');
  const icon = document.createElement('span');
  icon.className = 'cqd-download-icon';
  const label = document.createElement('span');
  label.className = 'cqd-label';
  const error = document.createElement('span');
  error.className = 'cqd-error-detail';
  button.append(icon, label, error);
  return button;
}

describe('content button state', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reads button state from css classes and applies transition rules', async () => {
    const mod = await loadButtonState();
    const button = makeButton();
    expect(mod.getButtonState(button)).toBe('idle');
    button.classList.add('cqd-loading');
    expect(mod.getButtonState(button)).toBe('loading');
    button.className = 'cqd-success';
    expect(mod.getButtonState(button as HTMLButtonElement)).toBe('success');

    expect(mod.shouldAllowTransition('loading', 'idle', false)).toBe(true);
    expect(mod.shouldAllowTransition('cancel', 'loading', true)).toBe(false);
    expect(mod.shouldAllowTransition('cancel', 'loading', false)).toBe(true);
    expect(mod.shouldAllowTransition('success', 'loading', false)).toBe(false);
  });

  it('applies visual state updates for loading/trying/cancel/success/error', async () => {
    const mod = await loadButtonState();
    const button = makeButton();
    const label = button.querySelector('.cqd-label') as HTMLSpanElement;
    const icon = button.querySelector('.cqd-download-icon') as HTMLElement;

    mod.setButtonState(button, 'loading');
    expect(button.classList.contains('cqd-loading')).toBe(true);
    expect(label.textContent).toBe('downloading');

    mod.setButtonState(button, 'trying', { userMessage: 'retrying' });
    expect(button.classList.contains('cqd-trying')).toBe(true);
    expect(label.textContent).toBe('retrying');

    mod.setButtonState(button, 'cancel');
    expect(label.textContent).toBe('cancel');
    expect(icon.style.backgroundImage).toContain('cancel-icon');

    mod.setButtonState(button, 'success');
    expect(label.textContent).toBe('downloaded');
    expect(icon.style.backgroundImage).toContain('success-icon');

    mod.setButtonState(button, 'idle');
    mod.setButtonState(button, 'error', { userMessage: 'failed' });
    expect(button.disabled).toBe(true);
    expect(label.textContent).toBe('failed');
    expect(icon.style.backgroundImage).toContain('error-icon');
  });

  it('skips transition when moving out of terminal state and supports hover cancel style', async () => {
    const mod = await loadButtonState();
    const button = makeButton();
    const label = button.querySelector('.cqd-label') as HTMLSpanElement;
    const icon = button.querySelector('.cqd-download-icon') as HTMLElement;

    mod.setButtonState(button, 'success');
    mod.setButtonState(button, 'loading');
    expect(button.classList.contains('cqd-success')).toBe(true);

    mod.setButtonState(button, 'idle');
    (button.dataset as any).cqdMouseOver = 'true';
    mod.setButtonState(button, 'loading');
    expect(button.classList.contains('cqd-cancel')).toBe(true);
    // Visual text/icon is now handled by CSS, so we just check the class
    expect(label.textContent).toBe('downloading');
  });

  it('returns early when required button elements are missing and sets pill progress', async () => {
    const mod = await loadButtonState();
    const incompleteButton = document.createElement('button');
    expect(() => mod.setButtonState(incompleteButton, 'loading')).not.toThrow();

    const button = makeButton();
    mod.setPillProgress(button, 1.5);
    expect(button.style.getPropertyValue('--cqd-progress')).toBe('100%');
    mod.setPillProgress(button, -1);
    expect(button.style.getPropertyValue('--cqd-progress')).toBe('0%');
  });
});

