// filepath: tests/e2e/simulator/annotate.spec.ts
// ============================================================================
// SIMULATOR ANNOTATE MODE — real-browser coverage for the dev-tool notes
// feature (simulator/ only; never ships in the extension).
//
// The vitest suite (simulator/test/annotate*.test.*) covers the logic in
// jsdom, which has no layout and cannot load the Route B iframe URL. This
// spec proves the parts only a real browser can prove:
//   1. the classroom fixture iframe is SAME-ORIGIN (contentDocument reads),
//   2. pins land at the clicked element's percent inside real layout,
//   3. the export carries Target + Note lines.
//
// Server wiring: the simulator is a plain Vite app, so this spec starts its
// own dev server (strict port, readiness poll) in beforeAll and stops it in
// afterAll — the same self-managing pattern the headed/live specs use.
// Run it via `pnpm test:simulator-e2e` (project simulator-chromium); the
// extension lanes ignore this directory (playwright.config.ts testIgnore),
// and no CI lane invokes the simulator project.
// ============================================================================

import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const SIMULATOR_DIR = path.resolve(__dirname, '../../../simulator');
const PORT = 5199;
// Vite binds `localhost` (IPv6 ::1 on this machine), so the hostname — not
// 127.0.0.1 — is the address that works for the readiness poll and the
// browser. The clipboard permission origin must match it exactly.
const BASE = `http://localhost:${PORT}`;

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

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
      lastError = String(error).slice(0, 120);
    }
    await sleep(300);
  }
  throw new Error(`simulator dev server not ready at ${url}: ${lastError}`);
}

test.beforeAll(async () => {
  const viteBin = path.join(SIMULATOR_DIR, 'node_modules', '.bin', 'vite');
  server = spawn(viteBin, ['--port', String(PORT), '--strictPort'], {
    cwd: SIMULATOR_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr?.on('data', (chunk: Buffer) => process.stderr.write(`[vite] ${chunk}`));
  await waitForServer(BASE, 30_000);
});

test.afterAll(async () => {
  const current = server;
  server = null;
  if (!current) return;
  await new Promise<void>((resolve) => {
    current.once('exit', () => resolve());
    current.kill('SIGTERM');
    setTimeout(resolve, 5000).unref();
  });
});

async function toggleAnnotate(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Annotate' }).click();
  await expect(page.locator('.sim-annotate-layer')).toHaveCount(1);
}

async function saveEditorNote(page: CBPage, text: string): Promise<void> {
  await expect(page.locator('.sim-annotate-editor textarea')).toBeFocused();
  await page.locator('.sim-annotate-editor textarea').fill(text);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.sim-annotate-editor')).toHaveCount(0);
}

test.describe('simulator annotate mode (dev tool)', () => {
  test('Route B classroom fixture iframe is same-origin readable', async ({ page }) => {
    await page.goto(`${BASE}/#page=mixed-links-post-en`);
    await page.waitForSelector('iframe.sim-classroom-frame');
    // The renderers run on iframe load; give the fixture a beat to settle.
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe.sim-classroom-frame');
      return !!iframe?.contentDocument?.body?.querySelector('[data-stream-item-id]');
    });
    const info = await page.evaluate(() => {
      const iframe = document.querySelector('iframe.sim-classroom-frame')!;
      const doc = iframe.contentDocument!;
      return {
        origin: doc.location.origin,
        pageOrigin: location.origin,
        src: iframe.getAttribute('src'),
        posts: doc.body.querySelectorAll('[data-stream-item-id]').length,
      };
    });
    expect(info.origin).toBe(info.pageOrigin);
    expect(info.src).toBe('/sim/classroom/mixed-links-post-en.html');
    expect(info.posts).toBeGreaterThan(0);
  });

  test('Route A: annotate toggle, pin placement, editor focus, Escape', async ({ page }) => {
    await page.goto(`${BASE}/#popup=first-run`);
    await page.waitForSelector('.sim-popup-frame .cqd-app');
    await toggleAnnotate(page);

    // Click inside the popup frame at a known fraction of its box.
    const frame = await page.locator('.sim-popup-frame').boundingBox();
    await page.mouse.click(frame!.x + frame!.width * 0.6, frame!.y + frame!.height * 0.3);

    const pin = page.locator('button.sim-pin');
    await expect(pin).toHaveCount(1);
    // The pin points at the captured element's center; a click at 60% can
    // land on a node whose center sits a few percent away.
    const left = await pin.evaluate((el) => parseFloat(el.style.left));
    expect(Math.abs(left - 60)).toBeLessThan(10);

    // Dialog pattern: the note field takes focus; Escape on an UNSAVED pin
    // discards it (standard cancel semantics), so the pin disappears.
    await expect(page.locator('.sim-annotate-editor textarea')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sim-annotate-editor')).toHaveCount(0);
    await expect(pin).toHaveCount(0);

    // Place a fresh pin and save a real note; verify persistence.
    await page.mouse.click(frame!.x + frame!.width * 0.4, frame!.y + frame!.height * 0.6);
    await expect(page.locator('.sim-annotate-editor textarea')).toBeFocused();
    await page.locator('.sim-annotate-editor textarea').fill('Toast overlaps the ring on level 0');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.sim-annotate-editor')).toHaveCount(0);
    await expect(pin).toHaveCount(1);
    const stored = await page.evaluate(() =>
      localStorage.getItem('cqd-sim-annotations:v1:first-run'),
    );
    expect(stored).toContain('Toast overlaps the ring on level 0');
  });

  test('Route B: a click inside the fixture iframe places a pin in the wrap', async ({ page }) => {
    await page.goto(`${BASE}/#page=mixed-links-post-en`);
    await page.waitForSelector('iframe.sim-classroom-frame');
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe.sim-classroom-frame');
      return !!iframe?.contentDocument?.body?.querySelector('a[aria-label^="Attachment"]');
    });
    await toggleAnnotate(page);

    // Real coordinates: Playwright resolves the anchor box into page space.
    const anchor = page
      .frameLocator('iframe.sim-classroom-frame')
      .locator('a[aria-label^="Attachment"]')
      .first();
    const box = await anchor.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    const pin = page.locator('button.sim-pin');
    await expect(pin).toHaveCount(1);
    const stored = await page.evaluate(() =>
      localStorage.getItem('cqd-sim-annotations:v1:mixed-links-post-en'),
    );
    const note = JSON.parse(stored ?? '[]')[0];
    expect(note?.route).toBe('classroom');
    expect(note?.target?.kind).toBe('element');
    // The fixture attachment card sits under the click; its descriptor
    // carries the Classroom anchor classes and the file name.
    expect(note?.target?.path).toContain('a.VkhHKd');
    expect(String(note?.target?.text)).toMatch(/\.pdf/i);
  });

  test('Copy notes as Markdown emits Target and Note lines', async ({ page }) => {
    await page.goto(`${BASE}/#popup=first-run`);
    await page.waitForSelector('.sim-popup-frame .cqd-app');
    await toggleAnnotate(page);
    const frame = await page.locator('.sim-popup-frame').boundingBox();
    await page.mouse.click(frame!.x + frame!.width * 0.5, frame!.y + frame!.height * 0.5);
    await saveEditorNote(page, 'Export smoke note');

    await page.getByRole('button', { name: 'Copy notes as Markdown' }).click();
    const markdown = await page.evaluate(() => navigator.clipboard.readText());
    expect(markdown).toMatch(/^## SIMULATOR ANNOTATIONS — \d{4}-\d{2}-\d{2}T/);
    expect(markdown).toContain('### [1] first-run — First run');
    expect(markdown).toMatch(/- Target: .+ @ \d/);
    expect(markdown).toContain('- Note: Export smoke note');
    expect(markdown).toContain(`- Reproduce: ${BASE}/#popup=first-run`);
  });
});
