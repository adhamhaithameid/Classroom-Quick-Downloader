import { describe, expect, it } from 'vitest';
import {
  APP_VERSION,
  ORACLE_API_BASE_URL,
  SITE_URL,
  STORE_LINKS,
  WORKER_BASE_URL
} from './config';

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

describe('SITE_URL hydration safety (bead vsyk)', () => {
  it('does not change with the browser origin, so server and client SEO tags match', async () => {
    const { vi } = await import('vitest');
    vi.resetModules();
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5199' } });
    try {
      const mod = await import('./config');
      expect(mod.SITE_URL).not.toContain('localhost');
      expect(mod.SITE_URL).toBe(SITE_URL);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('website config exports', () => {
  it('exports valid HTTPS base URLs for site and APIs', () => {
    expect(isValidHttpsUrl(SITE_URL)).toBe(true);
    expect(isValidHttpsUrl(ORACLE_API_BASE_URL)).toBe(true);
    expect(isValidHttpsUrl(WORKER_BASE_URL)).toBe(true);
  });

  it('exposes app version in v-prefixed format', () => {
    expect(APP_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('ships valid HTTPS install and repository links', () => {
    expect(isValidHttpsUrl(STORE_LINKS.chrome)).toBe(true);
    expect(isValidHttpsUrl(STORE_LINKS.firefox)).toBe(true);
    expect(isValidHttpsUrl(STORE_LINKS.edge)).toBe(true);
    expect(isValidHttpsUrl(STORE_LINKS.github)).toBe(true);
    expect(STORE_LINKS.github).toContain('github.com');
  });
});
