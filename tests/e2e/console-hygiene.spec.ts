// filepath: tests/e2e/console-hygiene.spec.ts
// ============================================================================
// CONSOLE HYGIENE — S5 black-box armor (audit
// docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md, finding S5).
//
// Fire-and-forget chrome.runtime/tabs.sendMessage without a lastError-
// consuming callback makes Chrome log "Unchecked runtime.lastError: The
// message port closed before a response was received." in the SENDER's
// console. The highest-frequency site was sendStatusToTab: a user closing
// the Classroom tab mid-download means the eventual status update fires
// into a dead tab. Deterministic repro (real user journey, core-flow
// fixture recipe):
//   mock Classroom material post -> click the CQD download button ->
//   close the tab while the download is in flight -> the background
//   settles the download and sends CQD_DOWNLOAD_STATUS to the closed tab.
// The pre-S5 build logged the unchecked lastError in the service-worker
// console; a hygiene-clean extension logs NOTHING.
// ============================================================================

import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import fs from 'node:fs';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension/.output/chrome-mv3');
const FIXTURES_DIR = path.resolve(__dirname, '../../extension/tests/fixtures/classroom');
const STREAM_URL = 'https://classroom.google.com/c/course-1';
const DOWNLOAD_BTN = 'button.cqd-download-btn';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8');

const MATERIAL_POST = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Classroom</title></head>
  <body style="margin:0;padding:24px;font-family:Roboto,Arial,sans-serif">
    ${readFileSync(path.join(FIXTURES_DIR, 'classwork-material-post-en.html'), 'utf8')}
  </body>
</html>`;

test.describe('download status console hygiene (S5)', () => {
  test.describe.configure({ timeout: 120_000 });

  let context: BrowserContext;
  let server: https.Server;
  let sw: Worker | undefined;
  const swNoise: string[] = [];

  test.beforeEach(async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cqd-hyg-'));
    const key = path.join(tmp, 'key.pem');
    const cert = path.join(tmp, 'cert.pem');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048',
      '-keyout', key, '-out', cert,
      '-days', '2', '-nodes', '-subj', '/CN=drive.usercontent.google.com',
    ], { stdio: 'ignore' });
    server = https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="server-file.pdf"' });
      res.end(PDF);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;

    context = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--disable-default-apps',
        '--ignore-certificate-errors',
        `--host-resolver-rules=MAP drive.usercontent.google.com 127.0.0.1:${port}`,
      ],
    });

    // Capture service-worker console noise. The MV3 SW starts on install;
    // attach to the registration event AND any worker already running.
    const attach = (worker: Worker) => {
      worker.on('console', (msg) => {
        if (msg.type() === 'error' && /Unchecked runtime\.lastError/i.test(msg.text())) {
          swNoise.push(msg.text());
        }
      });
      if (!sw) sw = worker;
    };
    context.on('serviceworker', attach);
    for (const existing of context.serviceWorkers()) attach(existing);
  });

  test.afterEach(async () => {
    await context.close();
    await new Promise<void>((r) => server?.close(() => r()));
  });

  test('status update to a tab closed mid-download logs no unchecked lastError', async () => {
    await context.route('https://classroom.google.com/**', (route) => {
      if (route.request().resourceType() === 'document' && new URL(route.request().url()).hostname === 'classroom.google.com') {
        void route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: MATERIAL_POST });
        return;
      }
      void route.fulfill({ status: 204, body: '' });
    });
    const page = await context.newPage();
    await page.goto(STREAM_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(DOWNLOAD_BTN, { timeout: 20_000 });

    // Start the download, then close the tab while it is in flight.
    await page.click(DOWNLOAD_BTN);
    await sleep(700);
    await page.close();
    await sleep(8_000); // mock drive settles; background sends status to the dead tab

    expect(swNoise, JSON.stringify(swNoise)).toEqual([]);
  });
});
