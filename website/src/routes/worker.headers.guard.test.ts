import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

// Guard: every asset response served through the Cloudflare Pages worker
// carries the security headers. Redirects are exempt (browsers ignore
// response headers on 301/308 hops to the canonical host).
const workerSource = readFileSync(new URL('../../static/_worker.js', import.meta.url), 'utf8');

// The worker is an ES module with a default fetch handler plus the exported
// CSP builder; import it directly so the tests exercise the real hashing.
const workerModuleUrl = new URL('../../static/_worker.js', import.meta.url).href;

async function loadWorkerModule() {
  return import(workerModuleUrl);
}

// The browser's CSP source expression hashes the exact bytes between
// <script> and </script>; mirror that with node's crypto for assertions.
function expectedSource(body: string): string {
  const digest = createHash('sha256').update(body, 'utf8').digest('base64');
  // CSP hash sources are single-quoted per the grammar.
  return `'sha256-${digest}'`;
}

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

  it('sets X-Frame-Options: DENY on asset responses', () => {
    expect(workerSource).toContain("'x-frame-options'");
    expect(workerSource).toContain('DENY');
  });

  it('applies the headers to the asset fetch response, not only redirects', () => {
    expect(workerSource).toMatch(/withContentSecurityPolicy\(request,\s*await env\.ASSETS\.fetch/);
  });

  it('builds a script-src covering every executable inline script', async () => {
    const { buildContentSecurityPolicy } = await loadWorkerModule();
    const classic = "document.documentElement.classList.add('js');";
    const moduleScript = 'const x = 1;';
    const html = [
      '<html><head>',
      `<script>${classic}</script>`,
      `<script type="module">${moduleScript}</script>`,
      '<script type="application/ld+json">{"evil":"ignored"}</script>',
      '<script src="/external.js"></script>',
      '</head></html>'
    ].join('');

    const csp = await buildContentSecurityPolicy(html);

    expect(csp).toContain(`script-src 'self'`);
    expect(csp).toContain(expectedSource(classic));
    expect(csp).toContain(expectedSource(moduleScript));
    // Non-executable and external scripts must not become hash sources.
    expect(csp).not.toContain(expectedSource('{"evil":"ignored"}'));
    const scriptSrc = csp.split(';').find((directive: string) => directive.includes('script-src'));
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  it('keeps strict baseline directives in every generated policy', async () => {
    const { buildContentSecurityPolicy } = await loadWorkerModule();
    const csp = await buildContentSecurityPolicy('<html><body>no scripts</body></html>');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://fonts.gstatic.com');
    expect(csp).toContain('https://cqd-analytics.adhamhaithameid.workers.dev');
  });

  it('hashes the two app.html inline scripts the way the browser will', async () => {
    const { buildContentSecurityPolicy } = await loadWorkerModule();
    const appHtml = readFileSync(new URL('../../src/app.html', import.meta.url), 'utf8');
    const csp = await buildContentSecurityPolicy(appHtml);

    const inlineBodies = [...appHtml.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((m) => m[1]);
    expect(inlineBodies.length).toBeGreaterThanOrEqual(2);
    for (const body of inlineBodies) {
      expect(csp).toContain(expectedSource(body));
    }
  });

  it('treats </script > with trailing whitespace as an end tag, like the browser', async () => {
    const { buildContentSecurityPolicy } = await loadWorkerModule();
    const html = '<html><head><script>doThing("<b>");</script ><script>other();</script></head></html>';
    const csp = await buildContentSecurityPolicy(html);
    expect(csp).toContain(expectedSource('doThing("<b>");'));
    expect(csp).toContain(expectedSource('other();'));
  });
});
