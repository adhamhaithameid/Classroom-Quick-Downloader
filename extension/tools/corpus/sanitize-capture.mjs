#!/usr/bin/env node
/**
 * Sanitizes a raw capture (from capture-bookmarklet.js) into corpus case
 * directories. Deterministic and conservative: anything not explicitly kept
 * is dropped or replaced.
 *
 * Usage: node tools/corpus/sanitize-capture.mjs <capture.json> <caseId> <viewKind> <lang>
 * Output: tests/accuracy/corpus/<caseId>/{page.html,expected.json}
 * expected.json posts are emitted with all-false labels — A HUMAN MUST LABEL
 * THEM BEFORE THE CASE IS USED. The loader rejects an empty note, so the case
 * cannot silently pass review.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [rawPath, caseId, viewKind, lang] = process.argv.slice(2);
if (!rawPath || !caseId || !viewKind || !lang) {
  console.error('usage: node sanitize-capture.mjs <capture.json> <caseId> <viewKind> <lang>');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(caseId)) {
  console.error(`caseId "${caseId}" must match /^[a-z0-9-]+$/`);
  process.exit(1);
}

const raw = JSON.parse(readFileSync(resolve(rawPath), 'utf8'));

/** Replace identity/contact leakage while keeping DOM structure intact. */
function scrub(html) {
  return html
    .replace(/https?:\/\/(lh\d|drive|doc)\.google\.com\/[^"'\s>]+/g, 'https://DRIVE_PLACEHOLDER')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'EMAIL_REDACTED')
    .replace(/\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, 'ID_REDACTED')
    .replace(/\sdata-[^=]*="[^"]{200,}"/g, ' data-long-attr-redacted="1"');
}

const pages = raw.captures.map((c) => scrub(c.html)).join('\n');
const outDir = resolve(process.cwd(), `tests/accuracy/corpus/${caseId}`);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'page.html'), pages);
writeFileSync(
  join(outDir, 'expected.json'),
  JSON.stringify(
    {
      caseId,
      viewKind,
      lang,
      note: 'UNLABELLED CAPTURE — label me by hand before trusting this case.',
      origin: 'capture',
      capturedOn: raw.capturedOn,
      posts: raw.captures.map((c) => ({
        postId: c.postId,
        commentPresent: false,
        commentCount: null,
        editedPresent: false,
      })),
    },
    null,
    2,
  ) + '\n',
);
console.log(`${caseId}: ${raw.captures.length} cards -> ${outDir}`);
console.log('WARNING: labels are placeholders; edit expected.json by hand.');
