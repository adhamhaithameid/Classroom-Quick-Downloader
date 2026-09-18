// filepath: extension/tests/popup-i18n.test.ts
/**
 * Bead 770 — popup i18n start (settings section headers + Engine Mode row).
 * Decisions pinned here:
 *   - The popup resolves strings via chrome.i18n.getMessage and falls back to
 *     the hardcoded en strings when chrome.i18n is missing, returns '', or
 *     throws — a missing locale table must never render an empty label.
 *   - Every popup message name must exist in the generated en catalog with
 *     byte-identical text (the catalog is generated from TRANSLATIONS, the
 *     single source of truth).
 * Scope boundary: only settings headers + Engine Mode row are i18n'd (770);
 * the rest of the popup stays literal English until a follow-up bead.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineModeRow } from '../entrypoints/popup/App';
import { POPUP_MESSAGES, popupMessage, type PopupMessageKey } from '../entrypoints/popup/i18n';

const EXTENSION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function stubGetMessage(impl: (name: string) => string) {
  vi.stubGlobal('chrome', {
    i18n: {
      getMessage: vi.fn(impl),
    },
  });
}

describe('popup i18n catalog coupling (bead 770)', () => {
  it('every popup message name exists in the generated en catalog with identical text', () => {
    const en = JSON.parse(
      readFileSync(path.join(EXTENSION_ROOT, '_locales', 'en', 'messages.json'), 'utf8'),
    ) as Record<string, { message: string; description: string }>;
    for (const [key, entry] of Object.entries(POPUP_MESSAGES)) {
      const catalogEntry = en[entry.name];
      expect(catalogEntry, `missing _locales/en message "${entry.name}" for popup key "${key}"`).toBeDefined();
      expect(catalogEntry.message).toBe(entry.fallback);
      expect(catalogEntry.description).toBe(key);
    }
  });

  it('all popup message names are valid chrome.i18n names', () => {
    for (const { name } of Object.values(POPUP_MESSAGES)) {
      expect(name).toMatch(/^[a-zA-Z0-9_]+$/);
    }
  });
});

describe('popupMessage resolution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consults chrome.i18n.getMessage with the snake_case message name', () => {
    const getMessage = vi.fn(() => 'Übersetzt');
    vi.stubGlobal('chrome', { i18n: { getMessage } });
    expect(popupMessage('popupSettingsSectionEngine' as PopupMessageKey)).toBe('Übersetzt');
    expect(getMessage).toHaveBeenCalledWith('popup_settings_section_engine');
  });

  it('falls back to the en string when getMessage returns empty (missing locale entry)', () => {
    stubGetMessage(() => '');
    expect(popupMessage('popupEngineModeNew')).toBe('New');
  });

  it('falls back to the en string when chrome.i18n is unavailable', () => {
    vi.stubGlobal('chrome', {});
    expect(popupMessage('popupEngineModeLegacy')).toBe('Legacy');
  });

  it('falls back to the en string when getMessage throws', () => {
    stubGetMessage(() => {
      throw new Error('no extension context');
    });
    expect(popupMessage('popupExtensionSettings')).toBe('Extension Settings');
  });
});

describe('EngineModeRow renders through chrome.i18n', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    root.unmount();
    container.remove();
  });

  function renderRow(props: { mode?: string; loading?: boolean; apiConfigured?: boolean; onSelect?: (mode: 'legacy' | 'v2' | 'v3') => void } = {}) {
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
  }

  it('renders translated labels when the catalog provides them', () => {
    stubGetMessage((name) =>
      name === 'popup_engine_mode_legacy' ? 'Klassisch' : name === 'popup_engine_mode_new' ? 'Neu' : '',
    );
    renderRow();
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-engine-mode-option')];
    // The API label has no catalog entry in this stub — the en fallback shows.
    expect(buttons.map((b) => b.textContent)).toEqual(['Klassisch', 'Neu', 'API (beta)']);
  });

  it('marks the group with the translated aria-label', () => {
    stubGetMessage((name) => (name === 'popup_engine_mode' ? 'Modus' : ''));
    renderRow();
    const group = container.querySelector('.cqd-engine-mode');
    expect(group?.getAttribute('aria-label')).toBe('Modus');
  });

  it('keeps the en labels when the catalog lacks the messages', () => {
    stubGetMessage(() => '');
    renderRow();
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-engine-mode-option')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Legacy', 'New', 'API (beta)']);
    expect(container.querySelector('.cqd-engine-mode')?.getAttribute('aria-label')).toBe('Engine Mode');
  });

  it('resolves the API option label through the catalog when present', () => {
    stubGetMessage((name) => (name === 'popup_engine_mode_api' ? 'API (Beta)' : ''));
    renderRow();
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-engine-mode-option')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Legacy', 'New', 'API (Beta)']);
  });
});
