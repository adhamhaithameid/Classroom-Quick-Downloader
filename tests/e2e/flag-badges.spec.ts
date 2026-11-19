// filepath: tests/e2e/flag-badges.spec.ts
/**
 * ============================================================================
 * FLAG BADGES — comment_frame and edited_frame, in a real browser
 * ============================================================================
 *
 * The comment and edited flag entrypoints had unit coverage (detector logic,
 * badge dedupe, initial-read race) but no browser E2E. What only a real
 * browser proves: which badge the SHIPPED engine actually renders. The
 * default mode merges comment + edited markers into one combined V2 badge
 * (data-cqd-flag-kind="both") — discovered here by first running this spec
 * against the v1 badge classes and watching it fail. Single-marker posts
 * still render the single-kind badge.
 *
 * The comment case uses the committed stream fixture (it carries a real
 * .comment-count marker); the single-marker cases inline their own marker
 * HTML, because no committed fixture isolates one marker yet.
 */
import { test, expect, chromium, type BrowserContext, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension/.output/chrome-mv3');
const FIXTURES_DIR = path.resolve(__dirname, '../../extension/tests/fixtures/classroom');
const STREAM_URL = 'https://classroom.google.com/c/course-1';

function fixture(name: string): string {
  return readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

/** Wrap a fixture body in a full document so the browser parses it as a page. */
function page(body: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Classroom</title></head>
  <body style="margin:0;padding:24px;font-family:Roboto,Arial,sans-serif">
    ${body}
  </body>
</html>`;
}

const HEADLESS = process.env.E2E_HEADED !== '1';

async function launchWithExtension(channel?: string): Promise<BrowserContext> {
  return chromium.launchPersistentContext('', {
    channel: channel ?? 'chromium',
    headless: HEADLESS,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-default-apps',
    ],
  });
}

/** Serve one page body for every classroom.google.com navigation. */
async function servePage(context: BrowserContext, html: string): Promise<() => Promise<void>> {
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

test.describe('Flag badges — comment and edited frames', () => {
  let context: BrowserContext;

  test.beforeAll(async ({}, testInfo) => {
    context = await launchWithExtension(testInfo.project.use.channel);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('a post with both markers renders the combined badge with the comment count', async () => {
    // The fixture card carries <div class="comment-count">5 class comments</div>
    // and "Edited Mar 10" — default settings merge them into one badge.
    const cleanup = await servePage(context, page(fixture('stream-flagged-post-en.html')));
    const p = await context.newPage();

    try {
      await p.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
      const badge = p.locator('div.cqd-both-badge[data-cqd-injected="true"]');
      await badge.waitFor({ state: 'visible', timeout: 20_000 });

      await expect(badge).toHaveCount(1);
      await expect(badge).toHaveAttribute('data-cqd-flag-kind', 'both');
      await expect(badge).toHaveAttribute('data-cqd-comment-count', '5');
      await expect(badge).toHaveAttribute('aria-label', /5 comments.*Edited/s);
    } finally {
      await p.close();
      await cleanup();
    }
  });

  test('a comment-only post renders the comment badge', async () => {
    const commentOnly = `
      <article data-stream-item-id="post-comment-1">
        <div class="asQXV">Homework attached.</div>
        <section class="n4xnA comment-shell">
          <div class="comment-count">3 class comments</div>
        </section>
      </article>`;
    const cleanup = await servePage(context, page(commentOnly));
    const p = await context.newPage();

    try {
      await p.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
      const badge = p.locator('div[data-cqd-flag-kind="comment"][data-cqd-injected="true"]');
      await badge.waitFor({ state: 'visible', timeout: 20_000 });
      await expect(badge).toHaveCount(1);
      await expect(badge).toHaveAttribute('data-cqd-comment-count', '3');
    } finally {
      await p.close();
      await cleanup();
    }
  });

  test('an edited-only post renders the edited badge', async () => {
    const editedOnly = `
      <section data-stream-item-id="post-edited-1">
        <div class="n4xnA">
          <span aria-label="Posted by teacher, edited">Attachment posted · edited</span>
        </div>
      </section>`;
    const cleanup = await servePage(context, page(editedOnly));
    const p = await context.newPage();

    try {
      await p.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
      const badge = p.locator('div.cqd-edited-badge[data-cqd-injected="true"]');
      await badge.waitFor({ state: 'visible', timeout: 20_000 });
      await expect(badge).toHaveCount(1);
    } finally {
      await p.close();
      await cleanup();
    }
  });
});
