// filepath: entrypoints/utils/language-controller.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

import { expandLanguageCandidates } from '../../src/core/i18n/resolve';

/**
 * Language Controller
 *
 * Central management for extension language state with 3 core functions:
 * 1. Detect page language reliably
 * 2. Manage user mode (Auto vs English-only)
 * 3. Provide cached, consistent language across all extension components
 */

export type LanguageMode = 'auto' | 'english';

export interface LanguageState {
  mode: LanguageMode;
  detectedLang: string;
  cachedPageLang: string;
  timestamp: number;
}

const STORAGE_KEY = 'cqd_language_state';
const DEFAULT_STATE: LanguageState = {
  mode: 'auto',
  detectedLang: 'en',
  cachedPageLang: '',
  timestamp: Date.now(),
};

function cloneDefaultState(): LanguageState {
  return {
    ...DEFAULT_STATE,
    timestamp: Date.now(),
  };
}

/**
 * LanguageController - Singleton for managing extension language
 */
class LanguageController {
  private state: LanguageState | null = null;
  private initPromise: Promise<void> | null = null;

  private async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(STORAGE_KEY);
          this.state = result[STORAGE_KEY] || cloneDefaultState();
        } else {
          this.state = cloneDefaultState();
        }
      } catch (error) {
        console.warn('[CQD Language] Failed to load state from storage:', error);
        this.state = cloneDefaultState();
      }
    })();

    return this.initPromise;
  }

  private async saveState(): Promise<void> {
    if (!this.state) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: this.state });
      }
    } catch (error) {
      console.warn('[CQD Language] Failed to save state to storage:', error);
    }
  }

  /**
   * Best language tag for the current page: the first candidate from the
   * shared resolver — alias-normalized, full tag preserved (`zh-CN` stays
   * `zh-cn`, never truncates to an unresolvable base `zh`). The TRANSLATIONS
   * consumer (content/i18n.ts) resolves this tag against its table and guards
   * the final fallback, so this module stays table-agnostic.
   */
  private detectPageLanguage(): string {
    const pageLang =
      typeof document !== 'undefined' ? document.documentElement?.lang || '' : '';
    if (pageLang) {
      return expandLanguageCandidates(pageLang)[0];
    }

    if (typeof navigator !== 'undefined' && navigator.language) {
      return expandLanguageCandidates(navigator.language)[0];
    }

    return 'en';
  }

  async getMode(): Promise<LanguageMode> {
    await this.initialize();
    return this.state?.mode || 'auto';
  }

  async setMode(mode: LanguageMode): Promise<void> {
    await this.initialize();
    if (!this.state) return;

    this.state.mode = mode;
    this.state.timestamp = Date.now();

    if (mode === 'auto') {
      this.state.detectedLang = this.detectPageLanguage();
      this.state.cachedPageLang = document.documentElement?.lang || '';
    } else {
      this.state.detectedLang = 'en';
    }

    await this.saveState();
    this.broadcastLanguageChange();
  }

  async getCurrentLanguage(): Promise<string> {
    await this.initialize();
    if (!this.state) return 'en';

    if (this.state.mode === 'english') {
      return 'en';
    }

    const currentPageLang = document.documentElement?.lang || '';
    if (currentPageLang !== this.state.cachedPageLang) {
      this.state.detectedLang = this.detectPageLanguage();
      this.state.cachedPageLang = currentPageLang;
      this.state.timestamp = Date.now();
      await this.saveState();
    }

    return this.state.detectedLang;
  }

  async forceRefresh(): Promise<void> {
    await this.initialize();
    if (!this.state || this.state.mode !== 'auto') return;

    this.state.detectedLang = this.detectPageLanguage();
    this.state.cachedPageLang = document.documentElement?.lang || '';
    this.state.timestamp = Date.now();
    await this.saveState();
    this.broadcastLanguageChange();
  }

  async getState(): Promise<LanguageState> {
    await this.initialize();
    return this.state ? { ...this.state } : cloneDefaultState();
  }

  private broadcastLanguageChange(): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'CQD_LANGUAGE_CHANGED',
          language: this.state?.detectedLang,
          mode: this.state?.mode,
        });
      }
    } catch {
      // Ignore messaging errors
    }
  }

  async reset(): Promise<void> {
    this.state = cloneDefaultState();
    await this.saveState();
    this.broadcastLanguageChange();
  }
}

export const languageController = new LanguageController();
