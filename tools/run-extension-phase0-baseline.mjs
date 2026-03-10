#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const TODAY = new Date().toISOString().slice(0, 10);
const baselineDir = path.join(ROOT, 'verification', 'baseline', TODAY);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
  return result;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(relPath, content) {
  const absPath = path.join(ROOT, relPath);
  ensureDir(path.dirname(absPath));
  fs.writeFileSync(absPath, content, 'utf8');
}

function buildIssuesSchema() {
  return JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'cqd-phase0-baseline-issues',
    type: 'object',
    properties: {
      captureDate: { type: 'string', format: 'date' },
      extensionVersion: { type: 'string' },
      browserVersion: { type: 'string' },
      testResults: {
        type: 'object',
        properties: {
          totalFiles: { type: 'integer' },
          totalTests: { type: 'integer' },
          passed: { type: 'integer' },
          failed: { type: 'integer' },
          duration: { type: 'string' },
        },
      },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            page: {
              type: 'string',
              enum: [
                'stream',
                'classwork_list',
                'classwork_topic',
                'assignment_details',
                'material_details',
                'student_submissions',
                'student_work_teacher',
                'announcement_detail',
              ],
            },
            url: { type: 'string' },
            issue_type: {
              type: 'string',
              enum: [
                'missing_button',
                'duplicate_button',
                'wrong_placement',
                'false_positive_flag',
                'false_negative_flag',
                'wrong_count',
                'styling',
                'performance',
                'crash',
                'other',
              ],
            },
            selector: { type: 'string' },
            screenshot_ref: { type: 'string' },
            expected: { type: 'string' },
            actual: { type: 'string' },
            severity: { type: 'string', enum: ['critical', 'major', 'minor', 'cosmetic'] },
            language: { type: 'string' },
            account_type: { type: 'string', enum: ['single', 'dual', 'multi', 'restricted'] },
            reproducible: { type: 'boolean' },
            notes: { type: 'string' },
          },
          required: ['id', 'page', 'issue_type', 'expected', 'actual', 'severity'],
        },
      },
    },
    required: ['captureDate', 'extensionVersion', 'issues'],
  }, null, 2);
}

function buildIssuesData(testResults) {
  return JSON.stringify({
    captureDate: TODAY,
    extensionVersion: readExtensionVersion(),
    browserVersion: 'pending manual capture',
    testResults,
    issues: [
      {
        id: 'KNOWN-001',
        page: 'student_submissions',
        issue_type: 'missing_button',
        expected: 'Download buttons on student-uploaded files',
        actual: 'No buttons rendered because the student submissions surface is still a known coverage gap.',
        severity: 'major',
        reproducible: true,
        notes: 'Tracked by extension/docs/student-work-api-plan.md and refactor-plan.md.',
      },
      {
        id: 'KNOWN-002',
        page: 'student_work_teacher',
        issue_type: 'missing_button',
        expected: 'Download buttons on all student submissions in teacher view.',
        actual: 'No buttons rendered because the teacher student-work surface is still a known coverage gap.',
        severity: 'major',
        reproducible: true,
        notes: 'Tracked by extension/docs/student-work-api-plan.md and refactor-plan.md.',
      },
      {
        id: 'KNOWN-003',
        page: 'assignment_details',
        issue_type: 'missing_button',
        expected: 'Download buttons on all attached files.',
        actual: 'Partial coverage remains for some attachment types in details views.',
        severity: 'minor',
        reproducible: true,
        notes: 'Use this as the pre-refactor reference point.',
      },
      {
        id: 'KNOWN-004',
        page: 'stream',
        issue_type: 'performance',
        expected: 'A single shared observation pipeline for extension runtime behavior.',
        actual: 'Legacy runtime still contains multiple independent observer-driven feature paths.',
        severity: 'major',
        reproducible: true,
        notes: 'Primary architectural reason to complete the V2 migration.',
      },
      {
        id: 'KNOWN-005',
        page: 'stream',
        issue_type: 'false_positive_flag',
        expected: 'No comment badge on posts without comments.',
        actual: 'Action-area text and nearby controls can still contribute to comment false positives in edge cases.',
        severity: 'minor',
        reproducible: true,
        notes: 'Unified exclusion engine and V2 flag scoring should reduce this.',
      },
    ],
  }, null, 2);
}

function readExtensionVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/package.json'), 'utf8'));
  return pkg.version;
}

function parseVitestSummary(output) {
  const filesMatch = output.match(/Test Files\s+(\d+)\s+passed/);
  const testsMatch = output.match(/Tests\s+(\d+)\s+passed/);
  const durationMatch = output.match(/Duration\s+([^\n]+)/);
  return {
    totalFiles: filesMatch ? Number(filesMatch[1]) : 0,
    totalTests: testsMatch ? Number(testsMatch[1]) : 0,
    passed: testsMatch ? Number(testsMatch[1]) : 0,
    failed: output.includes('failed') && !testsMatch ? 1 : 0,
    duration: durationMatch ? durationMatch[1].trim() : 'unknown',
  };
}

function buildChecklist() {
  return `# Manual Testing Checklist — Phase 0 Baseline (${TODAY})

> Complete this checklist by visiting each page type with the extension loaded in dev mode.
> Save screenshots to \`verification/baseline/${TODAY}/screenshots/\`.

## Setup

- [ ] Load extension: \`pnpm -C extension dev\`
- [ ] Open Google Classroom with test account
- [ ] Open DevTools Console (filter for "CQD")
- [ ] If using live capture, run \`node tools/run-extension-phase0-baseline.mjs --with-live-capture --profile "<chrome-profile-dir>"\`

## Manual Classroom Matrix

### Single Google Account (en, ar, es)

- [ ] Stream: buttons, flags, no duplicates, Download All, RTL check
- [ ] Classwork list: expanded/collapsed behavior, header placement, count accuracy
- [ ] Topic classwork: buttons and badges on always-expanded items
- [ ] Assignment details: all files visible, record partial coverage gaps
- [ ] Material details: all files visible
- [ ] Student submissions: document expected missing-button gap and DOM shape
- [ ] Teacher student-work: document expected missing-button gap and DOM shape
- [ ] Announcement detail: attachment buttons and flags render correctly

### Multi-account scenarios

- [ ] Single account
- [ ] Dual account with authuser switching
- [ ] Three-account scenario
- [ ] Restricted school account where possible

### Theme and layout

- [ ] Light mode
- [ ] Dark mode
- [ ] Mid-session theme switch
- [ ] RTL layout

### Performance observations

- [ ] No visible scroll jank
- [ ] No runaway observer churn
- [ ] No CQD console errors
- [ ] Memory stays acceptable during page navigation

## Screenshots to save

For each relevant page:

1. full page,
2. button close-up,
3. flag close-up,
4. console evidence if abnormal.
`;
}

function buildReadme() {
  return `# Extension Phase 0 Baseline — ${TODAY}

This directory is the reproducible Phase 0 baseline package for the extension refactor.

Generated by:

\`\`\`bash
node tools/run-extension-phase0-baseline.mjs
\`\`\`

Contents:

1. \`issues.schema.json\` — issue catalog schema,
2. \`issues.json\` — current known baseline issues,
3. \`manual-testing-checklist.md\` — live verification checklist,
4. \`selector-catalog.md\` — generated selector inventory from current legacy files,
5. \`test-results.txt\` — extension test baseline,
6. \`snapshots/\` — live capture output from Google Classroom when available,
7. \`screenshots/\` — manual evidence screenshots.

What is automated here:

1. extension test baseline,
2. selector catalog generation,
3. dated baseline scaffolding,
4. issue schema/data generation.

What still requires live user context:

1. real Google Classroom snapshots,
2. real manual page verification,
3. multi-account and school-restricted validation.
`;
}

function maybeRunLiveCapture() {
  const withCapture = process.argv.includes('--with-live-capture');
  const profileIdx = process.argv.indexOf('--profile');
  if (!withCapture) return;
  if (profileIdx === -1 || !process.argv[profileIdx + 1]) {
    console.error('Live capture requested but --profile was not provided.');
    process.exit(1);
  }
  const profile = process.argv[profileIdx + 1];
  const result = run('npx', ['tsx', 'tools/capture-classroom-snapshot.ts', '--profile', profile, '--output', baselineDir], {
    env: { ...process.env },
  });
  fs.writeFileSync(path.join(baselineDir, 'live-capture.log'), `${result.stdout}\n${result.stderr}`, 'utf8');
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.status ?? 1);
  }
}

function main() {
  ensureDir(baselineDir);
  ensureDir(path.join(baselineDir, 'snapshots'));
  ensureDir(path.join(baselineDir, 'screenshots'));
  ensureDir(path.join(ROOT, 'extension/tests/fixtures/classroom'));

  const testRun = run('pnpm', ['-C', 'extension', 'test']);
  fs.writeFileSync(path.join(baselineDir, 'test-results.txt'), `${testRun.stdout}\n${testRun.stderr}`, 'utf8');
  if (testRun.status !== 0) {
    console.error(testRun.stdout);
    console.error(testRun.stderr);
    process.exit(testRun.status ?? 1);
  }

  const selectorCatalogRun = run('node', ['tools/generate-selector-catalog.mjs', '--output', path.join('verification', 'baseline', TODAY, 'selector-catalog.md')]);
  if (selectorCatalogRun.status !== 0) {
    console.error(selectorCatalogRun.stdout);
    console.error(selectorCatalogRun.stderr);
    process.exit(selectorCatalogRun.status ?? 1);
  }

  const testResults = parseVitestSummary(testRun.stdout + '\n' + testRun.stderr);
  writeFile(path.join('verification', 'baseline', TODAY, 'issues.schema.json'), buildIssuesSchema());
  writeFile(path.join('verification', 'baseline', TODAY, 'issues.json'), buildIssuesData(testResults));
  writeFile(path.join('verification', 'baseline', TODAY, 'manual-testing-checklist.md'), buildChecklist());
  writeFile(path.join('verification', 'baseline', TODAY, 'README.md'), buildReadme());
  writeFile(path.join('extension/tests/fixtures/classroom', 'README.md'), `# Classroom HTML Fixtures\n\nThis directory stores sanitized Classroom HTML fixtures generated from live snapshots.\n\nGenerate a sanitized fixture with:\n\n\`\`\`bash\nnpx tsx tools/extract-fixture.ts verification/baseline/${TODAY}/snapshots/<page-type>/snapshot.html --output extension/tests/fixtures/classroom --page-type <page-type> --lang <lang>\n\`\`\`\n`);

  maybeRunLiveCapture();

  console.log(`Phase 0 baseline ready: ${path.join('verification', 'baseline', TODAY)}`);
}

main();
