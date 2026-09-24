#!/usr/bin/env node
// filepath: tools/capture-classroom-post-strings.mjs
/**
 * ============================================================================
 * POST-LEVEL LANGUAGE CAPTURE — real localized Classroom post strings
 * ============================================================================
 *
 * Complements tools/capture-classroom-languages.mjs (page-level) with the
 * strings the DETECTION ENGINE actually matches on, captured from a real
 * seeded post:
 *
 *   - "Posted <date>" line           (date/time format, month names when old)
 *   - "(Edited)" / "(Edited <date>)" marker
 *   - "Add class comment" placeholder + aria
 *   - comment-count chip text + aria ("1 class comment" style)
 *   - Stream/Classwork tab labels
 *
 * SETUP (idempotent, runs once per invocation against the seeded class):
 *   1. verify the seeded announcement exists in CQD Lang Test (delete me)
 *   2. add ONE class comment if the post has none ("CQD test comment")
 *   3. edit the announcement once if not already edited (appends " [e]")
 * SWEEP (resumable):
 *   for every served language, load the class stream ?hl=<lang> and dump the
 *   full page collector (texts + aria-labels) into
 *   qa-artifacts/live-languages/post-strings/<lang>.json
 *
 * SAFETY: writes only inside the throwaway class. The second page visited
 * per language (old-post date formats) is READ-ONLY on a real enrolled class.
 *
 * Usage:
 *   node tools/capture-classroom-post-strings.mjs            # setup + sweep
 *   node tools/capture-classroom-post-strings.mjs --langs de,fr,ar
 *   node tools/capture-classroom-post-strings.mjs --setup-only
 *   node tools/capture-classroom-post-strings.mjs --force    # re-sweep all
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXTENSION_PATH = path.join(REPO_ROOT, 'extension/.output/chrome-mv3');
const PROFILE_DIR = path.join(REPO_ROOT, 'tests/e2e/.live-profile');
const OUT_ROOT = path.join(REPO_ROOT, 'qa-artifacts/live-languages/post-strings');

// Throwaway class created for this capture (delete when done).
const TEST_CLASS_ID = 'ODg2MTA0NjcyMDI1';
const STREAM_URL = (hl) => `https://classroom.google.com/u/0/c/${TEST_CLASS_ID}?hl=${hl}`;
// Old-post date formats: read-only sweep of a real enrolled class stream.
const OLD_POST_CLASS_ID = process.env.CQD_OLD_POST_CLASS_ID ?? 'ODQ0NzM4NDEwMjY5';
const OLD_POST_URL = (hl) => `https://classroom.google.com/u/0/c/${OLD_POST_CLASS_ID}?hl=${hl}`;

const ANNOUNCEMENT_TEXT = 'Language capture post CQD';
const COMMENT_TEXT = 'CQD test comment';

// Languages Classroom actually serves (from tests/classroom-locale-survey.json,
// 2026-09-19): served docLang is a real locale, not an en-US/fr/... fallback.
const SERVED_LANGS = [
  'en', 'ar', 'ja', 'es', 'es-419', 'hi', 'pt-BR', 'pt-PT', 'zh-CN', 'zh-TW',
  'fr', 'de', 'it', 'ru', 'ko', 'tr', 'vi', 'id', 'th', 'pl', 'nl', 'bn',
  'pa', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'uk', 'el', 'cs', 'ro',
  'hu', 'sv', 'da', 'fi', 'no', 'iw', 'fa', 'fil', 'ms', 'sr', 'sk', 'bg',
  'hr', 'lt', 'lv', 'et', 'sl', 'ca', 'af', 'hy', 'as', 'az', 'eu', 'my',
  'ka', 'is', 'ga', 'kk', 'mk', 'mn', 'ne', 'or', 'si', 'sw', 'uz', 'cy',
  'sq',
];

const IN_PAGE_COLLECTOR = () => {
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);
  const texts = new Set();
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const el = node.parentElement;
      if (!el || skip.has(el.tagName)) return NodeFilter.FILTER_REJECT;
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
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
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) texts.add(text);
  }
  const aria = new Set();
  for (const el of document.querySelectorAll('[aria-label]')) {
    const label = (el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (label && label.length <= 200) aria.add(label);
    if (aria.size >= 300) break;
  }
  const posts = [...document.querySelectorAll('li[data-stream-item-id]')].map((li) => ({
    id: li.getAttribute('data-stream-item-id'),
    text: (li.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    aria: [...li.querySelectorAll('[aria-label]')].map((e) => (e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()).slice(0, 15),
  }));
  return {
    htmlLang: document.documentElement.lang || '',
    title: document.title,
    texts: [...texts],
    ariaLabels: [...aria],
    posts,
  };
};

function parseArgs(argv) {
  const args = { langs: null, force: false, setupOnly: false, sweepOnly: false, settleMs: 6000, retries: 4 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--langs') args.langs = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--setup-only') args.setupOnly = true;
    else if (argv[i] === '--sweep-only') args.sweepOnly = true;
    else if (argv[i] === '--settle') args.settleMs = Number(argv[++i]) || args.settleMs;
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

function outFile(lang) {
  const safe = path.basename(`${lang}.json`);
  const target = path.resolve(path.join(OUT_ROOT), safe);
  if (!target.startsWith(path.resolve(OUT_ROOT) + path.sep)) throw new Error(`output path escaped root: ${target}`);
  return target;
}

function clickAt(page, handle) {
  return handle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };
    const t = document.elementFromPoint(cx, cy) || el;
    t.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, isPrimary: true }));
    t.dispatchEvent(new MouseEvent('mousedown', opts));
    t.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, isPrimary: true }));
    t.dispatchEvent(new MouseEvent('mouseup', opts));
    t.dispatchEvent(new MouseEvent('click', opts));
  });
}

async function gotoStreamSettled(page, url, { settleMs, retries }, needle = ANNOUNCEMENT_TEXT) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(settleMs);
    const loaded = await page.evaluate((n) => ({
      postVisible: (document.body.innerText || '').includes(n),
      hasComposer: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('New announcement')),
    }), needle);
    if (loaded.postVisible) return loaded;
    console.log(`    attempt ${attempt}/${retries}: post not rendered, retrying after cooldown`);
    await page.waitForTimeout(8_000 * attempt);
  }
  return { postVisible: false, failed: true };
}

/** The seeded announcement's container (whatever element wraps the post text). */
async function findAnnouncement(page) {
  const needle = ANNOUNCEMENT_TEXT;
  return page.evaluate((n) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode()) !== null) {
      if ((node.textContent || '').includes(n)) {
        let el = node.parentElement;
        // Walk up to a container that also holds the action row (comment/menu).
        let container = el;
        while (container && container !== document.body) {
          const hasActions = container.querySelector('[aria-label="Add comment"], [aria-label*="comment" i]');
          if (hasActions && (container.textContent || '').length < 2000) break;
          container = container.parentElement;
        }
        const root = container || el;
        return [{
          found: true,
          text: (root.textContent || '').replace(/\s+/g, ' ').slice(0, 500),
          edited: /\(edited\)/i.test(root.textContent || ''),
          aria: [...root.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).slice(0, 15),
        }];
      }
    }
    return [{ found: false }];
  }, needle ?? ANNOUNCEMENT_TEXT);
}

async function addCommentIfNeeded(page, log) {
  const hasComment = await page.evaluate((c) => (document.body.innerText || '').includes(c), COMMENT_TEXT);
  if (hasComment) {
    log('    comment already present');
    return false;
  }
  // Open the composer (either the collapsed "Add comment" affordance or the
  // always-visible "Add class comment…" editable).
  const openBtn = page.locator('[aria-label="Add comment"]').first();
  if ((await openBtn.count()) > 0) {
    await clickAt(page, openBtn);
    await page.waitForTimeout(3_000);
  }
  const ed = page.locator('[aria-label="Add class comment…"]').first();
  if ((await ed.count()) === 0) {
    log('    no comment composer visible');
    return false;
  }
  await ed.click({ timeoutMs: 8_000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.keyboard.type(COMMENT_TEXT, { delay: 30 });
  await page.waitForTimeout(1_000);
  const postBtn = page.locator('button[aria-label="Post"]:not([disabled])').first();
  if ((await postBtn.count()) === 0) {
    log('    Post button did not appear');
    return false;
  }
  await clickAt(page, postBtn);
  await page.waitForTimeout(5_000);
  const done = await page.evaluate((c) => (document.body.innerText || '').includes(c), COMMENT_TEXT);
  return done;
}

async function editAnnouncementIfNeeded(page, log) {
  const state = await page.evaluate(() => ({
    edited: /\[e\]/.test(document.body.innerText || ''),
    menuAria: [...document.querySelectorAll('button')]
      .map((b) => b.getAttribute('aria-label') || '')
      .find((a) => a.startsWith('Announcement options for')),
  }));
  if (state.edited) {
    log('    already edited');
    return false;
  }
  if (!state.menuAria) {
    log('    no announcement options button');
    return false;
  }
  const more = page.locator(`button[aria-label="${state.menuAria.replace(/"/g, '\\"')}"]`).first();
  await clickAt(page, more);
  await page.waitForTimeout(2_000);
  const edit = page.locator('[role="menu"] [role="menuitem"]:has-text("Edit"), [role="menu"] li:has-text("Edit")').first();
  if ((await edit.count()) === 0) {
    await page.keyboard.press('Escape');
    log('    no Edit menuitem');
    return false;
  }
  await clickAt(page, edit);
  await page.waitForTimeout(5_000);
  const saved = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const ed = dlg?.querySelector('[contenteditable="true"]');
    if (!ed) return { err: 'no editor' };
    ed.focus();
    document.execCommand('selectAll');
    document.execCommand('insertText', false, 'Language capture post CQD [e]');
    return new Promise((res) => setTimeout(() => {
      const save = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Save');
      if (!save) return res({ err: 'no save button' });
      const r = save.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };
      const t = document.elementFromPoint(cx, cy) || save;
      t.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, isPrimary: true }));
      t.dispatchEvent(new MouseEvent('mousedown', opts));
      t.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, isPrimary: true }));
      t.dispatchEvent(new MouseEvent('mouseup', opts));
      t.dispatchEvent(new MouseEvent('click', opts));
      setTimeout(() => res({ saved: !document.querySelector('[role="dialog"]') }), 4_000);
    }, 800));
  });
  return Boolean(saved.saved);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node tools/capture-classroom-post-strings.mjs [--langs de,fr] [--force] [--setup-only] [--sweep-only]');
    process.exit(0);
  }
  if (!fs.existsSync(path.join(PROFILE_DIR, 'Default'))) {
    console.error('No live profile. Run `pnpm test:live:login` first (one manual Google sign-in).');
    process.exit(1);
  }
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: process.env.LIVE_CHANNEL ?? 'chromium',
    headless: true,
    timeout: 120_000,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const langs = args.langs ?? SERVED_LANGS;
  const log = (m) => console.log(m);

  try {
    if (!args.sweepOnly) {
      log('== SETUP: seed comment + edited marker ==');
      const loaded = await gotoStreamSettled(page, STREAM_URL('en'), args);
      if (loaded.failed) throw new Error('test class stream never loaded');
      log('  stream loaded (post visible)');
      const added = await addCommentIfNeeded(page, log);
      log(`  comment: ${added ? 'added' : 'already present/skipped'}`);
      await page.waitForTimeout(2_000);
      const edited = await editAnnouncementIfNeeded(page, log);
      log(`  edited marker: ${edited ? 'created' : 'already present/skipped'}`);
    }

    if (args.setupOnly) {
      await context.close().catch(() => {});
      return;
    }

    log(`\n== SWEEP: ${langs.length} languages ==`);
    for (const lang of langs) {
      const dest = outFile(lang);
      if (!args.force && fs.existsSync(dest)) {
        log(`  ${lang}: exists, skip (--force to redo)`);
        continue;
      }
      try {
        const data = await gotoStreamSettled(page, STREAM_URL(lang), args);
        const collected = await page.evaluate(IN_PAGE_COLLECTOR);
        // Old-post date formats (read-only, real class) — best effort, no gate.
        let oldPost = null;
        try {
          await page.goto(OLD_POST_URL(lang), { waitUntil: 'domcontentloaded', timeout: 60_000 });
          await page.waitForTimeout(args.settleMs);
          oldPost = await page.evaluate(IN_PAGE_COLLECTOR);
        } catch {
          // date-format capture is optional
        }
        fs.writeFileSync(dest, `${JSON.stringify({ lang, capturedAt: new Date().toISOString(), stream: collected, oldPost }, null, 1)}\n`);
        log(`  ${lang}: htmlLang=${collected.htmlLang} posts=${collected.posts.length}${oldPost ? ' (+old)' : ''}`);
      } catch (e) {
        log(`  ${lang}: FAILED ${String(e?.message ?? e).slice(0, 100)}`);
        fs.writeFileSync(dest, `${JSON.stringify({ lang, error: String(e?.message ?? e) }, null, 1)}\n`);
      }
    }
    log('\nDone. Analyze with a reconcile script (bead: post-string capture).');
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`post-string capture failed: ${error?.message ?? error}`);
  process.exit(1);
});
