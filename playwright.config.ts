// filepath: playwright.config.ts
/**
 * ============================================================================
 * PLAYWRIGHT CONFIG — Extension Testing with Chrome
 * ============================================================================
 *
 * This config sets up Playwright to test the CQD extension in a real browser.
 *
 * The trick: Playwright can load Chrome extensions by passing
 * --load-extension and --disable-extensions-except to the Chromium
 * args. We build the extension first (via `pnpm -C extension build`),
 * then point Playwright at the built output directory.
 *
 * IMPORTANT: These tests need a REAL Chromium (not headless!) because
 * Chrome extensions don't work in headless mode. Playwright handles
 * this gracefully — it opens a real browser window for the tests.
 *
 * The test flow:
 * 1. Build the extension (done in globalSetup)
 * 2. Launch Chromium with the extension loaded
 * 3. Navigate to a Classroom page (or a local fixture file)
 * 4. Assert that CQD elements are injected
 *
 * For Classroom tests that need a real login, see
 * tests/e2e/extension-smoke.spec.ts which can use a stored auth state.
 *
 * @author Adham
 * @since v4.0.0
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * The path to the built extension output.
 * After running `pnpm -C extension build`, WXT outputs to
 * extension/.output/chrome-mv3/ (for Chrome MV3 builds).
 */
const EXTENSION_PATH = path.resolve(__dirname, 'extension/.output/chrome-mv3');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1, // Extensions can't share browser instances

  use: {
    // No base URL — we'll navigate to Classroom or local fixtures
    baseURL: undefined,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'extension-chromium',
      use: {
        ...devices['Desktop Chrome'],

        // Launch with the extension loaded.
        // headless: false is REQUIRED because extension APIs are unavailable in headless mode.
        launchOptions: {
          headless: false,
          args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--disable-default-apps',
          ],
        },
      },
    },
  ],

  // Global setup builds the extension before running tests.
  globalSetup: './tests/e2e/global-setup.ts',
});
