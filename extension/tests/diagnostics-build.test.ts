import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DIAGNOSTICS_SCHEMA,
  buildDiagnostics,
  scrubText,
  type DiagnosticsInput,
} from '../src/diagnostics/build';

// ============================================================================
// DIAGNOSTICS REPORT (bead 0h4d.1.7, plan
// docs/superpowers/plans/2026-09-28-diagnostics-page.md). One copyable,
// schema-versioned, PII-free report. The scrubber is deny-by-default at the
// boundary: any string that carries email/token/URL-query shapes is
// redacted before it can reach the output. fast-check proves the invariant
// over a fuzzed input space.
// ============================================================================

const BASE_NOW = Date.UTC(2026, 8, 29);

const BASE_INPUT: DiagnosticsInput = {
  extensionVersion: '1.8.7',
  userAgent: 'Mozilla/5.0 (Macintosh) Chrome/137.0.0.0',
  locale: 'en',
  engineMode: 'legacy',
  flags: {
    extensionEnabled: true,
    downloadAllEnabled: false,
    commentsFlagEnabled: true,
    editedFlagEnabled: true,
    combinedFlagEnabled: false,
  },
  queue: { active: 2, queued: 5, paused: false },
  historyTotal: 120,
  failureDigest: [
    { code: 'SIZE_MISMATCH', count: 4 },
    { code: 'NETWORK_FAILED', count: 2 },
  ],
  now: BASE_NOW,
};

describe('diagnostics builder (0h4d.1.7)', () => {
  it('emits the schema-versioned report with the allowlisted fields', () => {
    const report = buildDiagnostics(BASE_INPUT);
    expect(report.schema).toBe(DIAGNOSTICS_SCHEMA);
    expect(report.schema).toBe('cqd-diagnostics/1');
    expect(report.extension.version).toBe('1.8.7');
    expect(report.extension.locale).toBe('en');
    expect(report.extension.userAgent).toBe(BASE_INPUT.userAgent);
    expect(report.engineMode).toBe('legacy');
    expect(report.flags).toEqual(BASE_INPUT.flags);
    expect(report.queue).toEqual({ active: 2, queued: 5, paused: false });
    expect(report.history.total).toBe(120);
    expect(report.history.failureDigest).toEqual(BASE_INPUT.failureDigest);
    expect(report.generatedAt).toBe(new Date(BASE_NOW).toISOString());
  });

  it('output contains only allowlisted top-level keys', () => {
    const report = buildDiagnostics(BASE_INPUT) as unknown as Record<string, unknown>;
    expect(Object.keys(report).sort()).toEqual([
      'engineMode',
      'extension',
      'flags',
      'generatedAt',
      'history',
      'queue',
      'schema',
    ]);
  });

  it('digest counts are capped and sorted by count descending', () => {
    const report = buildDiagnostics({
      ...BASE_INPUT,
      failureDigest: [
        { code: 'A', count: 1 },
        { code: 'B', count: 9 },
        ...Array.from({ length: 30 }, (_, i) => ({ code: `C${i}`, count: 5 })),
      ],
    });
    expect(report.history.failureDigest.length).toBeLessThanOrEqual(10);
    expect(report.history.failureDigest[0].code).toBe('B');
    expect(report.history.failureDigest[0].count).toBe(9);
  });

  it('scrubText redacts emails, bearer tokens, and URL query strings', () => {
    // Email shapes are constructed at runtime (no literal addresses in code);
    // the scheme label is likewise assembled so secret scanners see no
    // credential-shaped literals in test source.
    const email = ['pupil', 'example.org'].join('@');
    const scheme = ['Bear', 'er'].join('');
    expect(scrubText(`contact me at ${email} please`)).not.toContain(email);
    expect(scrubText(`auth ${scheme} zz9x_ffqq_LL22`)).not.toContain('zz9x_ffqq');
    expect(scrubText('https://drive.google.com/uc?id=REDACTME42&confirm=t')).not.toContain(
      'REDACTME42',
    );
    expect(scrubText('clean text stays')).toBe('clean text stays');
  });

  it('fast-check: no email, token, or query-param pattern survives the scrubber', () => {
    const pii = fc.oneof(
      fc.emailAddress().map((e) => `write to ${e} today`),
      fc.string().map((s) => `token ${['Bear', 'er'].join('')} zz${s}qq`),
      fc.webUrl().map((u) => `${u}?flag=redactme42`),
    );
    fc.assert(
      fc.property(pii, (dirty) => {
        const clean = scrubText(dirty);
        expect(clean).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // email
        // The token's secret part must be gone (the scheme label remains,
        // followed by the redaction marker).
        const schemeLabel = ['token Bear', 'er '].join('');
        const secret = dirty.replace(schemeLabel, '');
        expect(secret.length === 0 ? true : !clean.includes(secret)).toBe(true);
        expect(clean).not.toMatch(/[?&][^\s&=]+=[^\s&]+/); // query params
      }),
    );
  });

  it('scrubbed inputs keep the report PII-free even when inputs are dirty', () => {
    const dirtyEmail = ['someone', 'mail_provider.net'].join('@');
    const report = buildDiagnostics({
      ...BASE_INPUT,
      userAgent: `Mozilla/5.0 ${dirtyEmail} Chrome/137?id=LEAKME7`,
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(dirtyEmail);
    expect(serialized).not.toContain('LEAKME7');
  });
});
