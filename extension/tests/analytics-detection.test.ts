import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function setNavigatorProp(key: string, value: unknown) {
  Object.defineProperty(globalThis.navigator, key, {
    value,
    configurable: true,
  });
}

async function loadDetection() {
  vi.resetModules();
  return import('../entrypoints/utils/analytics/detection');
}

describe('analytics detection utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setNavigatorProp('userAgent', 'Mozilla/5.0 Chrome/120');
    setNavigatorProp('language', 'en-US');
    setNavigatorProp('userAgentData', undefined);
    chrome.runtime.getManifest = vi.fn(() => ({ version: '1.2.3' })) as never;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['Mozilla/5.0 Edg/120.0', 'edge'],
    ['Mozilla/5.0 OPR/90.0', 'opera'],
    ['Mozilla/5.0 Firefox/122', 'firefox'],
    ['Mozilla/5.0 Chrome/120.0', 'chrome'],
    ['Mozilla/5.0 Safari/605.1', 'safari'],
    ['UnknownAgent', 'unknown'],
  ])('detectBrowser resolves %s as %s', async (ua, expected) => {
    const detection = await loadDetection();
    setNavigatorProp('userAgent', ua);
    expect(detection.detectBrowser()).toBe(expected);
  });

  it('detectOS uses userAgentData platform when available', async () => {
    const detection = await loadDetection();
    setNavigatorProp('userAgentData', {
      getHighEntropyValues: vi.fn(async () => ({ platform: 'Windows' })),
    });
    expect(await detection.detectOS()).toBe('windows');
  });

  it('detectOS ignores empty userAgentData platform and falls back to UA', async () => {
    const detection = await loadDetection();
    setNavigatorProp('userAgentData', {
      getHighEntropyValues: vi.fn(async () => ({ platform: '' })),
    });
    setNavigatorProp('userAgent', 'Mozilla/5.0 Linux');
    expect(await detection.detectOS()).toBe('linux');
  });

  it('detectOS falls back to userAgent when userAgentData fails', async () => {
    const detection = await loadDetection();
    setNavigatorProp('userAgentData', {
      getHighEntropyValues: vi.fn(async () => {
        throw new Error('unsupported');
      }),
    });
    setNavigatorProp('userAgent', 'Mozilla/5.0 Android');
    expect(await detection.detectOS()).toBe('android');
  });

  it.each([
    ['Mozilla/5.0 Windows NT 10.0', 'windows'],
    ['Mozilla/5.0 Macintosh; Intel Mac OS X 13_6', 'macos'],
    ['Mozilla/5.0 X11; Linux x86_64', 'linux'],
    ['Mozilla/5.0 iPhone; CPU iPhone OS 17_0 like Mac OS X', 'ios'],
  ])('detectOS maps fallback ua %s -> %s', async (ua, expected) => {
    const detection = await loadDetection();
    setNavigatorProp('userAgentData', undefined);
    setNavigatorProp('userAgent', ua);
    expect(await detection.detectOS()).toBe(expected);
  });

  it('detectOS returns unknown when no platform hints are available', async () => {
    const detection = await loadDetection();
    setNavigatorProp('userAgent', 'SomeUnknownUA');
    expect(await detection.detectOS()).toBe('unknown');
  });

  it('detectLanguage normalizes and clamps malformed language values', async () => {
    const detection = await loadDetection();
    setNavigatorProp('language', 'ar-EG');
    expect(detection.detectLanguage()).toBe('ar');
    setNavigatorProp('language', 'toolonglanguage');
    expect(detection.detectLanguage()).toBe('unknown');
  });

  it('detectBrowser and detectLanguage handle missing navigator fields', async () => {
    const detection = await loadDetection();
    setNavigatorProp('userAgent', '');
    setNavigatorProp('language', undefined);
    expect(detection.detectBrowser()).toBe('unknown');
    expect(detection.detectLanguage()).toBe('unknown');
  });

  it('detectBrowser and detectOS use empty-string fallback when userAgent is undefined', async () => {
    const detection = await loadDetection();
    setNavigatorProp('userAgent', undefined);
    expect(detection.detectBrowser()).toBe('unknown');
    expect(await detection.detectOS()).toBe('unknown');
  });

  it('getExtensionVersion caches manifest version', async () => {
    const detection = await loadDetection();
    const manifestSpy = vi.fn()
      .mockReturnValueOnce({ version: '9.9.9' })
      .mockReturnValueOnce({ version: '1.0.0' });
    chrome.runtime.getManifest = manifestSpy as never;
    expect(detection.getExtensionVersion()).toBe('9.9.9');
    expect(detection.getExtensionVersion()).toBe('9.9.9');
    expect(manifestSpy).toHaveBeenCalledTimes(1);
  });

  it('getExtensionVersion returns unknown when manifest access fails', async () => {
    const detection = await loadDetection();
    chrome.runtime.getManifest = vi.fn(() => {
      throw new Error('blocked');
    }) as never;
    expect(detection.getExtensionVersion()).toBe('unknown');
  });

  it.each([
    [1999, 'fast'],
    [2000, 'medium'],
    [9999, 'medium'],
    [10000, 'slow'],
  ])('bucketDuration(%s) => %s', async (input, expected) => {
    const detection = await loadDetection();
    expect(detection.bucketDuration(input)).toBe(expected);
  });

  it('generateEventId uses timestamp and crypto random bytes', async () => {
    const detection = await loadDetection();
    const id = detection.generateEventId(Date.UTC(2026, 0, 1));
    expect(id.startsWith('ext-')).toBe(true);
    expect(id.split('-').length).toBeGreaterThanOrEqual(3);
  });

  it('generateEventId falls back to Math.random when crypto fails', async () => {
    const detection = await loadDetection();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    const getRandomSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('rng unavailable');
    });
    const id = detection.generateEventId(Number.NaN as unknown as number);
    expect(id.startsWith('ext-')).toBe(true);
    expect(randomSpy).toHaveBeenCalled();
    getRandomSpy.mockRestore();
  });
});
