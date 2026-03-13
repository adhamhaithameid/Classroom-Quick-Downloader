#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const TOOLS_DIR = dirname(CURRENT_FILE);
const EXTENSION_DIR = resolve(TOOLS_DIR, '..');
const REPO_ROOT = resolve(EXTENSION_DIR, '..');
const FIXTURES_DIR = join(EXTENSION_DIR, 'tests', 'fixtures', 'classroom');
const MANIFEST_PATH = join(FIXTURES_DIR, 'manifest.json');

function getGitHeadSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function buildSourceMetadata() {
  const source = {
    acquisition: 'github-pr-history',
  };

  const pullRequest = process.env.FIXTURE_SOURCE_PR?.trim();
  const branch = process.env.FIXTURE_SOURCE_BRANCH?.trim();
  const commit = process.env.FIXTURE_SOURCE_COMMIT?.trim() || getGitHeadSha();
  const baselineReference = process.env.FIXTURE_BASELINE_REFERENCE?.trim();

  if (pullRequest) source.pullRequest = pullRequest;
  if (branch) source.branch = branch;
  if (commit) source.commit = commit;
  if (baselineReference) source.baselineReference = baselineReference;

  return source;
}

async function loadFixtureEntries() {
  const entries = await fs.readdir(FIXTURES_DIR, { withFileTypes: true });
  const fixtureFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const fixtures = [];
  for (const file of fixtureFiles) {
    const fullPath = join(FIXTURES_DIR, file);
    const data = await fs.readFile(fullPath);
    fixtures.push({
      file,
      bytes: data.byteLength,
      sha256: sha256(data),
    });
  }

  return fixtures;
}

async function main() {
  const fixtures = await loadFixtureEntries();
  const manifest = {
    manifestVersion: 1,
    generatedAtUtc: new Date().toISOString(),
    generatedBy: 'extension/tools/update-fixture-manifest.mjs',
    source: buildSourceMetadata(),
    fixtures,
  };

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`Updated fixture manifest: ${MANIFEST_PATH}`);
  console.log(`Fixture entries: ${fixtures.length}`);
}

main().catch((error) => {
  console.error('Failed to update fixture manifest.');
  console.error(String(error));
  process.exitCode = 1;
});
