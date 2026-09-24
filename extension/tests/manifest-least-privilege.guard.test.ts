// filepath: extension/tests/manifest-least-privilege.guard.test.ts
// ============================================================================
// MANIFEST LEAST-PRIVILEGE GUARD (S3) — audit
// docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md finding S3.
//
// wxt.config.ts is the single source of the shipped manifest. The Oracle
// backend is severed (zero requests verified across the 2026-09-24 audit
// runtime matrix) and accounts.google.com has zero runtime references
// (auth rides chrome.identity), yet both sat in host_permissions and the
// oracle host in CSP connect-src. This guard pins least privilege so neither
// can quietly return, and no <all_urls> can ever be introduced.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const wxtConfig = readFileSync(join(here, '../wxt.config.ts'), 'utf8');

describe('manifest least-privilege guard (S3)', () => {
  it('declares no oracle host anywhere', () => {
    expect(wxtConfig).not.toContain('oracle.classroom-quick-downloader.com');
  });

  it('declares no accounts.google.com host permission', () => {
    expect(wxtConfig).not.toContain("'https://accounts.google.com/*'");
  });

  it('never requests <all_urls>', () => {
    expect(wxtConfig).not.toContain('<all_urls>');
  });

  it('keeps exactly the required API permissions', () => {
    for (const perm of ['downloads', 'storage', 'alarms', 'identity']) {
      expect(wxtConfig).toContain(`'${perm}'`);
    }
  });

  it('keeps the oauth2 classroom.readonly scope', () => {
    expect(wxtConfig).toContain('classroom.readonly');
  });

  it('still allowlists the hosts the extension actually talks to', () => {
    for (const host of [
      'drive.google.com',
      'classroom.google.com',
      'drive.usercontent.google.com',
      'cqd-analytics.adhamhaithameid.workers.dev',
    ]) {
      expect(wxtConfig).toContain(host);
    }
  });
});
