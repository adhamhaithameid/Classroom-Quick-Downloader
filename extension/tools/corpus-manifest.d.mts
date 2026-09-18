// filepath: extension/tools/corpus-manifest.d.mts
/**
 * Type declarations for corpus-manifest.mjs (see that file for full docs).
 * The tool is plain ESM JavaScript so it can run standalone via
 * `node tools/corpus-manifest.mjs`; this keeps its consumers typed.
 */

/** Absolute path to the accuracy corpus directory. */
export const CORPUS_DIR: string;

/** Absolute path to the checksum manifest (corpus/CHECKSUMS.json). */
export const CHECKSUMS_PATH: string;

/** One checksummed corpus file. */
export interface CorpusChecksum {
  sha256: string;
  bytes: number;
}

/** Walk the corpus and hash page.html/expected.json/manifest.json (sorted, POSIX paths). */
export function buildCorpusChecksums(corpusDir?: string): Record<string, CorpusChecksum>;

/** Serialize the checksum manifest exactly as it is written to disk. */
export function serializeChecksums(files: Record<string, CorpusChecksum>): string;

/** Compare the committed manifest against a fresh walk; returns drift descriptions. */
export function diffChecksums(
  committedFiles: Record<string, CorpusChecksum>,
  actualFiles: Record<string, CorpusChecksum>,
): string[];
