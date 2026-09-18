#!/usr/bin/env node
// Production smoke test for the CQD website — run any time, especially right
// after a deploy (see docs/RELEASE_SEQUENCE_V160.md).
//
//   node tools/verify-production.mjs
//   BASE_URL=https://classroom-quick-downloader.adhamhaithameid.is-a.dev node tools/verify-production.mjs
//
// Exit 0 = all checks passed; exit 1 = one or more failures (printed below).

import { readFileSync } from 'node:fs';

const BASE = (process.env.BASE_URL ?? 'https://classroom-quick-downloader.adhamhaithameid.is-a.dev').replace(/\/+$/, '');
const CANONICAL_HOST = 'classroom-quick-downloader.adhamhaithameid.is-a.dev';

const failures = [];
const checks = [];

async function check(name, run) {
  try {
    const detail = await run();
    checks.push(`  ok  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures.push(`FAIL  ${name} — ${error.message}`);
  }
}

async function fetchOk(path, expect = 200) {
  const response = await fetch(`${BASE}${path}`, { redirect: 'follow' });
  if (response.status !== expect) {
    throw new Error(`HTTP ${response.status} (expected ${expect})`);
  }
  return response.text();
}

function expectContains(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label} missing "${needle}"`);
}

// 1) SEO endpoints
await check('robots.txt serves + references sitemap', async () => {
  const body = await fetchOk('/robots.txt');
  expectContains(body, `Sitemap: ${BASE}/sitemap.xml`, 'robots');
  expectContains(body, 'GPTBot', 'AI crawler allows');
});
await check('sitemap.xml has 22 canonical URLs, no legacy domain', async () => {
  const body = await fetchOk('/sitemap.xml');
  const urls = (body.match(/<loc>/g) ?? []).length;
  if (urls !== 22) throw new Error(`expected 22 URLs, got ${urls}`);
  if (body.includes('pages.dev')) throw new Error('legacy domain leaked into sitemap');
});
await check('llms.txt states source-available license + version + support', async () => {
  const body = await fetchOk('/llms.txt');
  expectContains(body, 'source-available', 'license wording');
  expectContains(body, 'PolyForm Noncommercial', 'license name');
  expectContains(body, 'adhamhaithameid@gmail.com', 'support contact');
  if (/open.?source/i.test(body)) throw new Error('false open-source claim present');
});
await check('indexnow key file serves', async () => {
  const body = await fetchOk('/indexnow-key.txt');
  if (body.trim().length < 16) throw new Error('key missing or too short');
});

// 2) Key pages: status, canonical host, accuracy markers.
// Bylines only exist on guide-template pages (SeoContentPage), not on the
// custom privacy/faq/changelog pages.
const pages = [
  ['/', 'Classroom Quick Downloader', false],
  ['/security', 'Requested Permissions, Line By Line', true],
  ['/privacy', 'Browser permissions explained', false],
  ['/download-all-attachments-google-classroom', 'Maintained by Adham Haitham', true],
  ['/install/chrome', 'Install CQD For Chrome', true],
  ['/faq', 'Frequently Asked Questions', false],
  ['/changelog', 'Changelog', false],
];
for (const [path, marker, expectByline] of pages) {
  await check(`page ${path} serves with expected content`, async () => {
    const body = await fetchOk(path);
    expectContains(body, marker, 'content marker');
    expectContains(body, `https://${CANONICAL_HOST}`, 'canonical host');
    if (expectByline) expectContains(body, 'Maintained by', 'guide byline');
    if (/<meta name="robots" content="noindex/.test(body)) throw new Error('unexpected noindex');
  });
}

// 3) Structured data parses on the homepage + flagship
for (const path of ['/', '/download-all-attachments-google-classroom']) {
  await check(`JSON-LD parses on ${path}`, async () => {
    const body = await fetchOk(path);
    const blocks = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (blocks.length === 0) throw new Error('no JSON-LD blocks');
    for (const block of blocks) JSON.parse(block[1]);
    if (path === '/' && !body.includes('"@type":"SoftwareApplication"')) throw new Error('SoftwareApplication missing');
    if (path !== '/' && !body.includes('"@type":"TechArticle"')) throw new Error('TechArticle missing');
  });
}

// 4) 404 + legacy host behavior
await check('unknown route returns 404', async () => {
  const response = await fetch(`${BASE}/definitely-not-a-page-${Date.now()}`);
  if (response.status !== 404) throw new Error(`HTTP ${response.status}`);
});
await check('legacy Pages host redirects to canonical', async () => {
  const response = await fetch('https://classroom-quick-downloader-website.pages.dev/', { redirect: 'manual' });
  if (response.status !== 301) throw new Error(`HTTP ${response.status}, expected 301`);
  const location = response.headers.get('location') ?? '';
  if (!location.includes(CANONICAL_HOST)) throw new Error(`redirect target ${location}`);
});

// 5) Infrastructure (informational failures do not block the website verdicts above)
await check('worker /health reachable', async () => {
  const base = process.env.WORKER_BASE_URL ?? 'https://cqd-analytics.adhamhaithameid.workers.dev';
  const response = await fetch(`${base}/health`);
  if (response.status === 429) throw new Error('HTTP 429 error 1027 — free-plan daily cap consumed (see ORACLE_RECOVERY_RUNBOOK.md)');
  if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
});
await check('oracle /health reachable', async () => {
  const base = process.env.ORACLE_BASE_URL ?? 'https://oracle.classroom-quick-downloader.com';
  const response = await fetch(`${base}/health`);
  if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
});

console.log(`Production smoke — ${BASE}`);
for (const line of checks) console.log(line);
if (failures.length > 0) {
  console.error('');
  for (const line of failures) console.error(line);
  console.error(`\n${failures.length} check(s) failed. If the failures are the worker/oracle infra checks only, the website itself is fine — see docs/ORACLE_RECOVERY_RUNBOOK.md.`);
  process.exit(1);
}
console.log('\nAll production checks passed.');
