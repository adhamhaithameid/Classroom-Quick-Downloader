/**
 * Reads labelled cases off disk. Deliberately strict: a malformed case is a
 * thrown error, not a skipped case. A silently skipped case is a regression
 * test that stops testing without telling anyone.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ExpectedCase, LoadedCase } from './types';

export const CORPUS_DIR = resolve(process.cwd(), 'tests/accuracy/corpus');

function assertShape(caseId: string, parsed: ExpectedCase): void {
  if (parsed.caseId !== caseId) {
    throw new Error(`corpus: ${caseId}/expected.json declares caseId "${parsed.caseId}"`);
  }
  if (!parsed.note?.trim()) {
    throw new Error(`corpus: ${caseId} has no note — say why this case exists`);
  }
  if (!Array.isArray(parsed.posts) || parsed.posts.length === 0) {
    throw new Error(`corpus: ${caseId} labels no posts`);
  }
  const ids = new Set<string>();
  for (const post of parsed.posts) {
    if (ids.has(post.postId)) {
      throw new Error(`corpus: ${caseId} labels postId "${post.postId}" twice`);
    }
    ids.add(post.postId);
  }
}

export function loadCorpus(): LoadedCase[] {
  const entries = readdirSync(CORPUS_DIR)
    .filter((name) => statSync(join(CORPUS_DIR, name)).isDirectory())
    .sort();

  return entries.map((caseId) => {
    const dir = join(CORPUS_DIR, caseId);
    const expected = JSON.parse(
      readFileSync(join(dir, 'expected.json'), 'utf8'),
    ) as ExpectedCase;
    assertShape(caseId, expected);
    return { expected, html: readFileSync(join(dir, 'page.html'), 'utf8') };
  });
}
