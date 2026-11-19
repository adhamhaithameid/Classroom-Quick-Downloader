// filepath: tests/e2e/options-page.spec.ts
/**
 * ============================================================================
 * OPTIONS PAGE — settings surface, in a real browser
 * ============================================================================
 *
 * The options page (bead 0h4d.1.8) had unit coverage for its settings store
 * but no browser E2E: nothing proved the built page renders, that switches
 * flip and persist through chrome.storage across a reload, or that the
 * permissions accordion and the diagnostics link survive the production
 * build. This spec loads the real chrome-mv3 bundle and drives the page the
 * way a user does.
 */
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension/.output/chrome-mv3');

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

/** The MV3 service worker sleeps and starts late — derive the id with a wait. */
async function extensionId(context: BrowserContext): Promise<string> {
  let sw = context.serviceWorkers().find((w) => w.url().includes('background.js'));
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 20_000 });
  return new URL(sw.url()).host;
}

const SWITCH = 'button[role="switch"]';

test.describe('Options page', () => {
  let context: BrowserContext;
  let extId: string;
  let page: Awaited<ReturnType<BrowserContext['newPage']>>;

  test.beforeAll(async ({}, testInfo) => {
    context = await launchWithExtension(testInfo.project.use.channel);
    extId = await extensionId(context);
    page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/options.html`);
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await page?.close();
    await context?.close();
  });

  test('renders the settings heading and all six switches', async () => {
    await expect(page.locator('h1')).toHaveText('Classroom Quick Downloader');

    const labels = [
      'Enable Extension',
      'Download All button',
      'Comment flags',
      'Edited flags',
      'Combined flags',
      'Reduce motion',
    ];
    for (const label of labels) {
      const toggle = page.locator(`${SWITCH}[aria-label="${label}"]`);
      await expect(toggle, `switch "${label}" must render`).toHaveCount(1);
      await expect(toggle).toBeEnabled();
      // Every switch must expose a real boolean state, not an empty attr.
      const checked = await toggle.getAttribute('aria-checked');
      expect(checked === 'true' || checked === 'false', `aria-checked=${checked}`).toBe(true);
    }
  });

  test('toggling a flag switch persists across a reload', async () => {
    const toggle = page.locator(`${SWITCH}[aria-label="Comment flags"]`);
    const before = await toggle.getAttribute('aria-checked');

    await toggle.click();
    // Web-first assertion: retries until the click handler has re-rendered.
    const after = before === 'true' ? 'false' : 'true';
    await expect(toggle, 'click must flip aria-checked').toHaveAttribute('aria-checked', after);

    // Flush the write: a storage read queues behind the page's pending set,
    // so it settles only once the click has been persisted. Without this the
    // reload can race the write (seen as a flake on Edge CI).
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const c = (globalThis as any).chrome;
          c.storage.local.get(null, () => c.storage.sync.get(null, () => resolve()));
        }),
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    // The page renders defaults first and hydrates from storage after
    // domcontentloaded; a one-shot read here sees the default. Retry instead.
    await expect(
      page.locator(`${SWITCH}[aria-label="Comment flags"]`),
      `state after reload must equal post-click state (${after})`,
    ).toHaveAttribute('aria-checked', after);

    // Leave the default state behind for the other tests and real users.
    await page.locator(`${SWITCH}[aria-label="Comment flags"]`).click();
  });

  test('permissions accordion expands and collapses a row', async () => {
    const storageHead = page.locator('.cqd-perm-head', { hasText: 'Storage' });
    await expect(storageHead).toHaveCount(1);

    await expect(storageHead).toHaveAttribute('aria-expanded', 'false');
    await storageHead.click();
    await expect(storageHead).toHaveAttribute('aria-expanded', 'true');
    // Collapsed bodies are visibility:hidden — expansion must reveal the text.
    // Scope to this row: the Downloads row starts open by design.
    await expect(page.locator('#cqd-perm-body-storage')).toBeVisible();

    await storageHead.click();
    await expect(storageHead).toHaveAttribute('aria-expanded', 'false');
  });

  test('links to the diagnostics page', async () => {
    const link = page.locator('button.cqd-options-diag-link');
    await expect(link, 'diagnostics link button must render').toHaveCount(1);
    await expect(link).toBeEnabled();
    // Clicking must open a diagnostics.html tab through chrome.tabs.
    const [diag] = await Promise.all([
      context.waitForEvent('page', { timeout: 10_000 }),
      link.click(),
    ]);
    expect(diag.url()).toContain(`chrome-extension://${extId}/diagnostics.html`);
    await diag.close();
  });
});
