#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const LOG_DELIM = '\x1f';

const CATEGORY_ORDER = [
  'Security',
  'Added',
  'Fixed',
  'Changed',
  'Performance',
  'Refactor',
  'Tests',
  'Docs',
  'CI',
  'Chore',
  'Merge',
];

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 256,
  }).trimEnd();
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function escapeInline(value) {
  return String(value).replace(/`/g, '\\`');
}

function code(value) {
  return `\`${escapeInline(value)}\``;
}

function formatDateRange(commits) {
  if (!commits.length) return 'n/a';
  const start = commits[0].date;
  const end = commits[commits.length - 1].date;
  return start === end ? start : `${start} -> ${end}`;
}

function commitComponents(files) {
  const components = new Set();
  for (const file of files) {
    if (file.startsWith('extension/')) components.add('Extension');
    if (file.startsWith('cloudflare-worker/')) components.add('Cloudflare Worker');
    if (file.startsWith('oracle-backend/')) components.add('Oracle Backend');
    if (file.startsWith('tools/')) components.add('Tools');
    if (file.startsWith('.github/workflows/')) components.add('CI');
    if (file.startsWith('docs/') || file.endsWith('.md')) components.add('Docs');
    if (
      file === 'package.json' ||
      file === 'pnpm-lock.yaml' ||
      file.endsWith('/package.json') ||
      file.endsWith('/go.mod') ||
      file.endsWith('/go.sum')
    ) {
      components.add('Dependencies');
    }
  }
  if (!components.size) components.add('Repository');
  return Array.from(components).sort();
}

function classifyCommit(subject, files) {
  const s = subject.toLowerCase();
  const hasTestFile = files.some(
    (f) =>
      f.includes('/tests/') ||
      f.endsWith('.test.ts') ||
      f.endsWith('.test.tsx') ||
      f.endsWith('_test.go')
  );
  const onlyDocs = files.length > 0 && files.every((f) => f.startsWith('docs/') || f.endsWith('.md'));
  const touchesCI = files.some((f) => f.startsWith('.github/workflows/'));

  if (/\b(security|cve|vuln|vulnerability|hardening|xss|csrf|auth\b)/.test(s)) return 'Security';
  if (/^(feat|feature)(\(|:|\b)/.test(s) || /\b(add|introduce|implement)\b/.test(s)) return 'Added';
  if (/^(fix|bugfix|hotfix)(\(|:|\b)/.test(s) || /\b(regression|bug|broken|crash)\b/.test(s)) return 'Fixed';
  if (/^(perf)(\(|:|\b)/.test(s) || /\b(optimi[sz]e|faster|speed)\b/.test(s)) return 'Performance';
  if (/^(refactor)(\(|:|\b)/.test(s)) return 'Refactor';
  if (/^(test)(\(|:|\b)/.test(s) || hasTestFile) return 'Tests';
  if (/^(docs?)(\(|:|\b)/.test(s) || onlyDocs) return 'Docs';
  if (/^(ci)(\(|:|\b)/.test(s) || touchesCI) return 'CI';
  if (/^(chore|build|deps)(\(|:|\b)/.test(s) || /\bbump\b/.test(s)) return 'Chore';
  if (/^merge(\b|:)/.test(s)) return 'Merge';
  return 'Changed';
}

function parseCommitLog() {
  const raw = run(
    "git log --reverse --date=short --pretty=format:'@@@%H%x1f%ad%x1f%an%x1f%s' --name-only"
  );

  const commits = [];
  let current = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith('@@@')) {
      if (current) commits.push(current);
      const payload = line.slice(3);
      const [hash, date, author, subject] = payload.split(LOG_DELIM);
      current = {
        hash,
        shortHash: hash.slice(0, 7),
        date,
        author,
        subject,
        files: [],
      };
      continue;
    }

    if (!current) continue;
    const file = line.trim();
    if (file) current.files.push(file);
  }

  if (current) commits.push(current);

  for (const commit of commits) {
    commit.components = commitComponents(commit.files);
    commit.category = classifyCommit(commit.subject, commit.files);
  }

  return commits;
}

function parseVersionMarkers(commits) {
  const commitsByHash = new Map(commits.map((c, idx) => [c.hash, { ...c, index: idx }]));
  const history = run('git log --follow --reverse --format=%H -- extension/package.json')
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);

  const markers = [];
  let previousVersion = null;

  for (const hash of history) {
    const commitRef = commitsByHash.get(hash);
    if (!commitRef) continue;

    let version = null;
    try {
      const content = run(`git show ${shellQuote(`${hash}:extension/package.json`)}`);
      version = JSON.parse(content).version;
    } catch {
      continue;
    }

    if (!version || version === previousVersion) continue;
    markers.push({
      hash,
      index: commitRef.index,
      date: commitRef.date,
      version,
    });
    previousVersion = version;
  }

  if (!markers.length) {
    throw new Error('No version markers found in extension/package.json history.');
  }

  return markers;
}

function parseTags(commits) {
  const commitsByHash = new Map(commits.map((c, idx) => [c.hash, idx]));
  const names = run('git tag --list --sort=creatordate')
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);

  const tags = [];
  for (const name of names) {
    const commitHash = run(`git rev-list -n 1 ${shellQuote(name)}`).trim();
    const idx = commitsByHash.get(commitHash);
    if (idx == null) continue;
    const [date, subject] = run(
      `git log -1 --date=short --format=%ad%x1f%s ${shellQuote(name)}`
    ).split(LOG_DELIM);
    tags.push({ name, commitHash, index: idx, date, subject: subject || '' });
  }

  return tags;
}

function buildReleaseWindows(commits, markers) {
  const windows = [];

  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const next = markers[i + 1] || null;

    const startIndex = i === 0 ? 0 : marker.index;
    const endIndex = next ? next.index - 1 : marker.index;

    if (endIndex < startIndex) continue;

    windows.push({
      version: marker.version,
      markerHash: marker.hash,
      markerDate: marker.date,
      startIndex,
      endIndex,
      commits: commits.slice(startIndex, endIndex + 1),
    });
  }

  const lastMarker = markers[markers.length - 1];
  const unreleasedStart = lastMarker.index + 1;
  const unreleasedCommits = unreleasedStart <= commits.length - 1
    ? commits.slice(unreleasedStart)
    : [];

  return { windows, unreleasedCommits };
}

function renderReleaseSection(title, commits, tags, extra = {}) {
  const lines = [];
  lines.push(`## ${title}`);
  lines.push('');

  if (!commits.length) {
    lines.push('- No changes recorded in this window.');
    lines.push('');
    return lines;
  }

  const categoryBuckets = new Map(CATEGORY_ORDER.map((k) => [k, []]));
  const componentCounts = new Map();

  for (const commit of commits) {
    if (!categoryBuckets.has(commit.category)) categoryBuckets.set(commit.category, []);
    categoryBuckets.get(commit.category).push(commit);

    for (const component of commit.components) {
      componentCounts.set(component, (componentCounts.get(component) || 0) + 1);
    }
  }

  const categoriesUsed = CATEGORY_ORDER.filter((cat) => (categoryBuckets.get(cat) || []).length > 0);
  const topComponents = [...componentCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([name, count]) => `${name} (${count})`)
    .join(', ');

  lines.push('### Summary');
  lines.push(`- Window: ${code(formatDateRange(commits))}`);
  lines.push(`- Commits: ${code(commits.length)}`);
  lines.push(`- Authors: ${code(new Set(commits.map((c) => c.author)).size)}`);
  lines.push(`- Categories: ${categoriesUsed.map((c) => code(c)).join(', ')}`);
  lines.push(`- Dominant Components: ${topComponents || 'Repository'}`);
  if (extra.markerHash) {
    lines.push(`- Version Marker Commit: ${code(extra.markerHash.slice(0, 7))} (${extra.markerDate || 'n/a'})`);
  }
  lines.push('');

  if (tags.length) {
    lines.push('### Tag Milestones');
    for (const tag of tags) {
      lines.push(`- ${code(tag.name)} (${tag.date}) -> ${code(tag.commitHash.slice(0, 7))} ${escapeInline(tag.subject)}`);
    }
    lines.push('');
  }

  lines.push('### Detailed Changes By Category');
  for (const category of CATEGORY_ORDER) {
    const bucket = categoryBuckets.get(category) || [];
    if (!bucket.length) continue;

    lines.push(`#### ${category}`);
    for (const commit of bucket) {
      const components = commit.components.join(', ');
      const fileCount = commit.files.length;
      const filePreview = fileCount
        ? commit.files.slice(0, 5).map((f) => code(f)).join(', ') + (fileCount > 5 ? ', ...' : '')
        : 'No file list';
      lines.push(
        `- ${code(commit.shortHash)} (${commit.date}) ${escapeInline(commit.subject)} | author: ${escapeInline(commit.author)} | components: ${components} | files: ${fileCount} (${filePreview})`
      );
    }
    lines.push('');
  }

  lines.push('### Exhaustive Commit Ledger');
  for (const commit of commits) {
    const components = commit.components.join(', ');
    const files = commit.files.length
      ? commit.files.map((f) => code(f)).join(', ')
      : 'No file list';
    lines.push(
      `- ${code(commit.shortHash)} | ${commit.date} | ${escapeInline(commit.author)} | ${escapeInline(commit.subject)} | category: ${commit.category} | components: ${components} | files: ${files}`
    );
  }
  lines.push('');

  return lines;
}

function main() {
  const commits = parseCommitLog();
  const markers = parseVersionMarkers(commits);
  const tags = parseTags(commits);
  const { windows, unreleasedCommits } = buildReleaseWindows(commits, markers);

  const commitsByHash = new Map(commits.map((c, idx) => [c.hash, idx]));

  const lines = [];
  lines.push('# Changelog');
  lines.push('');
  lines.push('This changelog is comprehensive and auto-generated from repository history.');
  lines.push('It includes every commit from project inception and groups release windows by extension version markers starting at `0.0.0`.');
  lines.push('');
  lines.push('## Scope');
  lines.push(`- Total commits indexed: ${code(commits.length)}`);
  lines.push(`- First commit: ${code(commits[0].shortHash)} (${commits[0].date}) ${escapeInline(commits[0].subject)}`);
  lines.push(`- Latest commit: ${code(commits[commits.length - 1].shortHash)} (${commits[commits.length - 1].date}) ${escapeInline(commits[commits.length - 1].subject)}`);
  lines.push(`- Total release markers: ${code(windows.length)}`);
  lines.push(`- Total tags indexed: ${code(tags.length)}`);
  lines.push('');

  lines.push('## Table of Contents');
  lines.push('- [Unreleased](#unreleased)');
  for (const window of windows.slice().reverse()) {
    const anchor = `[${window.version}](#${window.version.replace(/\./g, '')}-${window.markerDate.replace(/-/g, '')})`;
    lines.push(`- ${anchor}`);
  }
  lines.push('');

  const unreleasedTags = tags.filter((tag) => {
    if (!windows.length) return false;
    const index = commitsByHash.get(tag.commitHash);
    return index != null && index > windows[windows.length - 1].endIndex;
  });

  lines.push(...renderReleaseSection('[Unreleased]', unreleasedCommits, unreleasedTags));

  for (const window of windows.slice().reverse()) {
    const sectionTags = tags.filter((tag) => {
      const idx = commitsByHash.get(tag.commitHash);
      return idx != null && idx >= window.startIndex && idx <= window.endIndex;
    });

    lines.push(
      ...renderReleaseSection(
        `[${window.version}] - ${window.markerDate}`,
        window.commits,
        sectionTags,
        { markerHash: window.markerHash, markerDate: window.markerDate }
      )
    );
  }

  writeFileSync('CHANGELOG.md', `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write(`Generated CHANGELOG.md with ${commits.length} commits across ${windows.length} release markers.\n`);
}

main();
