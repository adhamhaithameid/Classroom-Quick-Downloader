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

describe('content/button-factory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('creates download button with expected metadata and click behavior', async () => {
    const { mod, handleSingleDownloadClick } = await loadButtonFactoryModule();
    const container = document.createElement('div');
    const button = mod.createDownloadButton(container, 'https://drive.google.com/file', { name: 'f.pdf', ext: 'pdf', kind: 'file' });

    expect(button.classList.contains('cqd-download-btn')).toBe(true);
    expect(button.getAttribute('aria-label')).toContain('ariaDownload');
    expect((button.dataset as any).cqdName).toBe('f.pdf');

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handleSingleDownloadClick).toHaveBeenCalledTimes(1);
  });

  it('routes cancel-state clicks to cancel handler', async () => {
    const { mod, handleCancelClick, setState } = await loadButtonFactoryModule();
    const container = document.createElement('div');
    const button = mod.createDownloadButton(container, 'https://drive.google.com/file', { name: 'f.pdf', ext: 'pdf', kind: 'file' });

    setState('cancel');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handleCancelClick).toHaveBeenCalledTimes(1);
  });

  it('injects a button into an attachment container', async () => {
    const { mod } = await loadButtonFactoryModule();
    const container = document.createElement('div');
    document.body.appendChild(container);

    mod.injectButtonIntoAttachment(container, 'https://drive.google.com/file');
    expect(container.getAttribute('data-cqd-processed')).toBe('true');
    expect(container.querySelector('.cqd-download-btn')).toBeTruthy();
  });

  it('sets data-cancel-label attribute', async () => {
    const { mod } = await loadButtonFactoryModule();
    const container = document.createElement('div');
    const button = mod.createDownloadButton(container, 'url', { name: 'f.pdf', ext: 'pdf', kind: 'file' });
    const label = button.querySelector('.cqd-label');
    expect(label?.getAttribute('data-cancel-label')).toBe('cancel');
  });

  it('toggles cancel class on mouseenter/mouseleave when loading', async () => {
    const { mod, setState } = await loadButtonFactoryModule();
    const container = document.createElement('div');
    const button = mod.createDownloadButton(container, 'url', { name: 'f.pdf', ext: 'pdf', kind: 'file' });

    setState('loading');
    button.classList.add('cqd-loading');

    // Trigger mouseenter
    button.dispatchEvent(new MouseEvent('mouseenter'));
    expect(button.classList.contains('cqd-cancel')).toBe(true);

    // Verify text content is NOT changed manually (relying on CSS)
    const label = button.querySelector('.cqd-label');
    expect(label?.textContent).toBe('download'); // Default text

    // Trigger mouseleave
    button.dispatchEvent(new MouseEvent('mouseleave'));
    expect(button.classList.contains('cqd-cancel')).toBe(false);
  });
});
