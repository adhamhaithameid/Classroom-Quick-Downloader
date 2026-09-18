// filepath: extension/tests/accuracy/corpus-checksums.test.ts
/**
 * ADR-0008 corpus integrity gate — "a silently edited label is a build
 * failure." The hand-labelled expected.json files are the C1 ground truth;
 * this test re-hashes the corpus in-process and pins tests/accuracy/corpus/
 * CHECKSUMS.json to it, so a label or capture edit without an explicit
 * regeneration fails the unit suite (CI additionally runs `corpus:check` in
 * the accuracy gate step).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildCorpusChecksums,
  CHECKSUMS_PATH,
  CORPUS_DIR,
  diffChecksums,
  serializeChecksums,
} from '../../tools/corpus-manifest.mjs';

describe('accuracy corpus checksum manifest (ADR-0008)', () => {
  it('has a CHECKSUMS.json pinned to the current corpus byte-for-byte', () => {
    expect(existsSync(CHECKSUMS_PATH)).toBe(true);
    const committed = JSON.parse(readFileSync(CHECKSUMS_PATH, 'utf8'));
    expect(committed.manifestVersion).toBe(1);
    expect(committed.algorithm).toBe('sha256');

    const actual = buildCorpusChecksums();
    expect(diffChecksums(committed.files, actual)).toEqual([]);
    // Stable format: regeneration must be a no-op (sorted keys, 2-space JSON).
    expect(readFileSync(CHECKSUMS_PATH, 'utf8')).toBe(serializeChecksums(actual));
  });

  it('covers every case directory with both its capture and its label', () => {
    const actual = buildCorpusChecksums();
    const caseDirs = new Set<string>();
    for (const relPath of Object.keys(actual)) {
      if (relPath === 'manifest.json') continue;
      const parts = relPath.split('/');
      expect(parts, `unexpected corpus layout: ${relPath}`).toHaveLength(2);
      caseDirs.add(parts[0]!);
    }
    expect(caseDirs.size).toBeGreaterThan(0);
    for (const caseDir of caseDirs) {
      expect(actual[`${caseDir}/page.html`], `${caseDir} capture is not checksummed`).toBeDefined();
      expect(actual[`${caseDir}/expected.json`], `${caseDir} label is not checksummed`).toBeDefined();
    }
  });

  it('reports content drift as a failure (the silently-edited-label scenario)', () => {
    const actual = buildCorpusChecksums();
    const firstLabel = Object.keys(actual)
      .find((relPath) => relPath.endsWith('expected.json'))!;
    const tampered = {
      ...actual,
      [firstLabel]: { ...actual[firstLabel]!, sha256: '0'.repeat(64) },
    };
    const drift = diffChecksums(tampered, actual);
    expect(drift).toEqual([`content drift: ${firstLabel}`]);
  });

  it('never hashes CHECKSUMS.json itself (self-exclusion)', () => {
    const actual = buildCorpusChecksums();
    expect(actual['CHECKSUMS.json']).toBeUndefined();
    expect(CORPUS_DIR).toBe(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'corpus'));
  });
});
