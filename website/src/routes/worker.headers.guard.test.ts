import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Guard: every asset response served through the Cloudflare Pages worker
// carries the security headers. Redirects are exempt (browsers ignore
// response headers on 301/308 hops to the canonical host).
const workerSource = readFileSync(new URL('../../static/_worker.js', import.meta.url), 'utf8');

describe('Cloudflare worker security headers', () => {
  it('sets Strict-Transport-Security on asset responses', () => {
    expect(workerSource).toContain("'strict-transport-security'");
  });

  it('sets X-Content-Type-Options: nosniff on asset responses', () => {
    expect(workerSource).toContain("'x-content-type-options'");
    expect(workerSource).toContain('nosniff');
  });

  it('sets Referrer-Policy on asset responses', () => {
    expect(workerSource).toContain("'referrer-policy'");
  });

  it('sets Permissions-Policy on asset responses', () => {
    expect(workerSource).toContain("'permissions-policy'");
  });

  it('applies the headers to the asset fetch response, not only redirects', () => {
    expect(workerSource).toMatch(/withSecurityHeaders\(\s*await env\.ASSETS\.fetch/);
  });
});
