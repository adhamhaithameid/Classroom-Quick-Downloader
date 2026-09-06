#!/usr/bin/env node
/** Rebuilds tests/accuracy/corpus/manifest.json from the cases on disk. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'tests/accuracy/corpus');
const entries = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => {
    const expected = JSON.parse(readFileSync(join(ROOT, d.name, 'expected.json'), 'utf8'));
    return {
      caseId: d.name,
      origin: expected.origin ?? 'unspecified',
      lang: expected.lang,
      viewKind: expected.viewKind,
      posts: expected.posts.length,
    };
  })
  .sort((a, b) => a.caseId.localeCompare(b.caseId));

const langs = [...new Set(entries.map((e) => e.lang))].sort();
const manifest = {
  generatedOn: new Date().toISOString().slice(0, 10),
  totals: { cases: entries.length, locales: langs.length, languages: langs },
  cases: entries,
};
writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest: ${entries.length} cases, ${langs.length} locales (${langs.join(', ')})`);
