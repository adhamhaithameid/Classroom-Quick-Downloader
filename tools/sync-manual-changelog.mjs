#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manualDir = resolve(root, 'manual/changelog');
const websiteManualPath = resolve(manualDir, 'website-changelog.manual.md');
const extensionManualPath = resolve(manualDir, 'extension-changelog.manual.md');
const pillRulesPath = resolve(manualDir, 'extension-pill-rules.manual.json');
const releaseVersionPath = resolve(manualDir, 'release-version.manual.json');

function readText(filePath) {
  return readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n');
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function trim(value) {
  return String(value || '').trim();
}

function parseManualMarkdown(markdown) {
  const lines = markdown.split('\n');
  const entries = [];
  let current = null;
  let section = '';

  const pushCurrent = () => {
    if (!current) return;
    const version = trim(current.version).replace(/^v/i, '');
    if (!version) return;
    current.version = version;
    current.summary = trim(current.summary);
    current.added = current.added.filter(Boolean);
    current.changed = current.changed.filter(Boolean);
    current.fixed = current.fixed.filter(Boolean);
    current.highlights = [...current.added, ...current.changed, ...current.fixed];
    current.changes = [
      ...(current.summary ? [`Summary: ${current.summary}`] : []),
      ...current.added.map((item) => `Added: ${item}`),
      ...current.changed.map((item) => `Changed: ${item}`),
      ...current.fixed.map((item) => `Fixed: ${item}`),
    ];
    entries.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const versionMatch = line.match(/^##\s+v?([0-9]+(?:\.[0-9]+){1,3})\s*$/i);
    if (versionMatch) {
      pushCurrent();
      current = {
        id: '',
        version: versionMatch[1],
        title: '',
        summary: '',
        added: [],
        changed: [],
        fixed: [],
        highlights: [],
        changes: [],
      };
      section = '';
      continue;
    }

    if (!current) continue;

    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch) {
      section = trim(sectionMatch[1]).toLowerCase();
      continue;
    }

    const bulletMatch = rawLine.match(/^\s*-\s+(.+)$/);
    if (bulletMatch) {
      const bullet = trim(bulletMatch[1]);
      if (!bullet) continue;
      if (section === 'added') current.added.push(bullet);
      else if (section === 'changed') current.changed.push(bullet);
      else if (section === 'fixed') current.fixed.push(bullet);
      else {
        if (!current.summary) current.summary = bullet;
        else current.changed.push(bullet);
      }
      continue;
    }

    if (section === 'summary') {
      current.summary = current.summary ? `${current.summary} ${line}`.trim() : line;
      continue;
    }

    if (section === 'title') {
      current.title = current.title ? `${current.title} ${line}`.trim() : line;
      continue;
    }
  }

  pushCurrent();

  const now = Date.now();
  return entries.map((entry, idx) => {
    const version = trim(entry.version).replace(/^v/i, '');
    return {
      ...entry,
      id: `manual-${version.replace(/[^0-9.]/g, '')}-${idx + 1}`,
      version,
      date: new Date(now - idx * 86_400_000).toISOString(),
      releasedAtUtc: now - idx * 86_400_000,
      title: entry.title || `Release ${version}`,
    };
  });
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function writeJson(filePath, payload) {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeTsConst(filePath, constName, payload) {
  const body = [
    '/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. */',
    `export const ${constName} = ${JSON.stringify(payload, null, 2)} as const;`,
    '',
  ].join('\n');
  writeFileSync(filePath, body, 'utf8');
}

function main() {
  const websiteEntries = parseManualMarkdown(readText(websiteManualPath));
  const extensionEntries = parseManualMarkdown(readText(extensionManualPath));
  const pillRules = readJson(pillRulesPath);
  const releaseVersion = readJson(releaseVersionPath);

  const generatedAt = Date.now();

  const websiteOut = {
    generatedAt,
    source: 'manual',
    entries: websiteEntries.map((entry) => ({
      id: entry.id,
      version: entry.version,
      title: entry.title,
      summary: entry.summary || '',
      highlights: entry.highlights,
      added: entry.added,
      changed: entry.changed,
      fixed: entry.fixed,
      releasedAtUtc: entry.releasedAtUtc,
    })),
  };

  const extensionOut = {
    schemaVersion: '1',
    ok: true,
    source: 'manual',
    entries: extensionEntries.map((entry) => ({
      id: entry.id,
      version: entry.version,
      date: entry.date,
      summary: entry.summary || '',
      changes: entry.changes,
      added: entry.added,
      changed: entry.changed,
      fixed: entry.fixed,
      isImportant: ['1.3.7', '1.3.8'].includes(entry.version),
    })),
    config: {
      rules: Array.isArray(pillRules.rules) ? pillRules.rules : [],
      lastUpdated: generatedAt,
    },
    meta: {
      applyMode: 'manual',
      liveUpdatedAt: generatedAt,
      contentChecksum: `manual-${generatedAt}`,
    },
  };

  const websiteOutDir = resolve(root, 'website/src/lib/content');
  const extensionOutDir = resolve(root, 'extension/entrypoints/utils');
  ensureDir(websiteOutDir);
  ensureDir(extensionOutDir);

  writeJson(resolve(websiteOutDir, 'changelog.manual.generated.json'), websiteOut);
  writeTsConst(resolve(websiteOutDir, 'changelog.manual.generated.ts'), 'WEBSITE_MANUAL_CHANGELOG', websiteOut);
  writeJson(resolve(websiteOutDir, 'release-version.manual.generated.json'), {
    generatedAt,
    ...releaseVersion,
  });
  writeTsConst(
    resolve(websiteOutDir, 'release-version.manual.generated.ts'),
    'WEBSITE_MANUAL_RELEASE_VERSION',
    {
      generatedAt,
      ...releaseVersion,
    },
  );
  writeJson(resolve(extensionOutDir, 'manual-changelog.generated.json'), extensionOut);
  writeTsConst(resolve(extensionOutDir, 'manual-changelog.generated.ts'), 'EXTENSION_MANUAL_CHANGELOG', extensionOut);
}

main();
