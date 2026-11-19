#!/usr/bin/env node
// filepath: tools/website-smoke-crawl.mjs
/**
 * ============================================================================
 * WEBSITE SMOKE CRAWL — every route in a real browser
 * ============================================================================
 *
 * The website had fetch-level smoke checks (tools/verify-production.mjs) but
 * no browser E2E: nothing proved routes render visible text, stay console-
 * clean, and keep their same-origin links alive. This crawl closes that gap.
 *
 *   node tools/website-smoke-crawl.mjs
 *   BASE_URL=https://classroom-quick-downloader.adhamhaithameid.is-a.dev \
 *     node tools/website-smoke-crawl.mjs
 *
 * Per route (every URL in the served sitemap.xml, same origin only):
 *   - loads with HTTP 200 (redirects followed, final status counted)
 *   - zero console errors and zero uncaught page errors
 *   - non-blank rendered text (< 40 visible chars = BLANK finding; this is
 *     how the /emails blank-render class of bug is caught)
 * Then every same-origin link seen on any page is fetched once; 4xx/5xx and
 * unreachable hosts are reported as dead links.
 *
 * Exit 0 = clean; exit 1 = one or more findings printed below. Read-only:
 * the crawl never writes to the site.
 */

import { chromium } from '@playwright/test';

const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/+$/, '');
const baseOrigin = new URL(BASE).origin;
const SETTLE_MS = Number(process.env.CRAWL_SETTLE_MS ?? 1_200);
const BLANK_FLOOR = 40;
const LINK_TIMEOUT_MS = 10_000;

const findings = [];

function record(severity, route, message) {
  findings.push({ severity, route, message });
  console.log(`${severity}  ${route || '(crawl)'} — ${message}`);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: 'follow', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Route list = served sitemap.xml <loc> URLs, same origin, plus "/". */
async function discoverRoutes() {
  const response = await fetchWithTimeout(`${BASE}/sitemap.xml`);
  if (!response.ok) {
    throw new Error(`sitemap.xml fetch failed: HTTP ${response.status}`);
  }
  const body = await response.text();
  const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  const paths = new Set(['/']);
  for (const loc of locs) {
    let url;
    try {
      url = new URL(loc);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    // Sitemap locs carry the canonical production origin; crawl by pathname
    // so the same crawl works against local preview and a live deploy.
    paths.add(url.pathname);
  }
  return [...paths].sort();
}

let routes;
try {
  routes = await discoverRoutes();
} catch (error) {
  console.error(`CRAWL ERROR — cannot read ${BASE}/sitemap.xml: ${error.message}`);
  console.error('Is the server running? e.g. pnpm -C website build && pnpm -C website preview --host 127.0.0.1');
  process.exit(2);
}
console.log(`Crawling ${routes.length} routes from ${BASE}/sitemap.xml\n`);

const browser = await chromium.launch({ channel: 'chromium', headless: true });
const context = await browser.newContext();
const seenLinks = new Set();

for (const route of routes) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const at = msg.location()?.url ?? '';
      consoleErrors.push(at && !msg.text().includes(at) ? `${msg.text()} [at ${at}]` : msg.text());
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err}`));

  try {
    const response = await page.goto(`${BASE}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    if (!response) {
      record('FAIL', route, 'no response (navigation failed)');
      continue;
    }
    const status = response.status();
    const finalPath = new URL(response.url()).pathname;
    const redirectNote =
      finalPath !== route && finalPath !== `${route}/` ? ` (redirects to ${finalPath})` : '';

    if (status !== 200) {
      record('FAIL', route, `HTTP ${status}${redirectNote}`);
    } else {
      console.log(`ok   ${route} — 200${redirectNote}`);
    }

    await page.waitForTimeout(SETTLE_MS);
    const textLength = (await page.evaluate(() => document.body.innerText.trim().length)) || 0;
    if (status === 200 && textLength < BLANK_FLOOR) {
      record('FINDING', route, `renders near-blank (${textLength} visible chars)`);
    }

    if (consoleErrors.length > 0) {
      record('FAIL', route, `${consoleErrors.length} console error(s): ${consoleErrors.join(' | ')}`);
    }

    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map((a) => a.href),
    );
    for (const href of hrefs) {
      try {
        const url = new URL(href);
        if (url.origin === baseOrigin && url.pathname) {
          seenLinks.add(url.pathname);
        }
      } catch {
        // Not a parseable URL — browser gave a non-http scheme; ignore.
      }
    }
  } catch (error) {
    record('FAIL', route, `navigation threw: ${error.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();

console.log(`\nChecking ${seenLinks.size} unique same-origin links...\n`);
let deadLinks = 0;
for (const path of [...seenLinks].sort()) {
  let response = null;
  let reason = '';
  try {
    response = await fetchWithTimeout(`${BASE}${path}`);
  } catch (error) {
    reason = error.message;
  }
  const ok = response && response.status < 400;
  if (!ok) {
    deadLinks++;
    const detail = response ? `HTTP ${response.status}` : `unreachable (${reason})`;
    record('FAIL', path, `dead link ${detail}`);
  }
}

console.log(
  `\n${routes.length} routes, ${seenLinks.size} links checked, ` +
    `${findings.length} finding(s), ${deadLinks} dead link(s)`,
);
process.exit(findings.length > 0 ? 1 : 0);
