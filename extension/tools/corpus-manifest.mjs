// filepath: extension/tools/corpus-manifest.mjs
/**
 * corpus-manifest.mjs — sha256 checksum manifest for the accuracy corpus.
 *
 * ADR-0008 ("What 100% accurate means", New obligations): "Corpus integrity is
 * checksummed ... so a silently edited label is a build failure." Hand-labelled
 * `expected.json` files ARE the ground truth for gate C1; nothing else in the
 * repo protects them from silent edits.
 *
 * What gets hashed, relative to `tests/accuracy/corpus/`:
 *   - `<case>/page.html`     sanitized capture
 *   - `<case>/expected.json` hand label (the ground truth)
 *   - `manifest.json`        corpus index
 * `CHECKSUMS.json` itself is never hashed (self-exclusion) and any other file
 * in the tree is reported as uncovered so a new case cannot skip labelling.
 *
 * Output (stable, deterministic — no timestamps, sorted keys, 2-space JSON +
 * trailing newline) is written to `tests/accuracy/corpus/CHECKSUMS.json`.
 * Regeneration is only expected to change when the corpus legitimately
 * changes; an edit to any hashed file without regenerating fails `--check`,
 * the corpus-checksums unit test, and the CI accuracy gate.
 *
 * Usage:
 *   node tools/corpus-manifest.mjs          # (re)generate CHECKSUMS.json
 *   node tools/corpus-manifest.mjs --check  # verify; exit 1 on drift, write nothing
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = path.resolve(__dirname, '..');

export const CORPUS_DIR = path.join(EXTENSION_ROOT, 'tests', 'accuracy', 'corpus');
export const CHECKSUMS_PATH = path.join(CORPUS_DIR, 'CHECKSUMS.json');

/** Corpus files whose content is integrity-pinned (ADR-0008 C1 ground truth). */
const HASHED_FILES = new Set(['page.html', 'expected.json', 'manifest.json']);

/** Sorted, POSIX-separated relative corpus paths -> { sha256, bytes }. */
export function buildCorpusChecksums(corpusDir = CORPUS_DIR) {
  if (!existsSync(corpusDir)) {
    throw new Error(`corpus-manifest: corpus directory not found: ${corpusDir}`);
  }
  const files = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const absPath = path.join(dir, entry);
      const stats = statSync(absPath);
      if (stats.isDirectory()) {
        walk(absPath);
        continue;
      }
      if (!HASHED_FILES.has(entry)) continue;
      const relPath = path.relative(corpusDir, absPath).split(path.sep).join('/');
      const content = readFileSync(absPath);
      files[relPath] = {
        sha256: createHash('sha256').update(content).digest('hex'),
        bytes: content.byteLength,
      };
    }
  };
  walk(corpusDir);
  const sorted = {};
  for (const relPath of Object.keys(files).sort()) sorted[relPath] = files[relPath];
  return sorted;
}

/** Serialize the checksum manifest exactly as it is written to disk. */
export function serializeChecksums(files) {
  return `${JSON.stringify(
    {
      manifestVersion: 1,
      algorithm: 'sha256',
      generator: 'extension/tools/corpus-manifest.mjs',
      files,
    },
    null,
    2,
  )}\n`;
}

/** Compare the committed manifest against a fresh walk. Returns drift lines. */
export function diffChecksums(committedFiles, actualFiles) {
  const drift = [];
  for (const relPath of Object.keys(committedFiles)) {
    const actual = actualFiles[relPath];
    if (!actual) {
      drift.push(`missing from corpus: ${relPath}`);
      continue;
    }
    if (committedFiles[relPath].sha256 !== actual.sha256) {
      drift.push(`content drift: ${relPath}`);
    }
  }
  for (const relPath of Object.keys(actualFiles)) {
    if (!committedFiles[relPath]) {
      drift.push(`not covered by CHECKSUMS.json: ${relPath} — run "pnpm -C extension run corpus:manifest"`);
    }
  }
  return drift;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const actual = buildCorpusChecksums();

  if (checkOnly) {
    if (!existsSync(CHECKSUMS_PATH)) {
      console.error('corpus-manifest: CHECKSUMS.json is missing — run "pnpm -C extension run corpus:manifest".');
      process.exitCode = 1;
      return;
    }
    const committed = JSON.parse(readFileSync(CHECKSUMS_PATH, 'utf8')).files;
    const drift = diffChecksums(committed, actual);
    if (drift.length > 0) {
      console.error(`Accuracy corpus checksum drift detected (${drift.length} issue(s)) — ADR-0008: a silently edited label is a build failure:`);
      for (const line of drift) console.error(`  - ${line}`);
      console.error('If the corpus change is intentional, re-label in the same PR and run "pnpm -C extension run corpus:manifest".');
      process.exitCode = 1;
      return;
    }
    console.log(`Accuracy corpus checksums verified (${Object.keys(actual).length} files).`);
    return;
  }

  writeFileSync(CHECKSUMS_PATH, serializeChecksums(actual), 'utf8');
  console.log(`Wrote ${CHECKSUMS_PATH} (${Object.keys(actual).length} files checksummed).`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main();
}
