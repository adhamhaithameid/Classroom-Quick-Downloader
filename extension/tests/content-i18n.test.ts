import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadI18nModule() {
  vi.resetModules();
  return import('../entrypoints/content/i18n');
}

describe('content/i18n', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = '';
  });

  it('detects language from page lang and resolves translation key', async () => {
    document.documentElement.lang = 'ar-EG';
    const mod = await loadI18nModule();
    expect(mod.getCurrentCachedLanguage().startsWith('ar')).toBe(true);
    expect(mod.t('download')).toBeTruthy();
  });

  it('falls back to english when key is missing from detected language', async () => {
    document.documentElement.lang = 'xx-unknown';
    const mod = await loadI18nModule();
    expect(mod.getCurrentCachedLanguage()).toBe('en');
    expect(mod.t('downloadAll')).toBeTruthy();
  });

  it('refreshLanguage falls back to direct detection when controller fails', async () => {
    const originalChrome = (globalThis as any).chrome;
    delete (globalThis as any).chrome;
    document.documentElement.lang = 'fr';
    const mod = await loadI18nModule();
    await mod.refreshLanguage();
    expect(mod.getCurrentCachedLanguage()).toBe('fr');
    (globalThis as any).chrome = originalChrome;
  });
});
