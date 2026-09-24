// Empirical feasibility probe: can Playwright drive Arc / Chrome / Zen
// headless with the CQD extension loaded? Run: node tools/probe-browser-channels.mjs
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { chromium, firefox } from '@playwright/test';

const REPO = '/Users/adhamhaithameid/Desktop/code/Classroom-Quick-Downloader';
const CHROME_MV3 = path.join(REPO, 'extension/.output/chrome-mv3');
const FIREFOX_PROFILE = path.join(REPO, 'tests/e2e/.firefox-profile');
const ARC = '/Applications/Arc.app/Contents/MacOS/Arc';
const ZEN = '/Applications/Zen.app/Contents/MacOS/zen';

const chromiumArgs = (ext) => [
  `--disable-extensions-except=${ext}`,
  `--load-extension=${ext}`,
  '--no-first-run',
  '--disable-default-apps',
];

async function probeChromiumFamily(name, opts) {
  const label = `${name} (headless)`;
  try {
    const ctx = await Promise.race([
      chromium.launchPersistentContext('', { headless: true, ...opts }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('launch timeout 30s')), 30_000)),
    ]);
    let sw = ctx.serviceWorkers();
    if (sw.length === 0) {
      await ctx.waitForEvent('serviceworker', { timeout: 15_000 }).catch(() => {});
      sw = ctx.serviceWorkers();
    }
    const page = await ctx.newPage();
    await page.setContent('<button id="x">hi</button>');
    const title = await page.title();
    console.log(`✅ ${label}: launched, serviceWorkers=${sw.length}, pageOK=${typeof title === 'string'}, swUrl=${sw[0]?.url()?.slice(0, 60) ?? 'none'}`);
    await ctx.close().catch(() => {});
    return true;
  } catch (e) {
    console.log(`❌ ${label}: ${String(e.message).split('\n')[0]}`);
    return false;
  }
}

async function probeZen() {
  const label = 'Zen (headless, playwright firefox engine)';
  try {
    const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'zen-probe-'));
    const ctx = await Promise.race([
      firefox.launchPersistentContext(tmpProfile, {
        executablePath: ZEN,
        headless: true,
        firefoxUserPrefs: {
          'xpinstall.signatures.required': false,
          'extensions.autoDisableScopes': 0,
          'extensions.enabledScopes': 15,
        },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('launch timeout 30s')), 30_000)),
    ]);
    const pages = ctx.backgroundPages();
    const page = await ctx.newPage();
    await page.goto('about:blank');
    console.log(`✅ ${label}: launched+drivable, bgPages=${pages.length}`);
    await ctx.close().catch(() => {});
    return true;
  } catch (e) {
    console.log(`❌ ${label}: ${String(e.message).split('\n')[0]}`);
    return false;
  }
}

console.log('extension present:', fs.existsSync(CHROME_MV3), '| firefox profile:', fs.existsSync(FIREFOX_PROFILE));
const results = [];
results.push(['arc', await probeChromiumFamily('Arc', { executablePath: ARC, args: chromiumArgs(CHROME_MV3) })]);
results.push(['chrome', await probeChromiumFamily('Chrome channel', { channel: 'chrome', args: chromiumArgs(CHROME_MV3) })]);
results.push(['zen', await probeZen()]);
console.log('SUMMARY:', JSON.stringify(Object.fromEntries(results)));
