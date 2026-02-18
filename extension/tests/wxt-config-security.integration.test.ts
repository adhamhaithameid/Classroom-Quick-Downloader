import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEFAULT_WORKER_ORIGIN = 'https://cqd-analytics.adhamhaithameid.workers.dev';
const ORIGINAL_WORKER_URL = process.env.VITE_WORKER_URL;

vi.mock('wxt', () => ({
  defineConfig: (config: unknown) => config,
}));

async function loadManifest() {
  const mod = await import('../wxt.config.ts');
  return (mod.default as { manifest: Record<string, any> }).manifest;
}

describe('wxt config security integration', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.VITE_WORKER_URL;
  });

  afterEach(() => {
    if (ORIGINAL_WORKER_URL === undefined) {
      delete process.env.VITE_WORKER_URL;
      return;
    }
    process.env.VITE_WORKER_URL = ORIGINAL_WORKER_URL;
  });

  it('uses default worker origin in host permissions and CSP', async () => {
    const manifest = await loadManifest();
    const csp = manifest.content_security_policy.extension_pages as string;

    expect(manifest.host_permissions).toContain(`${DEFAULT_WORKER_ORIGIN}/*`);
    expect(csp).toContain(DEFAULT_WORKER_ORIGIN);
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain('unsafe-eval');
  });

  it('uses worker origin derived from VITE_WORKER_URL in host permissions and CSP', async () => {
    process.env.VITE_WORKER_URL = 'http://localhost:8787/track';
    vi.resetModules();

    const manifest = await loadManifest();
    const csp = manifest.content_security_policy.extension_pages as string;

    expect(manifest.host_permissions).toContain('http://localhost:8787/*');
    expect(csp).toContain('http://localhost:8787');
    expect(csp).not.toContain('wasm-unsafe-eval');
  });
});
