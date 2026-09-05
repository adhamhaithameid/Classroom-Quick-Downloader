// filepath: tests/e2e/core-flow.spec.ts
/**
 * ============================================================================
 * CORE FLOW — the main user journey, in a real browser
 * ============================================================================
 *
 * The existing e2e specs cover Student Work only. The thing almost every user
 * actually does — open a class, see download buttons on attachments, see flag
 * badges on posts — had no real-browser coverage at all.
 *
 * These specs serve the committed golden fixtures under the real
 * https://classroom.google.com origin via request interception, so the content
 * scripts' hostname gate is satisfied without any Google account.
 *
 * Why a real browser and not jsdom: the unit suite already exercises detection
 * against these same fixtures. What it cannot exercise is the extension
 * actually loading, its MutationObserver firing on a live layout engine, and
 * buttons surviving repeated scans. That is what breaks in the field.
 */
import { test, expect, chromium, type BrowserContext, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension/.output/chrome-mv3');
const FIXTURES_DIR = path.resolve(__dirname, '../../extension/tests/fixtures/classroom');

const STREAM_URL = 'https://classroom.google.com/c/course-1';
const DOWNLOAD_BTN = 'button.cqd-download-btn';

function fixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

/** Wrap a fixture body in a full document so the browser parses it as a page. */
function page(fixtureName: string, dir: 'ltr' | 'rtl' = 'ltr'): string {
  return `<!doctype html>
<html dir="${dir}" lang="${dir === 'rtl' ? 'ar' : 'en'}">
  <head><meta charset="utf-8"><title>Classroom</title></head>
  <body style="margin:0;padding:24px;font-family:Roboto,Arial,sans-serif">
    ${fixture(fixtureName)}
  </body>
</html>`;
}

async function launchWithExtension(): Promise<BrowserContext> {
  return chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-default-apps',
    ],
  });
}

/** Serve one fixture for every classroom.google.com navigation. */
async function serveFixture(context: BrowserContext, html: string): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    const url = route.request().url();
    const hostname = new URL(url).hostname;
    if (route.request().resourceType() === 'document' && hostname === 'classroom.google.com') {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      return;
    }
    await route.fulfill({ status: 204, body: '' });
  };

  await context.route('https://classroom.google.com/**', handler);
  return async () => {
    await context.unroute('https://classroom.google.com/**', handler);
  };
}

test.describe('Core flow — attachments and flags', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await launchWithExtension();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('injects a download button for each Drive attachment on a material post', async () => {
    // classwork-material-post-en.html is the fixture that actually carries
    // Drive attachments. stream-flagged-post-en.html has none — it exists to
    // exercise flag detection, so injecting nothing there is correct.
    const cleanup = await serveFixture(context, page('classwork-material-post-en.html'));
    const p = await context.newPage();

    try {
      await p.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
      await p.waitForSelector(DOWNLOAD_BTN, { timeout: 20_000 });

      const count = await p.locator(DOWNLOAD_BTN).count();
      expect(count, 'at least one attachment should get a button').toBeGreaterThan(0);

      const marked = await p.locator(`${DOWNLOAD_BTN}[data-cqd-injected="true"]`).count();
      expect(marked, 'every button must carry the injected marker').toBe(count);

      // One button per container — never two on the same attachment.
      const perContainer = await p.evaluate(() =>
        [...document.querySelectorAll('[data-cqd-processed="true"]')].map(
          (c) => c.querySelectorAll('button.cqd-download-btn').length
        )
      );
      expect(perContainer.every((n) => n <= 1), `buttons per container: ${perContainer}`).toBe(true);
    } finally {
      await p.close();
      await cleanup();
    }
  });

  test('injects nothing for a post whose only link is a Google Form', async () => {
    // Guards the inverse of the above: a docs.google.com/forms link is not a
    // downloadable attachment and must never get a button.
    const cleanup = await serveFixture(context, page('stream-flagged-post-en.html'));
    const p = await context.newPage();

    try {
      await p.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(2500);
      expect(await p.locator(DOWNLOAD_BTN).count()).toBe(0);
    } finally {
      await p.close();
      await cleanup();
    }
  });

  test('injects on a right-to-left Arabic page', async () => {
    const cleanup = await serveFixture(context, page('rtl-flagged-post-ar.html', 'rtl'));
    const p = await context.newPage();

    try {
      await p.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
      await p.waitForSelector(DOWNLOAD_BTN, { timeout: 20_000 });

      expect(await p.locator(DOWNLOAD_BTN).count()).toBe(1);

      // The button must not overflow its post card in RTL. This is exactly the
      // class of bug jsdom cannot see, because jsdom has no layout.
      const overflow = await p.evaluate(() => {
        const btn = document.querySelector('button.cqd-download-btn');
        const card = btn?.closest('[data-stream-item-id]');
        if (!btn || !card) return null;
        const b = btn.getBoundingClientRect();
        const c = card.getBoundingClientRect();
        return { insideX: b.left >= c.left - 1 && b.right <= c.right + 1, width: b.width };
      });

      expect(overflow, 'button and card must both be laid out').not.toBeNull();
      expect(overflow!.width, 'button must have a real rendered width').toBeGreaterThan(0);
      expect(overflow!.insideX, 'button escaped its card horizontally in RTL').toBe(true);
    } finally {
      await p.close();
      await cleanup();
    }
  });

  test('does not duplicate buttons when the DOM mutates repeatedly', async () => {
    // The classic MutationObserver failure: every mutation triggers a rescan
    // and each rescan injects another button. Unit tests rarely catch it
    // because they do not run a live observer.
    const cleanup = await serveFixture(context, page('mixed-links-post-en.html'));
    const p = await context.newPage();

    try {
      await p.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
      await p.waitForSelector(DOWNLOAD_BTN, { timeout: 20_000 });

      const initial = await p.locator(DOWNLOAD_BTN).count();
      expect(initial).toBeGreaterThan(0);

      // Churn the DOM the way Classroom does when content streams in.
      await p.evaluate(() => {
        const host = document.querySelector('[data-stream-item-id]') ?? document.body;
        for (let i = 0; i < 12; i++) {
          const noise = document.createElement('div');
          noise.textContent = `noise-${i}`;
          host.appendChild(noise);
          noise.remove();
          host.appendChild(noise);
        }
      });

      await p.waitForTimeout(1500);

      const after = await p.locator(DOWNLOAD_BTN).count();
      expect(after, `button count grew from ${initial} to ${after} after DOM churn`).toBe(initial);
    } finally {
      await p.close();
      await cleanup();
    }
  });

  test('injects nothing on a post with no downloadable attachment', async () => {
    const cleanup = await serveFixture(context, page('announcement-detail-en.html'));
    const p = await context.newPage();

    try {
      await p.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
      // Give the scanner a full debounce window plus margin to be wrong.
      await p.waitForTimeout(2500);

      const count = await p.locator(DOWNLOAD_BTN).count();
      expect(count, 'a Forms link is not a downloadable attachment').toBe(0);
    } finally {
      await p.close();
      await cleanup();
    }
  });

  test('survives a page with no posts at all without throwing', async () => {
    const cleanup = await serveFixture(context, page('student-work-teacher-en.html'));
    const p = await context.newPage();
    const errors: string[] = [];
    p.on('pageerror', (e) => errors.push(String(e)));

    try {
      await p.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(2000);

      expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
    } finally {
      await p.close();
      await cleanup();
    }
  });
});
