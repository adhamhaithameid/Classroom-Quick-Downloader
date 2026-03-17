import { test, expect, chromium, type BrowserContext, type Route } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension/.output/chrome-mv3');
const SUBMISSIONS_URL = 'https://classroom.google.com/c/course-1/a/work-1/submissions/by-status/and-sort-name/all/all';
const SUBMISSIONS_AUTHUSER_URL = 'https://classroom.google.com/u/1/c/course-1/a/work-1/submissions/by-status/and-sort-name/all/all';
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
    submissionLink?: string;
    submissionLinks?: string[];
    resolverDriveLink: string;
  },
): Promise<() => Promise<void>> {
  const handler = async (route: Route) => {
    const reqUrl = new URL(route.request().url());

    if (isSubmissionsPath(reqUrl.pathname)) {
      const submissionLinks = opts.submissionLinks ??
        (opts.submissionLink ? [opts.submissionLink] : []);
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: studentWorkHtml(submissionLinks),
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

test.describe('Student Work By-Status Real Browser', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await launchWithExtension();
    await ensureServiceWorkerReady(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('injects button and resolves direct query-id links on by-status route', async () => {
    const cleanupRoutes = await installClassroomMock(context, {
      submissionLink: 'https://classroom.google.com/g/tg/course/work/submission?id=FAST_FILE_202',
      resolverDriveLink: 'https://drive.google.com/file/d/IGNORED/view',
    });

    const page = await context.newPage();

    try {
      await page.goto(SUBMISSIONS_URL, { waitUntil: 'domcontentloaded' });

      const button = page.locator(SIDECAR_SELECTOR).first();
      await expect(button).toBeVisible({ timeout: 12_000 });
      await expect(button).toHaveAttribute('data-cqd-sw-source-url', /(\/g\/tg\/|drive\.google\.com\/uc\?)/);

      await button.click({ force: true });

      await expect.poll(async () => button.getAttribute('data-cqd-url'), {
        timeout: 12_000,
      }).toContain('id=FAST_FILE_202');
    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });

  test('injects button and resolves iframe bridge links on by-status route', async () => {
    const cleanupRoutes = await installClassroomMock(context, {
      submissionLink: 'https://classroom.google.com/g/tg/course/work/submission',
      resolverDriveLink: 'https://drive.google.com/file/d/BRIDGE_FILE_808/view?usp=drive_link',
    });

    const page = await context.newPage();

    try {
      await page.goto(SUBMISSIONS_URL, { waitUntil: 'domcontentloaded' });

      const button = page.locator(SIDECAR_SELECTOR).first();
      await expect(button).toBeVisible({ timeout: 12_000 });

      await button.click({ force: true });

      await expect.poll(async () => button.getAttribute('data-cqd-url'), {
        timeout: 15_000,
      }).toContain('id=BRIDGE_FILE_808');
    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });

  test('renders Download All and downloads every file in by-status section', async () => {
    const cleanupRoutes = await installClassroomMock(context, {
      submissionLinks: [
        'https://classroom.google.com/g/tg/course/work/submission?id=FAST_FILE_301',
        'https://classroom.google.com/g/tg/course/work/submission?id=FAST_FILE_302',
      ],
      resolverDriveLink: 'https://drive.google.com/file/d/IGNORED/view',
    });

    const page = await context.newPage();

    try {
      await page.goto(SUBMISSIONS_URL, { waitUntil: 'domcontentloaded' });

      const sidecarButtons = page.locator(SIDECAR_SELECTOR);
      await expect(sidecarButtons).toHaveCount(2, { timeout: 12_000 });
      await expect(page.locator('.WkZsyc.file-card ' + SIDECAR_SELECTOR)).toHaveCount(2, { timeout: 12_000 });

      await expect(page.locator(DOWNLOAD_ALL_SELECTOR)).toHaveCount(1, { timeout: 12_000 });
      const downloadAllButton = page.locator(DOWNLOAD_ALL_SELECTOR).first();
      await expect(downloadAllButton).toBeVisible({ timeout: 12_000 });

      await downloadAllButton.click({ force: true });

      const firstButton = sidecarButtons.nth(0);
      const secondButton = sidecarButtons.nth(1);

      await expect.poll(async () => firstButton.getAttribute('data-cqd-url'), {
        timeout: 12_000,
      }).toContain('id=FAST_FILE_301');
      await expect.poll(async () => secondButton.getAttribute('data-cqd-url'), {
        timeout: 12_000,
      }).toContain('id=FAST_FILE_302');
    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });

  test('Download All keeps per-file mapping when resolver links are generic but distinct per submission', async () => {
    const handler = async (route: Route) => {
      const reqUrl = new URL(route.request().url());

      if (isSubmissionsPath(reqUrl.pathname)) {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: studentWorkHtml([
            'https://classroom.google.com/g/tg/course/work/submission/ATTACH_A',
            'https://classroom.google.com/g/tg/course/work/submission/ATTACH_B',
          ]),
        });
        return;
      }

      if (isStudentWorkViewerPath(reqUrl.pathname)) {
        const driveLink = reqUrl.pathname.includes('ATTACH_A')
          ? 'https://drive.google.com/file/d/MAP_FILE_A/view?usp=drive_link'
          : 'https://drive.google.com/file/d/MAP_FILE_B/view?usp=drive_link';

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
    const page = await context.newPage();

    try {
      await page.goto(SUBMISSIONS_URL, { waitUntil: 'domcontentloaded' });

      const sidecarButtons = page.locator(SIDECAR_SELECTOR);
      await expect(sidecarButtons).toHaveCount(2, { timeout: 12_000 });

      const downloadAllButton = page.locator(DOWNLOAD_ALL_SELECTOR).first();
      await expect(downloadAllButton).toBeVisible({ timeout: 12_000 });

      await downloadAllButton.click({ force: true });

      const firstButton = sidecarButtons.nth(0);
      const secondButton = sidecarButtons.nth(1);

      await expect.poll(async () => firstButton.getAttribute('data-cqd-url'), {
        timeout: 15_000,
      }).toContain('id=MAP_FILE_A');
      await expect.poll(async () => secondButton.getAttribute('data-cqd-url'), {
        timeout: 15_000,
      }).toContain('id=MAP_FILE_B');
    } finally {
      await page.close();
      await context.unroute('https://classroom.google.com/**', handler);
    }
  });

  test('injects by-status sidecar on authuser-prefixed routes', async () => {
    const cleanupRoutes = await installClassroomMock(context, {
      submissionLink: 'https://classroom.google.com/g/tg/course/work/submission?id=AUTH_FILE_505',
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
      }).toContain('id=AUTH_FILE_505');
    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });

  test('resolves iframe bridge links with authuser preserved on authuser-prefixed by-status routes', async () => {
    const cleanupRoutes = await installClassroomMock(context, {
      submissionLink: 'https://classroom.google.com/g/tg/course/work/submission',
      resolverDriveLink: 'https://drive.google.com/file/d/AUTH_BRIDGE_606/view?usp=drive_link',
    });

    const page = await context.newPage();

    try {
      await page.goto(SUBMISSIONS_AUTHUSER_URL, { waitUntil: 'domcontentloaded' });

      const button = page.locator(SIDECAR_SELECTOR).first();
      await expect(button).toBeVisible({ timeout: 12_000 });

      await button.click({ force: true });

      await expect.poll(async () => button.getAttribute('data-cqd-url'), {
        timeout: 15_000,
      }).toContain('id=AUTH_BRIDGE_606');

      await expect.poll(async () => button.getAttribute('data-cqd-url'), {
        timeout: 15_000,
      }).toContain('authuser=1');
    } finally {
      await page.close();
      await cleanupRoutes();
    }
  });
});
