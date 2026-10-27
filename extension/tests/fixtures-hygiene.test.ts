// filepath: extension/tests/fixtures-hygiene.test.ts
/**
 * Hygiene guard for captured Classroom fixtures.
 *
 * Raw Classroom pages embed Google page-config material (API keys, CSRF and
 * session tokens, cookie values) and the capturing account's identity. A raw
 * capture committed to this public repo produced secret-scanning alerts #3-#9
 * (2026-10-27). Fixtures must land sanitized; this guard fails on the secret
 * shapes so the next capture cannot regress.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures');

/** Secret shapes: Google page-config keys and session material. */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/AIzaSy[A-Za-z0-9_-]{33}/, 'Google API key'],
  [/"(?:SNlM0e|WZsZ1e|Q2Lvcd)":"(?!DUMMY|REDACTED)[^"]+"/, 'WIZ session/CSRF token'],
  [/Basic [A-Za-z0-9+/]{16,}/, 'Basic credential'],
];

/** Capturing account identity (update if the capture account changes). */
const IDENTITY_PATTERN = /adhamhaithameid|adham\s+haitham/i;

function* walkHtml(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkHtml(full);
    else yield full;
  }
}

describe('classroom fixture hygiene', () => {
  it('fixtures contain no API keys, session tokens, credentials, or owner identity', () => {
    const offenders: string[] = [];
    for (const file of walkHtml(FIXTURES_DIR)) {
      const text = readFileSync(file, 'utf-8');
      const lines = text.split('\n');
      const check = (pattern: RegExp, label: string) => {
        lines.forEach((line, i) => {
          if (pattern.test(line)) offenders.push(`${file}:${i + 1} ${label}`);
        });
      };
      for (const [pattern, label] of SECRET_PATTERNS) check(pattern, label);
      check(IDENTITY_PATTERN, 'owner identity');
    }
    expect(
      offenders,
      `unsanitized fixture content:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
