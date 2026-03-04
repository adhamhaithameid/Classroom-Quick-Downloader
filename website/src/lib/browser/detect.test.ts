import { describe, expect, it } from 'vitest';
import { browserDisplayName, detectBrowserFromUserAgent } from './detect';

describe('browser detector', () => {
  it('detects edge ahead of chrome', () => {
    expect(
      detectBrowserFromUserAgent(
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
      )
    ).toBe('edge');
  });

  it('detects firefox and defaults to chrome', () => {
    expect(detectBrowserFromUserAgent('Mozilla/5.0 Firefox/131.0')).toBe('firefox');
    expect(detectBrowserFromUserAgent('Unknown UA')).toBe('chrome');
  });

  it('maps browser display names', () => {
    expect(browserDisplayName('chrome')).toBe('Chrome');
    expect(browserDisplayName('firefox')).toBe('Firefox');
    expect(browserDisplayName('edge')).toBe('Edge');
  });
});
