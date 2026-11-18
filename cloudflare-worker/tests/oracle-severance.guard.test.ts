// filepath: cloudflare-worker/tests/oracle-severance.guard.test.ts
/**
 * Oracle severance guard (bead 0h4d.2.7, decision 0h4d.9).
 *
 * The production data path is Cloudflare-only. The retired oracle-backend VM
 * exists only as a documented cold archive; the worker's ORACLE_ENDPOINT env
 * var is the one DESIGNED revival vector (optional best-effort mirror, see
 * cloudflare-worker/README.md "Data pipeline (Oracle-free)").
 *
 * This guard fails CI if a hard-coded Oracle endpoint ever appears in live
 * source — the only way code may reach Oracle is through the env var, so a
 * revert-to-Oracle cannot happen silently.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '../..');

/** Oracle identity literals that must never appear in live source. */
const ORACLE_IDENTIFIERS = [
  'oracle.classroom-quick-downloader.com',
  '129.151.233.229',
];

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.output' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, exts, acc);
    else if (exts.some((e) => name.endsWith(e))) acc.push(p);
  }
  return acc;
}

describe('oracle severance guard (0h4d.2.7)', () => {
  it('keeps every oracle host literal out of live source', () => {
    const liveDirs = [
      join(REPO_ROOT, 'cloudflare-worker/src'),
      join(REPO_ROOT, 'website/src'),
      join(REPO_ROOT, 'extension/src'),
    ];
    const files = liveDirs.flatMap((d) => walk(d, ['.ts', '.js', '.svelte']));
    expect(files.length).toBeGreaterThan(100);

    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const id of ORACLE_IDENTIFIERS) {
        if (text.includes(id)) offenders.push(`${f}: contains "${id}"`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('keeps ORACLE_ENDPOINT optional-typed in the worker env', () => {
    const types = readFileSync(join(REPO_ROOT, 'cloudflare-worker/src/types.ts'), 'utf8');
    expect(types).toMatch(/ORACLE_ENDPOINT\?:\s*string/);
  });

  it('keeps the DO mirror config-gated (no endpoint, no forward)', () => {
    const doc = readFileSync(join(REPO_ROOT, 'cloudflare-worker/src/downloads_do.ts'), 'utf8');
    // The mirror resolution must begin from the env var (empty = inert);
    // anything that skips this gate would be a silent revival.
    expect(doc).toMatch(/this\.env\.ORACLE_ENDPOINT\s*\|\|\s*""/);
  });
});
