import { test, expect, chromium, type BrowserContext, type Route } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension/.output/chrome-mv3');
const SUBMISSIONS_URL = 'https://classroom.google.com/c/course-1/a/work-1/submissions/by-status/and-sort-name/all/all';
const SIDECAR_SELECTOR = 'button.cqd-download-btn[data-cqd-sw-bs="true"]';
const DOWNLOAD_ALL_SELECTOR = 'button.cqd-download-all-btn';

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

async function ensureServiceWorkerReady(context: BrowserContext): Promise<void> {
  if (context.serviceWorkers().length > 0) return;
  try {
    await context.waitForEvent('serviceworker', { timeout: 10_000 });
  } catch {
    // Best effort only: persistent contexts can race service-worker visibility.
  }
}

function studentWorkHtml(linkHrefs: string[]): string {
  const cards = linkHrefs
    .map((linkHref) => `
        <div class="WkZsyc file-card">
          <a class="vwNuXe" aria-label="Attachment: Image: screenshot.png" href="${linkHref}">Student attachment</a>
        </div>`)
    .join('');

  return `<!doctype html>
<html>
  <body>
    <main>
      <section class="submission-grid">${cards}
      </section>
    </main>
  </body>
</html>`;
}

function resolverHtml(driveLink: string): string {
  return `<!doctype html>
<html>
  <body>
    <div class="resolver-body">
      <a href="${driveLink}">Open in Drive</a>
    </div>
  </body>
</html>`;
}

function isSubmissionsPath(pathname: string): boolean {
  return /^\/(?:u\/\d+\/)?c\/[^/]+\/a\/[^/]+\/submissions\/by-status\/and-sort-name\/[^/]+\/[^/]+/.test(pathname);
}

function isStudentWorkViewerPath(pathname: string): boolean {
  return /^\/(?:u\/\d+\/)?g\/tg\//.test(pathname);
}

async function installClassroomMock(
  context: BrowserContext,
  opts: {
    submissionLinks: string[];
    resolverDriveLinks: string[];
  },
): Promise<() => Promise<void>> {
  let resolverCallCount = 0;

  const handler = async (route: Route) => {
    const reqUrl = new URL(route.request().url());

    if (isSubmissionsPath(reqUrl.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: studentWorkHtml(opts.submissionLinks),
      });
      return;
    }

    if (isStudentWorkViewerPath(reqUrl.pathname)) {
      const driveLink = opts.resolverDriveLinks[resolverCallCount % opts.resolverDriveLinks.length] || opts.resolverDriveLinks[0];
      resolverCallCount++;
      // Stall the resolver to ensure the downloads are stuck "in progress" mid-batch
      await new Promise(resolve => setTimeout(resolve, 5000));
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: resolverHtml(driveLink),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body>mock classroom page</body></html>',
    });
  };

  await context.route('https://classroom.google.com/**', handler);

  return async () => {
    await context.unroute('https://classroom.google.com/**', handler);
  };
}


test.describe('Download All Cancel Flow', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await launchWithExtension();
    await ensureServiceWorkerReady(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('download-all can be cancelled mid-batch', async () => {
    const cleanupRoutes = await installClassroomMock(context, {
      submissionLinks: [
        'https://classroom.google.com/g/tg/course/work/submission/ATTACH_A',
        'https://classroom.google.com/g/tg/course/work/submission/ATTACH_B',
        'https://classroom.google.com/g/tg/course/work/submission/ATTACH_C',
      ],
      resolverDriveLinks: [
        'https://drive.google.com/file/d/MAP_FILE_A/view?usp=drive_link',
        'https://drive.google.com/file/d/MAP_FILE_B/view?usp=drive_link',
        'https://drive.google.com/file/d/MAP_FILE_C/view?usp=drive_link',
      ]
    });

    const page = await context.newPage();

    try {
      await page.goto(SUBMISSIONS_URL, { waitUntil: 'domcontentloaded' });

      // Wait for Download All button to be injected
      const sidecarButtons = page.locator(SIDECAR_SELECTOR);
      await expect(sidecarButtons).toHaveCount(3, { timeout: 12000 });

      const downloadAllBtn = page.locator(DOWNLOAD_ALL_SELECTOR).first();
      await expect(downloadAllBtn).toBeVisible({ timeout: 12000 });

      // Click Download All
      await downloadAllBtn.click({ force: true });

      // Wait until it transitions to Cancel
      // It should have the cqd-all-cancel class applied
      await expect(downloadAllBtn).toHaveClass(/cqd-all-cancel/, { timeout: 10000 });

      // Now click the cancel button
      await downloadAllBtn.click({ force: true });

      // Verify it transitions to cancelled state
      await expect(downloadAllBtn).toHaveClass(/cqd-all-cancelled/);

      // Verify individual buttons are cancelled as well
      const count = await sidecarButtons.count();
      for (let i = 0; i < count; i++) {
         await expect(sidecarButtons.nth(i)).toHaveClass(/cqd-cancelled/);
      }
    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });
});
