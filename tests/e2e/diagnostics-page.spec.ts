// filepath: tests/e2e/diagnostics-page.spec.ts
/**
 * ============================================================================
 * DIAGNOSTICS PAGE — copyable PII-free report, in a real browser
 * ============================================================================
 *
 * The diagnostics page (bead 0h4d.1.7) had unit coverage for its pure
 * builder and scrubber but no browser E2E. What only a real browser proves:
 * the page gathers queue/history/settings over real service-worker
 * messaging, renders a parseable JSON report with the schema tag, and never
 * leaks email-shaped strings into the visible report. This spec drives the
 * built page directly.
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

const REPORT = 'pre[data-testid="diag-report"]';

test.describe('Diagnostics page', () => {
  let context: BrowserContext;
  let extId: string;
  let page: Awaited<ReturnType<BrowserContext['newPage']>>;

  test.beforeAll(async ({}, testInfo) => {
    context = await launchWithExtension(testInfo.project.use.channel);
    extId = await extensionId(context);
    page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/diagnostics.html`);
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await page?.close();
    await context?.close();
  });

  /** Wait for the report to leave the 'Gathering…' state, then parse it. */
  async function readReport(): Promise<Record<string, unknown>> {
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el !== null && el.textContent !== null && el.textContent.trim() !== 'Gathering…';
      },
      REPORT,
      { timeout: 20_000 },
    );
    const text = await page.locator(REPORT).innerText();
    return JSON.parse(text) as Record<string, unknown>;
  }

  test('renders the heading and a parseable schema-tagged report', async () => {
    await expect(page.locator('h1')).toHaveText('Diagnostics');

    const report = await readReport();
    expect(report.schema, 'report must carry the schema tag').toBe('cqd-diagnostics/1');
    // The builder contract: environment block, flags and counters are present.
    const extension = report.extension as { version?: string } | undefined;
    expect(String(extension?.version)).toMatch(/^\d+\.\d+/);
    expect(report.queue).toBeTruthy();
    expect(report.history).toBeTruthy();
  });

  test('report stays PII-free (no email-shaped strings)', async () => {
    const text = await page.locator(REPORT).innerText();
    const emails = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
    expect(emails, `email-shaped strings in report: ${emails.join(', ')}`).toEqual([]);
  });

  test('action buttons enable and Regenerate keeps the report valid', async () => {
    const copy = page.getByRole('button', { name: 'Copy report' });
    const download = page.getByRole('button', { name: 'Download .json' });
    const regenerate = page.getByRole('button', { name: 'Regenerate' });

    await expect(copy).toBeEnabled();
    await expect(download).toBeEnabled();
    await expect(regenerate).toBeEnabled();

    await regenerate.click();
    const report = await readReport();
    expect(report.schema, 'report must still carry the schema tag').toBe('cqd-diagnostics/1');
  });
});
