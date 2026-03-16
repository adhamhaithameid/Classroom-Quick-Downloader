import { test, expect, chromium, type BrowserContext, type Route } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension/.output/chrome-mv3');
const SUBMISSIONS_URL = 'https://classroom.google.com/c/course-1/a/work-1/submissions/student-1';
const SUBMISSIONS_AUTHUSER_URL = 'https://classroom.google.com/u/1/c/course-1/a/work-1/submissions/student-1';
const SIDECAR_SELECTOR = 'button.cqd-download-btn[data-cqd-sw="true"]';

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

function studentWorkHtml(linkHref: string): string {
  return `<!doctype html>
<html>
  <body>
    <main>
      <div data-stream-item-id="submission-1" style="padding:24px;">
        <a href="${linkHref}">Student attachment</a>
      </div>
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
  return /^\/(?:u\/\d+\/)?c\/[^/]+\/a\/[^/]+\/submissions(?:\/[^?#]+)*\/?$/.test(pathname);
}

function isStudentWorkViewerPath(pathname: string): boolean {
  return /^\/(?:u\/\d+\/)?g\/tg\//.test(pathname);
}

async function installClassroomMock(
  context: BrowserContext,
  opts: {
    submissionLink: string;
    resolverDriveLink: string;
  },
): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    const reqUrl = new URL(route.request().url());

    if (isSubmissionsPath(reqUrl.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: studentWorkHtml(opts.submissionLink),
      });
      return;
    }

    if (isStudentWorkViewerPath(reqUrl.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: resolverHtml(opts.resolverDriveLink),
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

test.describe('Student Work Real Browser', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await launchWithExtension();

    if (context.serviceWorkers().length === 0) {
      await context.waitForEvent('serviceworker', { timeout: 10_000 });
    }
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('injects sidecar and resolves direct query-id links', async () => {
    const cleanupRoutes = await installClassroomMock(context, {
      submissionLink: 'https://classroom.google.com/g/tg/course/work/submission?id=FAST_FILE_101',
      resolverDriveLink: 'https://drive.google.com/file/d/IGNORED/view',
    });

    const page = await context.newPage();

    try {
      await page.goto(SUBMISSIONS_URL, { waitUntil: 'domcontentloaded' });

      const button = page.locator(SIDECAR_SELECTOR).first();
      await expect(button).toBeVisible({ timeout: 12_000 });
      await expect(button).toHaveAttribute('data-cqd-sw-source-url', /\/g\/tg\//);

      await button.click({ force: true });

      await expect.poll(async () => button.getAttribute('data-cqd-url'), {
        timeout: 12_000,
      }).toContain('id=FAST_FILE_101');
    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });

  test('injects sidecar and resolves iframe bridge links', async () => {
    const cleanupRoutes = await installClassroomMock(context, {
      submissionLink: 'https://classroom.google.com/g/tg/course/work/submission',
      resolverDriveLink: 'https://drive.google.com/file/d/BRIDGE_FILE_909/view?usp=drive_link',
    });

    const page = await context.newPage();

    try {
      await page.goto(SUBMISSIONS_URL, { waitUntil: 'domcontentloaded' });

      const button = page.locator(SIDECAR_SELECTOR).first();
      await expect(button).toBeVisible({ timeout: 12_000 });

      await button.click({ force: true });

      await expect.poll(async () => button.getAttribute('data-cqd-url'), {
        timeout: 15_000,
      }).toContain('id=BRIDGE_FILE_909');
    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });

  test('injects sidecar on authuser-prefixed submissions routes', async () => {
    const cleanupRoutes = await installClassroomMock(context, {
      submissionLink: 'https://classroom.google.com/g/tg/course/work/submission?id=AUTH_FILE_404',
      resolverDriveLink: 'https://drive.google.com/file/d/IGNORED/view',
    });

    const page = await context.newPage();

    try {
      await page.goto(SUBMISSIONS_AUTHUSER_URL, { waitUntil: 'domcontentloaded' });

      const button = page.locator(SIDECAR_SELECTOR).first();
      await expect(button).toBeVisible({ timeout: 12_000 });

      await button.click({ force: true });

      await expect.poll(async () => button.getAttribute('data-cqd-url'), {
        timeout: 12_000,
      }).toContain('id=AUTH_FILE_404');
    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });
});
