import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hasPromiseBasedMessaging, isFirefox, logFirefox, warnFirefox } from '../entrypoints/utils/firefox-debug';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function setNavigatorUA(userAgent: string) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent },
    configurable: true,
  });
}

describe('firefox debug utils', () => {
  beforeEach(() => {
    setNavigatorUA('Mozilla/5.0 Firefox/123');
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    }
  });

  it('detects firefox user agent', () => {
    expect(isFirefox()).toBe(true);
    setNavigatorUA('Mozilla/5.0 Chrome/121');
    expect(isFirefox()).toBe(false);
  });

  it('hasPromiseBasedMessaging depends on firefox and runtime API availability', () => {
    chrome.runtime.sendMessage = (() => undefined) as never;
    setNavigatorUA('Mozilla/5.0 Firefox/123');
    expect(hasPromiseBasedMessaging()).toBe(true);

    setNavigatorUA('Mozilla/5.0 Chrome/121');
    expect(hasPromiseBasedMessaging()).toBe(false);

    (chrome.runtime as any).sendMessage = undefined;
    expect(hasPromiseBasedMessaging()).toBe(false);
  });

  it('log and warn helpers are no-ops', () => {
    expect(() => logFirefox('cat', 'msg', { a: 1 })).not.toThrow();
    expect(() => warnFirefox('cat', 'warn', { a: 1 })).not.toThrow();
  });
});

