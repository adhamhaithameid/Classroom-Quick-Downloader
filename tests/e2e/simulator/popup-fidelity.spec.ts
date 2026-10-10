// filepath: tests/e2e/simulator/popup-fidelity.spec.ts
// ============================================================================
// SIMULATOR POPUP FIDELITY — proves the User-view popup is IDENTICAL to the
// real Chrome extension popup:
//   1. the popup document is the production CSS context: body computes to
//      exactly 360x600 (App.css rules apply in the iframe, unpolluted),
//   2. the real App markup renders inside it,
//   3. Chrome dresses the bubble: 10px radius + shadow, anchored top-right,
//   4. Chrome behavior: click-outside dismisses, toolbar icon reopens.
//
// Server wiring: self-starting Vite dev server (strict port, readiness
// poll), same pattern as annotate.spec.ts. Run via `pnpm test:simulator-e2e`
// (project simulator-chromium); no CI lane invokes it.
// ============================================================================

import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const SIMULATOR_DIR = path.resolve(__dirname, '../../../simulator');
const PORT = 5201;
const BASE = `http://localhost:${PORT}`;

let server: ChildProcess | null = null;

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await sleep(250);
  }
  throw new Error(`simulator dev server did not start: ${lastError}`);
}

test.beforeAll(async () => {
  server = spawn('pnpm', ['dev', '--strictPort', '--port', String(PORT)], {
    cwd: SIMULATOR_DIR,
    stdio: 'ignore',
    detached: true,
  });
  await waitForServer(BASE, 30_000);
  await sleep(500);
});

test.afterAll(async () => {
  if (server?.pid) {
    try {
      process.kill(-server.pid);
    } catch {
      // Already gone.
    }
  }
  server = null;
});

async function openPopupUserView(page: Page, stateId: string): Promise<void> {
  await page.goto(`${BASE}/#popup=${stateId}`);
  // Fresh browser context: User view defaults to ON (no stored override).
  const bubble = page.getByTestId('chrome-bubble');
  await expect(bubble).toBeVisible({ timeout: 15_000 });
  const popupFrame = page.frameLocator('[data-testid="chrome-popup-iframe"]');
  // The real App mounts inside the iframe document.
  await expect(popupFrame.locator('.cqd-app')).toBeVisible({ timeout: 15_000 });
}

test('popup document computes to exactly 360x600 — the production body rules', async ({
  page,
}) => {
  await openPopupUserView(page, 'first-run');
  const popupFrame = page.frameLocator('[data-testid="chrome-popup-iframe"]');
  const size = await popupFrame.locator('body').evaluate((body) => {
    const styles = getComputedStyle(body);
    return { width: styles.width, height: styles.height };
  });
  expect(size.width).toBe('360px');
  expect(size.height).toBe('600px');
});

test('the production stylesheets are the ONLY ones in the popup document', async ({
  page,
}) => {
  await openPopupUserView(page, 'first-run');
  const popupFrame = page.frameLocator('[data-testid="chrome-popup-iframe"]');
  const sheetTexts = await popupFrame.locator('style').allTextContents();
  const joined = sheetTexts.join('\n');
  // Production markers: the Stillwater type tokens and the App shell rule.
  expect(joined).toContain('--cqd-fs-body');
  expect(joined).toContain('cqd-shell-bg');
  // Simulator shell styles must NOT leak into the popup document.
  expect(joined).not.toContain('sim-body');
  expect(joined).not.toContain('sim-popup-frame');
});

test('Chrome dresses the bubble: radius, shadow, anchored top-right under the toolbar', async ({
  page,
}) => {
  await openPopupUserView(page, 'first-run');
  const bubble = page.getByTestId('chrome-bubble');
  const styles = await bubble.evaluate((el) => {
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      radius: s.borderRadius,
      shadow: s.boxShadow,
      width: s.width,
      height: s.height,
      top: rect.top,
      rightGap: window.innerWidth - rect.right,
    };
  });
  expect(styles.radius).toBe('10px');
  expect(styles.shadow).not.toBe('none');
  expect(styles.width).toBe('360px');
  expect(styles.height).toBe('600px');
  // Anchored below the 40px toolbar, near the right edge.
  expect(styles.top).toBe(48);
  expect(styles.rightGap).toBeLessThan(40);
});

test('Chrome behavior: page click dismisses, toolbar icon reopens', async ({ page }) => {
  await openPopupUserView(page, 'first-run');
  await page.getByTestId('chrome-backdrop').click({ position: { x: 60, y: 300 } });
  await expect(page.getByTestId('chrome-bubble')).toHaveCount(0);
  await page.getByTestId('chrome-ext-icon').click();
  await expect(page.getByTestId('chrome-bubble')).toBeVisible();
});
