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
      get: vi.fn((keys, callback) => callback({})),
      set: vi.fn((items, callback) => callback?.()),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    lastError: null,
  },
};

// @ts-expect-error - Mock chrome global
globalThis.chrome = mockChrome;

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
