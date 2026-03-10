#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const SOURCES = [
  'extension/entrypoints/content/state.ts',
  'extension/entrypoints/content/tab-detector.ts',
  'extension/entrypoints/content/smart-detector-comments.ts',
  'extension/entrypoints/content/smart-detector.ts',
  'extension/entrypoints/download_all.content.ts',
];

const STRING_PATTERNS = [
  /`([^`\n]+)`/g,
  /'([^'\n]+)'/g,
  /"([^"\n]+)"/g,
];

const URL_PATTERN = /\/(?:c|w|r|u|g)\/\[\^?[^ \n]*|\/(?:c|w|r|u|g)\/\[\^?[^ \n]*/g;

function normalizeSelector(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function isLikelySelector(value) {
  if (!value) return false;
  if (value.startsWith('./') || value.startsWith('../')) return false;
  if (value.includes('${')) return false;
  if (value.includes('http://') || value.includes('https://')) return false;
  if (value.includes('Date.now') || value.includes('Math.random')) return false;
  if (value.includes('Found "') || value.startsWith('Layer')) return false;
  if (value.includes('visibility ===') || value.includes('&&') || value.includes('||')) return false;
  if (value.includes('classroom.google.com') || value.includes('drive.google.com') || value.includes('docs.google.com')) return false;
  if (value.length < 3) return false;
  if (/^(button|div|span|input|textarea|script|noscript|style)$/.test(value)) return true;
  if (/^(high|medium|low|none|true|false|stream|classwork|grades|people|unknown|hidden|click|title|role|aria-label)$/.test(value)) return false;
  return /^(?:\*|[a-zA-Z][a-zA-Z0-9_-]*)?(?:[.#\[:])|^\[/.test(value);
}

function selectorRisk(selector) {
  if (selector.includes('data-') || selector.startsWith('[data-')) return 'low';
  if (selector.includes('aria-') || selector.includes('[role=')) return 'low';
  if (selector.includes('jscontroller') || selector.includes('jsaction') || selector.includes('jsname')) return 'medium';
  if (selector.includes('.')) return 'high';
  return 'medium';
}

function riskEmoji(risk) {
  if (risk === 'low') return '🟢';
  if (risk === 'medium') return '🟡';
  return '🔴';
}

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function extractSelectors(text) {
  const results = [];
  for (const pattern of STRING_PATTERNS) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = normalizeSelector(match[1]);
      if (!value) continue;
      const parts = value.split(',').map(normalizeSelector).filter(Boolean);
      for (const part of parts) {
        if (isLikelySelector(part)) results.push(part);
      }
    }
  }
  return uniqueSorted(results);
}

function extractUrlRegexes(text) {
  const regexes = [];
  const pattern = /\/\\\/[^/\n]+\/[gimuy]*/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    regexes.push(match[0]);
  }
  return uniqueSorted(regexes);
}

function buildFileSection(relPath) {
  const absPath = path.join(ROOT, relPath);
  const text = fs.readFileSync(absPath, 'utf8');
  const selectors = extractSelectors(text);
  const regexes = extractUrlRegexes(text);

  const lines = [];
  lines.push(`## ${relPath}`);
  lines.push('');

  if (regexes.length > 0) {
    lines.push('### URL / regex patterns');
    lines.push('');
    lines.push('| Pattern |');
    lines.push('|---------|');
    for (const regex of regexes) {
      lines.push(`| \`${regex.replace(/\|/g, '\\|')}\` |`);
    }
    lines.push('');
  }

  lines.push('### Selectors');
  lines.push('');
  lines.push('| Selector | Risk |');
  lines.push('|----------|------|');
  for (const selector of selectors) {
    const risk = selectorRisk(selector);
    lines.push(`| \`${selector.replace(/\|/g, '\\|')}\` | ${riskEmoji(risk)} ${risk} |`);
  }
  lines.push('');

  return lines.join('\n');
}

function main() {
  const outputArg = process.argv.indexOf('--output');
  const outputPath = outputArg !== -1
    ? process.argv[outputArg + 1]
    : path.join(ROOT, 'verification/baseline', new Date().toISOString().slice(0, 10), 'selector-catalog.md');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const lines = [];
  lines.push(`# CQD Selector Catalog — ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('This file is generated from the current extension source files that drive legacy download and flag behavior.');
  lines.push('');
  lines.push('Purpose:');
  lines.push('');
  lines.push('1. freeze the current selector surface before deeper refactors,');
  lines.push('2. show where class-selector risk remains high,');
  lines.push('3. support Phase 0 baseline review and V2 migration work.');
  lines.push('');

  for (const relPath of SOURCES) {
    lines.push(buildFileSection(relPath));
  }

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Generated selector catalog: ${outputPath}`);
}

main();
