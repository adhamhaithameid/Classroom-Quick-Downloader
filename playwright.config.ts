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
 * 'chromium'), which — unlike the bundled old headless — supports the
 * extension APIs. Tests run with no visible window; set E2E_HEADED=1 to
 * opt back into a real browser window for debugging.
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
      // live/ is excluded like qa/: those specs launch their own persistent
      // contexts on the dedicated signed-in profile (tests/e2e/live/).
      testIgnore: /[/\\](qa|live|headed)[/\\]/,
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
    // NOTE — there is deliberately NO 'extension-chrome' (branded Google
    // Chrome) project. Since Chrome 137, branded builds ignore
    // --load-extension/--disable-extensions-except (anti-abuse), so no
    // extension can be tested there at all (verified 2026-09-19 on Chrome
    // 150: service worker never registers, content scripts never inject).
    // The Chrome ENGINE is covered by extension-chromium — Chrome for
    // Testing is Google's own test build and still honors the flags.
    // tools/check-chrome-support.mjs re-probes branded Chrome if you want to
    // re-introduce a project after a Google policy change.
    // Microsoft Edge is separately branded and still honors the flags today
    // (its leg runs the full suite green); if a future Edge update drops
    // them, this suite fails loudly and edge coverage falls back to the
    // chromium project.
    // ────────────────────────────────────────────────────────────────────

    // ────────────────────────────────────────────────────────────────────
    // Microsoft Edge (S11 gate G5). Runs the FULL suite (spec launchers take
    // the project channel — 'msedge' here — so the Edge leg is never a fake
    // vanilla-Chromium pass); qa/ journeys stay on the qa-* projects (they
    // launch their own contexts via the harness).
    // ────────────────────────────────────────────────────────────────────
    {
      name: 'extension-edge',
      testIgnore: /[/\\](qa|live|headed)[/\\]/,
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
    // LIVE REAL-CLASSROOM suite (tests/e2e/live/) — real classroom.google.com
    // against the user's own account, both student and teacher roles.
    // Launches its own persistent context on the dedicated manually-signed-in
    // profile (tests/e2e/.live-profile, created once by `pnpm
    // test:live:login`). Gated in-spec by LIVE_CLASSROOM=1 — without the gate
    // the browser specs skip with an actionable reason and the offline parser
    // unit tests (parse.spec.ts) still run. NEVER run in CI (real account).
    // Docs: docs/LIVE_CLASSROOM_TESTING.md · Research:
    // docs/research/live-classroom-e2e-testing.md
    // ────────────────────────────────────────────────────────────────────
    {
      name: 'live-chromium',
      testMatch: /tests\/e2e\/live\/.*\.spec\.ts/,
      use: {
        browserName: 'chromium',
        acceptDownloads: true,
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
    // Journey suite on Edge stable (harness resolves the launch channel from
    // the project name — see projectChannel in harness.ts). There is no
    // qa-chrome for the same reason there is no extension-chrome: branded
    // Chrome ignores the extension load flags (see the note above).
    {
      name: 'qa-edge',
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

    // ────────────────────────────────────────────────────────────────────
    // HEADED security suite (tests/e2e/headed/) — S1/S2 black-box armor from
    // the 2026-09-24 audit. onDeterminingFilename NEVER fires in headless
    // Chromium, so the filename-suggestion pipeline is invisible to every
    // headless project; these journeys must run headed. Specs self-launch
    // their own persistent contexts (mock Drive over TLS + real download
    // pipeline into a scratch dir). Gated on E2E_HEADED=1 like the debug
    // opt-in above; CI runs them under xvfb (workflow job e2e-headed).
    // ────────────────────────────────────────────────────────────────────
    ...(process.env.E2E_HEADED === '1'
      ? [
          {
            name: 'extension-headed',
            testMatch: /tests\/e2e\/headed\/.*\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              channel: 'chromium',
            },
          },
        ]
      : []),
  ],

  // Global setup builds the extension before running tests.
  globalSetup: './tests/e2e/global-setup.ts',
});
