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
 * Extensions run headless via Chromium's new headless mode (channel
 * 'chromium'). Playwright handles
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

/**
 * Signed Firefox leg (S11 T3): QA_SIGNED_XPI must point at an AMO-signed xpi
 * (produced by extension/tools/sign-extension.mjs). When set, an extra
 * qa-firefox-signed project exists; when unset this config is byte-for-byte
 * the pre-S11 behavior. The signed xpi survives Playwright's bundled Firefox
 * startup, so qa journeys run there instead of being skipped (see
 * tests/e2e/qa/harness.ts and global-setup's ensureFirefoxProfile).
 */
const QA_SIGNED_XPI = process.env.QA_SIGNED_XPI;

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
      testIgnore: /[/\\]qa[/\\]/,
      use: {
        ...devices['Desktop Chrome'],
        // channel 'chromium' = new headless, the build that supports extensions.
        channel: 'chromium',

        // Launch with the extension loaded (works headless since new headless).
        launchOptions: {
          headless: true,
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

    // ────────────────────────────────────────────────────────────────────
    // Edge smoke (S11 gate G5: Chrome + Edge smoke green in CI).
    // Mirrors extension-chromium — same extension launch args, same qa/
    // testIgnore scheme — but on the msedge channel and restricted to the
    // smoke subset: the qa/ journeys stay on the qa-* projects (they launch
    // their own contexts via the harness) and the heavier specs stay
    // chromium-only.
    // ────────────────────────────────────────────────────────────────────
    {
      name: 'extension-edge',
      testMatch: [/[/\\]core-flow\.spec\.ts/, /[/\\]extension-smoke\.spec\.ts/],
      testIgnore: /[/\\]qa[/\\]/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge',

        launchOptions: {
          headless: true,
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

    // ────────────────────────────────────────────────────────────────────
    // Manual-QA Replay (docs/superpowers/specs/2026-09-12-manual-qa-replay-design.md)
    // These specs launch their own persistent contexts via the harness —
    // per-browser project selection is what the specs read to pick the
    // built bundle (chrome-mv3 vs firefox-mv2).
    // ────────────────────────────────────────────────────────────────────
    {
      name: 'qa-chromium',
      testMatch: /tests\/e2e\/qa\/.*\.spec\.ts/,
      use: {
        browserName: 'chromium',
        acceptDownloads: true,
      },
    },
    {
      name: 'qa-firefox',
      testMatch: /tests\/e2e\/qa\/.*\.spec\.ts/,
      use: {
        browserName: 'firefox',
        acceptDownloads: true,
      },
    },

    // ────────────────────────────────────────────────────────────────────
    // Signed Firefox leg (S11 T3) — only exists when QA_SIGNED_XPI is set.
    // Mirrors qa-firefox; global-setup installs the signed xpi into the
    // shared prepared profile instead of the unsigned zip.
    // ────────────────────────────────────────────────────────────────────
    ...(QA_SIGNED_XPI
      ? [
          {
            name: 'qa-firefox-signed',
            testMatch: /tests\/e2e\/qa\/.*\.spec\.ts/,
            use: {
              browserName: 'firefox',
              acceptDownloads: true,
            },
          },
        ]
      : []),
  ],

  // Global setup builds the extension before running tests.
  globalSetup: './tests/e2e/global-setup.ts',
});
