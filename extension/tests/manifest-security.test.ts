import { describe, expect, it } from 'vitest';
import {
  buildExtensionPagesCsp,
  buildHostPermissions,
  resolveWorkerOrigin,
} from '../src/config/manifest-security';

describe('manifest security config', () => {
  it('resolves analytics origin from an HTTPS worker URL', () => {
    expect(resolveWorkerOrigin('https://metrics.example.com/track')).toBe('https://metrics.example.com');
  });

  it('supports localhost worker URL for local development', () => {
    expect(resolveWorkerOrigin('http://localhost:8787/track')).toBe('http://localhost:8787');
  });

  it('falls back to default worker origin for invalid URL input', () => {
    expect(resolveWorkerOrigin('not-a-url')).toBe('https://cqd-analytics.adhamhaithameid.workers.dev');
    expect(resolveWorkerOrigin('ftp://example.com/track')).toBe('https://cqd-analytics.adhamhaithameid.workers.dev');
  });

  it('builds host permissions with exactly one worker wildcard', () => {
    const permissions = buildHostPermissions('https://cqd-analytics.adhamhaithameid.workers.dev/track');
    const workerPermission = 'https://cqd-analytics.adhamhaithameid.workers.dev/*';

    expect(permissions).toContain(workerPermission);
    expect(permissions.filter((entry) => entry === workerPermission)).toHaveLength(1);
    expect(permissions).toContain('https://drive.google.com/*');
    expect(permissions).toContain('https://classroom.google.com/*');
    expect(permissions).toContain('https://drive.usercontent.google.com/*');
    expect(permissions).toContain('https://accounts.google.com/*');
  });

  it('builds strict extension-pages CSP without unsafe-eval', () => {
    const csp = buildExtensionPagesCsp('http://localhost:8787/track');

    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("object-src 'self';");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('http://localhost:8787');
    expect(csp).toContain('https://drive.google.com');
    expect(csp).toContain('https://classroom.google.com');
    expect(csp).toContain('https://drive.usercontent.google.com');
    expect(csp).toContain('https://accounts.google.com');
    expect(csp).not.toContain('unsafe-eval');
  });
});
