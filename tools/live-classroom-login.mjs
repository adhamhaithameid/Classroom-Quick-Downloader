#!/usr/bin/env node
// filepath: tools/live-classroom-login.mjs
/**
 * ============================================================================
 * LIVE LOGIN — one-time manual Google sign-in into the dedicated test profile
 * ============================================================================
 *
 * Google blocks scripted logins ("This browser or app may not be secure"),
 * and Chrome 136+ refuses remote debugging on the default profile — so the
 * supported pattern (see docs/research/live-classroom-e2e-testing.md) is:
 *
 *   sign in ONCE, by hand, into a DEDICATED profile; every later test run
 *   reuses that profile's cookies headlessly.
 *
 * This tool opens a real, headed Chromium window on that profile
 * (tests/e2e/.live-profile, gitignored) with the built CQD extension loaded,
 * walks you through each account (default: u/0 AND u/1 — e.g. teacher + a
 * second account), and exits as soon as Classroom confirms each session.
 *
 * Usage:
 *   pnpm test:live:login
 *   node tools/live-classroom-login.mjs --authusers 0,1 --timeout 600
 *
 * Nothing you type here is scripted: the tool only WATCHES the URL until it
 * lands back on classroom.google.com, then moves on. The profile directory
 * holds the resulting session — never commit it, never point it at your
 * daily browser profile.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXTENSION_PATH = path.join(REPO_ROOT, 'extension/.output/chrome-mv3');
// Keep in sync with tests/e2e/live/live-harness.ts PROFILE_DIR.
const PROFILE_DIR = path.join(REPO_ROOT, 'tests/e2e/.live-profile');

function parseArgs(argv) {
  const args = { authusers: [0, 1], timeoutSec: 600 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--authusers') args.authusers = argv[++i].split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 0);
    else if (argv[i] === '--timeout') args.timeoutSec = Number(argv[++i]) || args.timeoutSec;
    else if (argv[i] === '--profile') args.profile = path.resolve(argv[++i]);
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

function ensureExtensionBuilt() {
  if (fs.existsSync(path.join(EXTENSION_PATH, 'manifest.json'))) return;
  console.log('🔨 Extension build not found — building chrome-mv3 first...');
  const result = spawnSync('pnpm', ['-C', 'extension', 'run', 'build'], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('extension build failed — run `pnpm build:ext` and retry');
  }
}

/** True when the page settled on a signed-in classroom.google.com URL. */
function isSignedInClassroom(url) {
  return url.startsWith('https://classroom.google.com/') && /\/u\/\d+/.test(url);
}

async function accountEmail(page) {
  return page
    .evaluate(() => {
      const el = document.querySelector(
        "a[aria-label*='Google Account'], div[aria-label*='Google Account'], img[aria-label*='@']",
      );
      return el ? el.getAttribute('aria-label') : null;
    })
    .then((label) => {
      const m = label ? /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(label) : null;
      return m ? m[1] : null;
    })
    .catch(() => null);
}

async function waitForSignIn(page, authuser, timeoutSec) {
  const deadline = Date.now() + timeoutSec * 1000;
  let lastUrl = '';
  while (Date.now() < deadline) {
    const url = page.url();
    if (!isSignedInClassroom(url)) {
      lastUrl = url;
      await page.waitForTimeout(2_000);
      continue;
    }
    // On Classroom: wait for the SPA to settle, then confirm it STAYS there
    // (Google sometimes interstitial-redirects a beat later).
    await page.waitForTimeout(4_000);
    const settledUrl = page.url();
    if (isSignedInClassroom(settledUrl)) return { ok: true, email: await accountEmail(page) };
    lastUrl = settledUrl;
    await page.waitForTimeout(1_000);
  }
  return { ok: false, email: null, lastUrl };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node tools/live-classroom-login.mjs [--authusers 0,1] [--timeout 600] [--profile <dir>]');
    process.exit(0);
  }
  if (args.authusers.length === 0) {
    console.error('No authusers configured (--authusers), nothing to sign in.');
    process.exit(1);
  }
  ensureExtensionBuilt();

  const profileDir = args.profile ?? PROFILE_DIR;
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('='.repeat(78));
  console.log('CQD LIVE TEST LOGIN — a real browser window is opening now.');
  console.log(`Profile: ${profileDir}  (dedicated; gitignored; NEVER your daily profile)`);
  console.log('');
  console.log('For each account below, sign in to Google in that window when prompted');
  console.log('(password / 2FA included — this is the one step automation must not do).');
  console.log('The tool detects the signed-in session automatically and moves on.');
  console.log('='.repeat(78));

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: process.env.LIVE_CHANNEL ?? 'chromium',
    headless: false, // login is inherently human + headed
    timeout: 120_000,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
    ],
  });
  const page = context.pages()[0] ?? (await context.newPage());

  const state = { checkedAt: null, accounts: {}, channel: process.env.LIVE_CHANNEL ?? 'chromium' };
  let allOk = true;

  for (const authuser of args.authusers) {
    const home = `https://classroom.google.com/u/${authuser}/h`;
    console.log(`\n▶ u/${authuser}: opening ${home}`);
    await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    if (args.authusers.length > 1) {
      console.log(`  If Google asks for account #${authuser + 1}, sign in with the ${authuser === 0 ? 'FIRST' : 'SECOND'} account now (use "Use another account" to add it).`);
    } else {
      console.log('  Sign in with your Google account now.');
    }
    const result = await waitForSignIn(page, authuser, args.timeoutSec);
    state.accounts[authuser] = { ok: result.ok, email: result.email, finalUrl: page.url() };
    if (result.ok) {
      console.log(`  ✅ u/${authuser} signed in${result.email ? ` (${result.email})` : ''}.`);
    } else {
      allOk = false;
      console.log(`  ❌ u/${authuser} not confirmed within ${args.timeoutSec}s (last: ${result.lastUrl ?? page.url()})`);
    }
  }

  state.checkedAt = new Date().toISOString();
  fs.writeFileSync(path.join(profileDir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
  console.log(`\nProfile state written: ${path.join(profileDir, 'state.json')}`);

  await context.close().catch(() => {});
  if (!allOk) {
    console.log('\nSome accounts did not complete. Re-run `pnpm test:live:login` — already-signed accounts will pass instantly.');
    process.exit(1);
  }
  console.log('\n✅ Live profile ready. Run your suites: pnpm test:live');
}

main().catch((error) => {
  console.error(`\nlive login failed: ${error?.message ?? error}`);
  process.exit(1);
});
