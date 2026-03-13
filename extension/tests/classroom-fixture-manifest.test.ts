import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type FixtureManifestEntry = {
  file: string;
  bytes: number;
  sha256: string;
};

type FixtureManifest = {
  manifestVersion: number;
  generatedAtUtc: string;
  generatedBy: string;
  source: {
    acquisition: string;
    pullRequest?: string;
    branch?: string;
    commit?: string;
    baselineReference?: string;
  };
  fixtures: FixtureManifestEntry[];
};

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

describe('classroom fixture manifest integrity', () => {
  const fixturesDir = resolve(process.cwd(), 'tests/fixtures/classroom');
  const manifestPath = resolve(fixturesDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FixtureManifest;

  it('lists every classroom fixture file exactly once', () => {
    const fixtureFiles = readdirSync(fixturesDir)
      .filter((name) => name.endsWith('.html'))
      .sort((a, b) => a.localeCompare(b));

    const manifestFiles = manifest.fixtures
      .map((entry) => entry.file)
      .sort((a, b) => a.localeCompare(b));

    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.source.acquisition).toBe('github-pr-history');
    expect(manifestFiles).toEqual(fixtureFiles);
  });

  it('matches byte-size and sha256 for each fixture', () => {
    for (const entry of manifest.fixtures) {
      const fixtureData = readFileSync(resolve(fixturesDir, entry.file));
      expect(entry.bytes).toBe(fixtureData.byteLength);
      expect(entry.sha256).toBe(sha256(fixtureData));
    }
  });
});
