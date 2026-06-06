import { test, expect, chromium, type BrowserContext, type Route } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension/.output/chrome-mv3');

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

const assignmentFixtureHtml = `<!doctype html>
<html>
  <body>
    <div data-stream-item-id="assignment-1">
      <div data-attachment-id="file-1" class="luto0c">
        <a href="https://drive.google.com/file/d/test-file/view">Test Attachment</a>
      </div>
    </div>
  </body>
</html>`;

async function installClassroomMock(context: BrowserContext): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    const reqUrl = new URL(route.request().url());

    if (reqUrl.pathname.includes('/a/') && reqUrl.pathname.endsWith('/details')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: assignmentFixtureHtml,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>mock page</body></html>',
    });
  };

  await context.route('https://classroom.google.com/**', handler);

  return async () => {
    await context.unroute('https://classroom.google.com/**', handler);
  };
}


test.describe('Classroom Assignment Real Browser', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await launchWithExtension();
    try {
      if (context.serviceWorkers().length === 0) {
        await context.waitForEvent('serviceworker', { timeout: 10000 });
      }
    } catch {}
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('injects download buttons on assignment page', async () => {
    const cleanupRoutes = await installClassroomMock(context);
    const page = await context.newPage();

    try {
      await page.goto('https://classroom.google.com/c/course-id/a/assignment-id/details', { waitUntil: 'domcontentloaded' });

      // Wait for extension to inject UI. Note: V2 or legacy mode injection creates button.cqd-download-btn
      const button = page.locator('.cqd-download-btn').first();
      await expect(button).toBeVisible({ timeout: 15_000 });

    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });
});
