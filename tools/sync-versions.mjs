#!/usr/bin/env node
// Keeps data/changelog/release-version.manual.json in step with the per-workspace
// package.json files, which are the source of truth for component versions.
//
//   node tools/sync-versions.mjs           rewrite the manifest to match
//   node tools/sync-versions.mjs --check   exit 1 on drift, change nothing (CI gate)

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'data/changelog/release-version.manual.json');

// manifest key -> package.json that owns that version
const SOURCES = {
  extension: 'extension/package.json',
  cloudflareWorker: 'cloudflare-worker/package.json',
  oracleBackend: 'oracle-backend/package.json',
};

function readJSON(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function expectedManifest() {
  const out = {};
  for (const [key, pkgPath] of Object.entries(SOURCES)) {
    const version = readJSON(pkgPath).version;
    if (typeof version !== 'string' || version.length === 0) {
      throw new Error(`${pkgPath} has no usable "version" field`);
    }
    out[key] = version;
  }
  // The website label tracks the extension version — that is what users see.
  out.websiteLabel = `v${out.extension}`;
  return out;
}

function main() {
  const check = process.argv.includes('--check');
  const expected = expectedManifest();
  const current = readJSON(manifestPath);

  const drift = Object.entries(expected).filter(([k, v]) => current[k] !== v);

  if (drift.length === 0) {
    console.log('release-version.manual.json is in sync');
    return;
  }

  for (const [key, want] of drift) {
    console.log(`  ${key}: ${current[key] ?? '(missing)'} -> ${want}`);
  }

  if (check) {
    console.error(
      `\nrelease-version.manual.json is out of sync with ${drift.length === 1 ? 'its source' : 'its sources'}.` +
        '\nRun: pnpm run sync:versions'
    );
    process.exit(1);
  }

  writeFileSync(manifestPath, `${JSON.stringify({ ...current, ...expected }, null, 2)}\n`);
  console.log(`\nupdated ${drift.length} field(s) in release-version.manual.json`);
}

main();
