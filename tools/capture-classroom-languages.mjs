#!/usr/bin/env node
// filepath: tools/capture-classroom-languages.mjs
/**
 * ============================================================================
 * LANGUAGE CAPTURE — real localized Classroom strings, one language at a time
 * ============================================================================
 *
 * Builds the per-language corpus that verifies the detection engine's keyword
 * lists (extension/entrypoints/content/detection-keywords.ts). For each
 * candidate language it renders the REAL classroom.google.com UI and collects
 * every visible text + aria-label into qa-artifacts/live-languages/corpus/
 * <lang>.json. The reconcile audit then checks the engine's lists against
 * that ground truth (pnpm test:live:langs:audit).
 *
 * Language switching — empirical, in this order:
 *   1. `?hl=<code>` URL parameter. Probed FIRST by rendering the home page in
 *      German and reading <html lang>. If Classroom honors it (most Google
 *      surfaces do), capture never touches account settings and is fully
 *      reversible by construction.
 *   2. If the probe fails, exit 2 — account-language automation
 *      (myaccount.google.com/language) is a separate, deliberate step
 *      (bead under Classroom-Quick-Downloader-6jv) because it WRITES to
 *      account settings.
 *
 * SAFETY: read-only navigation on the dedicated signed-in profile
 * (tests/e2e/.live-profile, same login as `pnpm test:live:login`). Resumable:
 * existing corpus files are skipped unless --force.
 *
 * Usage:
 *   pnpm test:live:langs                     # all candidates (resumable)
 *   node tools/capture-classroom-languages.mjs --langs de,fr,ar --max 3
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXTENSION_PATH = path.join(REPO_ROOT, 'extension/.output/chrome-mv3');
// Keep in sync with tests/e2e/live/live-harness.ts PROFILE_DIR.
const PROFILE_DIR = path.join(REPO_ROOT, 'tests/e2e/.live-profile');
const CORPUS_ROOT = path.join(REPO_ROOT, 'qa-artifacts/live-languages');
const AUTHUSER = Number(process.env.LIVE_CAPTURE_AUTHUSER ?? '0');

// NOTE: keep in sync with SUPPORTED_LANGUAGES in
// extension/entrypoints/content/detection-keywords.ts (this is the real
// Google-product superset; the per-language probe below is the empirical
// filter — a code Classroom refuses is recorded, not captured).
const CANDIDATE_LANGUAGES = [
  'en', 'ar', 'es', 'fr', 'de', 'pt', 'pt-BR', 'it', 'ru', 'ja', 'ko', 'zh-CN', 'zh-TW', 'zh-HK',
  'nl', 'pl', 'sv', 'da', 'no', 'nn', 'fi', 'cs', 'sk', 'hu', 'ro', 'bg', 'uk', 'be',
  'sr', 'hr', 'bs', 'sl', 'mk', 'sq', 'el', 'tr', 'az', 'ka', 'hy',
  'lv', 'lt', 'et', 'is', 'mt', 'ga', 'cy', 'eu', 'gl', 'ca', 'af',
  'vi', 'th', 'lo', 'km', 'my', 'id', 'ms', 'tl', 'jv', 'su', 'ceb',
  'hi', 'bn', 'pa', 'gu', 'or', 'ta', 'te', 'kn', 'ml', 'si', 'ne', 'mr',
  'he', 'fa', 'ur', 'ps', 'sd', 'sw', 'am', 'ha', 'yo', 'ig', 'zu', 'xh', 'mg',
  'kk', 'ky', 'uz', 'tk', 'tg', 'mn', 'eo', 'la', 'yi',
];

// Mirrors tests/e2e/live/lang-corpus.mjs IN_PAGE_COLLECTOR_SOURCE.
const IN_PAGE_COLLECTOR = `
  () => {
    const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);
    const texts = new Set();
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const el = node.parentElement;
        if (!el || skip.has(el.tagName)) return NodeFilter.FILTER_REJECT;
        const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!text || text.length > 200) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(el);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode()) !== null && texts.size < 500) {
      const text = (node.textContent || '').replace(/\\s+/g, ' ').trim();
      if (text) texts.add(text);
    }
    const aria = new Set();
    for (const el of document.querySelectorAll('[aria-label]')) {
      const label = (el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim();
      if (label && label.length <= 200) aria.add(label);
      if (aria.size >= 300) break;
    }
    return {
      htmlLang: document.documentElement.lang || '',
      texts: [...texts],
      ariaLabels: [...aria],
    };
  }
`;

function parseArgs(argv) {
  const args = { langs: null, max: null, force: false, settleMs: 3_500 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--langs') args.langs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === '--max') args.max = Number(argv[++i]) || null;
    else if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--settle') args.settleMs = Number(argv[++i]) || args.settleMs;
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

function corpusFile(lang) {
  const safeName = path.basename(`${lang}.json`);
  const target = path.resolve(path.join(CORPUS_ROOT, 'corpus'), safeName);
  const boundary = path.resolve(path.join(CORPUS_ROOT, 'corpus')) + path.sep;
  if (!target.startsWith(boundary)) throw new Error(`corpus path escaped root: ${target}`);
  return target;
}

const primary = (code) => String(code).toLowerCase().split('-')[0];

async function collectPage(context, url, { settleMs, screenshotDir, shotName }) {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(settleMs);
  const collected = await page.evaluate(IN_PAGE_COLLECTOR);
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, `${shotName}.png`), fullPage: false }).catch(() => {});
  }
  return { url: page.url(), ...collected };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node tools/capture-classroom-languages.mjs [--langs de,fr] [--max 5] [--force] [--settle 3500]');
    process.exit(0);
  }
  if (!fs.existsSync(PROFILE_DIR)) {
    console.error('No live profile. Run `pnpm test:live:login` first (one manual Google sign-in).');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: process.env.LIVE_CHANNEL ?? 'chromium',
    headless: process.env.E2E_HEADED !== '1',
    timeout: 120_000,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--hide-crash-restore-bubble',
    ],
  });
  const base = `https://classroom.google.com/u/${AUTHUSER}`;

  // Pre-flight: signed in?
  const probe = await collectPage(context, `${base}/h`, { settleMs: 5_000 });
  if (!probe.url.startsWith('https://classroom.google.com/')) {
    console.error(`Not signed in (landed on ${probe.url.slice(0, 90)}). Run \`pnpm test:live:login\`.`);
    await context.close().catch(() => {});
    process.exit(1);
  }

  // Discover the first class for stream/classwork/details surfaces.
  let classHref = null;
  {
    const page = context.pages()[0];
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && /\/c\/[A-Za-z0-9_-]+/.test(h)),
    );
    const first = hrefs.find(Boolean);
    if (first) {
      const id = /\/c\/([A-Za-z0-9_-]+)/.exec(first)?.[1];
      if (id) classHref = `/u/${AUTHUSER}/c/${id}`;
    }
  }
  if (!classHref) {
    console.error('No classes found on the account home — seed the sandbox class first (docs/LIVE_CLASSROOM_TESTING.md § seeding).');
    await context.close().catch(() => {});
    process.exit(1);
  }

  // Strategy probe: does Classroom honor ?hl= ?
  const probeDe = await collectPage(context, `${base}/h?hl=de`, { settleMs: 4_000 });
  const hlHonored = primary(probeDe.htmlLang) === 'de';
  console.log(`[langs] ?hl= probe: htmlLang="${probeDe.htmlLang}" → ${hlHonored ? 'HL mode (no account changes)' : 'NOT honored'}`);
  if (!hlHonored) {
    console.error('Classroom ignores ?hl= on this account — account-language automation (myaccount.google.com/language) is required. NOT built by design: it writes to account settings. Track bead Classroom-Quick-Downloader-6jv.');
    await context.close().catch(() => {});
    process.exit(2);
  }

  const screenshotDir = path.join(CORPUS_ROOT, 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });
  let langs = args.langs ?? CANDIDATE_LANGUAGES;
  if (args.max) langs = langs.slice(0, args.max);

  const manifestPath = path.join(CORPUS_ROOT, 'index.json');
  const manifest = {
    mode: 'hl-param',
    capturedAt: null,
    authuser: AUTHUSER,
    classHref,
    langs: {},
  };

  let captured = 0;
  let skippedHl = 0;
  try {
    for (const lang of langs) {
      const file = corpusFile(lang);
      if (!args.force && fs.existsSync(file)) {
        manifest.langs[lang] = { status: 'skipped-existing' };
        continue;
      }
      const hlParam = encodeURIComponent(lang);
      const home = await collectPage(context, `${base}/h?hl=${hlParam}`, { settleMs: args.settleMs });
      // Empirical filter: Classroom must actually render the language.
      if (primary(home.htmlLang) !== primary(lang)) {
        manifest.langs[lang] = { status: 'rejected', htmlLang: home.htmlLang };
        console.log(`[langs] ${lang}: rejected — Classroom rendered htmlLang="${home.htmlLang}"`);
        skippedHl += 1;
        continue;
      }

      const corpus = {
        lang,
        htmlLang: home.htmlLang,
        capturedAt: new Date().toISOString(),
        source: 'live',
        pages: { home },
      };

      // Stream.
      corpus.pages.stream = await collectPage(
        context,
        `https://classroom.google.com${classHref}?hl=${hlParam}`,
        { settleMs: args.settleMs, screenshotDir, shotName: `${lang}-stream` },
      );

      // Classwork.
      corpus.pages.classwork = await collectPage(
        context,
        `https://classroom.google.com${classHref}/w/all?hl=${hlParam}`,
        { settleMs: args.settleMs, screenshotDir, shotName: `${lang}-classwork` },
      );

      // First assignment details (attachment/due/points strings).
      const cwPage = context.pages()[0];
      const detailHref = await cwPage.evaluate(() => {
        const link = [...document.querySelectorAll('a[href]')]
          .map((a) => a.getAttribute('href'))
          .find((h) => h && /\/c\/[A-Za-z0-9_-]+\/a\/[A-Za-z0-9_-]+/.test(h ?? ''));
        return link;
      });
      if (detailHref) {
        corpus.pages.details = await collectPage(
          context,
          `https://classroom.google.com${detailHref}${detailHref.includes('?') ? '&' : '?'}hl=${hlParam}`,
          { settleMs: args.settleMs, screenshotDir, shotName: `${lang}-details` },
        );
      }

      fs.writeFileSync(file, `${JSON.stringify(corpus, null, 2)}\n`);
      manifest.langs[lang] = { status: 'captured', htmlLang: corpus.htmlLang, pages: Object.keys(corpus.pages) };
      captured += 1;
      console.log(`[langs] ${lang}: captured (${Object.keys(corpus.pages).join(', ')}, ${[...corpus.pages.home.texts, ...corpus.pages.home.ariaLabels].length} home strings)`);
      await new Promise((r) => setTimeout(r, 400)); // be gentle with the real product
    }
  } finally {
    manifest.capturedAt = new Date().toISOString();
    fs.mkdirSync(CORPUS_ROOT, { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await context.close().catch(() => {});
  }

  console.log(`\n[langs] done: ${captured} captured, ${skippedHl} rejected, ${Object.values(manifest.langs).filter((m) => m.status === 'skipped-existing').length} already present.`);
  console.log('Next: pnpm test:live:langs:audit  → engine keyword audit vs the captured strings');
}

main().catch((error) => {
  console.error(`language capture failed: ${error?.message ?? error}`);
  process.exit(1);
});
