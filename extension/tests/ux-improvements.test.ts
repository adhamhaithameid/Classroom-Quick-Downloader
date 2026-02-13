import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadButtonFactoryModule() {
  vi.resetModules();

  let state: 'idle' | 'loading' | 'trying' | 'cancel' | 'cancelled' = 'idle';
  const handleCancelClick = vi.fn(async () => {});
  const handleSingleDownloadClick = vi.fn(async () => {});
  const getButtonState = vi.fn(() => state);
  const setButtonState = vi.fn((_btn: HTMLButtonElement, next: typeof state) => {
    state = next;
  });
  const updateAriaLabel = vi.fn((button: HTMLButtonElement, label: string) => {
    if (label === 'cancel') button.setAttribute('aria-label', 'cancel');
  });

  vi.doMock('../entrypoints/content/state', () => ({
    INJECTED_ATTR: 'data-cqd-injected',
    PROCESSED_ATTR: 'data-cqd-processed',
  }));
  vi.doMock('../entrypoints/content/url-utils', () => ({
    toDownloadUrl: (url: string) => `${url}&download=1`,
  }));
  vi.doMock('../entrypoints/content/file-meta', () => ({
    extractFileMeta: () => ({ name: 'handout.pdf', ext: 'pdf', kind: 'file' }),
  }));
  vi.doMock('../entrypoints/content/button-state', () => ({
    getButtonState,
    setButtonState,
    updateAriaLabel,
  }));
  vi.doMock('../entrypoints/content/download-handler', () => ({
    handleCancelClick,
    handleSingleDownloadClick,
  }));
  vi.doMock('../entrypoints/content/icons', () => ({
    DOWNLOAD_ICON_SVG_URL: 'download',
    CANCEL_ICON_SVG_URL: 'cancel',
  }));
  vi.doMock('../entrypoints/content/i18n', () => ({
    t: (key: string) => key,
  }));
  vi.doMock('../entrypoints/content/theme', () => ({
    isPageDark: () => false,
  }));

  const mod = await import('../entrypoints/content/button-factory');
  return { mod, handleCancelClick, handleSingleDownloadClick, getButtonState, setState: (next: typeof state) => { state = next; } };
}

describe('UX Improvements: Accessibility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows cancel visual on focus when loading (keyboard accessibility)', async () => {
    const { mod, setState } = await loadButtonFactoryModule();
    const container = document.createElement('div');
    const button = mod.createDownloadButton(container, 'https://drive.google.com/file', { name: 'f.pdf', ext: 'pdf', kind: 'file' });

    // Simulate loading state
    setState('loading');

    // Simulate focus
    button.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

    // Should have cancel class
    expect(button.classList.contains('cqd-cancel')).toBe(true);
  });

  it('updates aria-label to indicate cancel possibility on interaction', async () => {
     const { mod, setState } = await loadButtonFactoryModule();
     const container = document.createElement('div');
     const button = mod.createDownloadButton(container, 'https://drive.google.com/file', { name: 'f.pdf', ext: 'pdf', kind: 'file' });

     setState('loading');
     button.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

     // Should have descriptive aria-label
     expect(button.getAttribute('aria-label')).toContain('cancel');
  });

  it('cancels download on Escape key press', async () => {
    const { mod, setState, handleCancelClick } = await loadButtonFactoryModule();
    const container = document.createElement('div');
    const button = mod.createDownloadButton(container, 'https://drive.google.com/file', { name: 'f.pdf', ext: 'pdf', kind: 'file' });

    setState('loading');
    // Simulate Escape key
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(handleCancelClick).toHaveBeenCalledTimes(1);
  });
});
