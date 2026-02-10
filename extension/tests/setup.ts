/**
 * Test Setup - Global configuration for Vitest
 * Mocks browser APIs not available in JSDOM
 */

import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock chrome API
const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        if (typeof callback === 'function') {
          callback({});
          return;
        }
        return Promise.resolve({});
      }),
      set: vi.fn((items, callback) => {
        callback?.();
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    getManifest: vi.fn(() => ({ version: '1.3.0-test' })),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: null,
  },
  tabs: {
    create: vi.fn(),
    remove: vi.fn(),
    get: vi.fn(),
    onUpdated: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
  },
  downloads: {
    download: vi.fn(),
    cancel: vi.fn(),
    onDeterminingFilename: { addListener: vi.fn() },
    onCreated: { addListener: vi.fn() },
    onChanged: { addListener: vi.fn() },
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    get: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  action: {
    setIcon: vi.fn(),
  },
};

// @ts-expect-error - Mock chrome global
globalThis.chrome = mockChrome;

// WXT macro shims used by entrypoint modules in tests.
// @ts-expect-error - test-only global shim
globalThis.defineContentScript = (config: unknown) => config;
// @ts-expect-error - test-only global shim
globalThis.defineBackground = (factory: unknown) => factory;

// Mock window.getComputedStyle for JSDOM
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (element: Element, pseudoElt?: string | null) => {
  try {
    return originalGetComputedStyle(element, pseudoElt);
  } catch {
    return {
      display: 'block',
      visibility: 'visible',
      position: 'static',
      direction: 'ltr',
      borderRadius: '8px',
    } as CSSStyleDeclaration;
  }
};

// Mock document.createTreeWalker if needed
if (!document.createTreeWalker) {
  // @ts-expect-error - Minimal mock
  document.createTreeWalker = () => ({
    nextNode: () => null,
  });
}

// Set consistent date for testing
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-01-24T08:00:00.000Z'));
