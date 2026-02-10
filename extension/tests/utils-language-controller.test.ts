import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadLanguageController() {
  vi.resetModules();
  return import('../entrypoints/utils/language-controller');
}

describe('language controller', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = 'en-US';
    chrome.storage.local.get = vi.fn(async () => ({})) as never;
    chrome.storage.local.set = vi.fn(async () => {}) as never;
    chrome.runtime.sendMessage = vi.fn() as never;
  });

  it('initializes from storage and returns current state', async () => {
    chrome.storage.local.get = vi.fn(async () => ({
      cqd_language_state: {
        mode: 'auto',
        detectedLang: 'ar',
        cachedPageLang: 'ar',
        timestamp: 1,
      },
    })) as never;
    const { languageController } = await loadLanguageController();
    const state = await languageController.getState();
    expect(state.detectedLang).toBe('ar');
    expect(await languageController.getMode()).toBe('auto');
  });

  it('falls back to default state when storage read fails', async () => {
    chrome.storage.local.get = vi.fn(async () => {
      throw new Error('storage offline');
    }) as never;
    const { languageController } = await loadLanguageController();
    expect((await languageController.getState()).mode).toBe('auto');
    expect(await languageController.getCurrentLanguage()).toBe('en');
  });

  it('setMode auto detects page language and broadcasts update', async () => {
    document.documentElement.lang = 'fr-FR';
    const { languageController } = await loadLanguageController();
    await languageController.setMode('auto');
    const state = await languageController.getState();
    expect(state.mode).toBe('auto');
    expect(state.detectedLang).toBe('fr');
    expect(chrome.storage.local.set).toHaveBeenCalled();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CQD_LANGUAGE_CHANGED', mode: 'auto', language: 'fr' }),
    );
  });

  it('setMode english forces en and getCurrentLanguage respects mode', async () => {
    document.documentElement.lang = 'es-ES';
    const { languageController } = await loadLanguageController();
    await languageController.setMode('english');
    expect(await languageController.getCurrentLanguage()).toBe('en');
    expect((await languageController.getState()).detectedLang).toBe('en');
  });

  it('refreshes cached language when page language changes in auto mode', async () => {
    const { languageController } = await loadLanguageController();
    document.documentElement.lang = 'de-DE';
    await languageController.setMode('auto');
    document.documentElement.lang = 'it-IT';
    expect(await languageController.getCurrentLanguage()).toBe('it');
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('forceRefresh updates state only in auto mode', async () => {
    const { languageController } = await loadLanguageController();
    document.documentElement.lang = 'pt-BR';
    await languageController.setMode('english');
    await languageController.forceRefresh();
    expect((await languageController.getState()).detectedLang).toBe('en');

    await languageController.setMode('auto');
    await languageController.forceRefresh();
    expect((await languageController.getState()).detectedLang).toBe('pt');
  });

  it('reset restores defaults and emits change broadcast', async () => {
    const { languageController } = await loadLanguageController();
    await languageController.setMode('english');
    await languageController.reset();
    const state = await languageController.getState();
    expect(state.mode).toBe('auto');
    expect(state.detectedLang).toBe('en');
    expect(chrome.runtime.sendMessage).toHaveBeenCalled();
  });
});

