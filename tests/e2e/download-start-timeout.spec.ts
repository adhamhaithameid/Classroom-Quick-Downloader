// filepath: tests/e2e/download-start-timeout.spec.ts
// ============================================================================
// DOWNLOAD START TIMEOUT — S2 black-box armor (audit
// docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md, finding S2 / functional F1).
//
// A host that accepts the TCP connection but never responds used to make
// chrome.downloads.download's callback never fire, leaving the CQD_DOWNLOAD
// sendResponse dangling (button in retry until the 150s stall reap). The fix
// races every start against DOWNLOAD_START_TIMEOUT_MS (15s) and settles with
// an honest DOWNLOAD_START_TIMEOUT error.
//
// Black-box contract: from a real extension page, a download against a
// hanging host produces a settled response within ~20s with started:false,
// and the service worker stays healthy. Reproduces headless (audit L1), so
// this runs under the regular headless projects.
// ============================================================================

import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const EXTENSION_PATH = path.resolve(__dirname, '../../extension/.output/chrome-mv3');

let server: https.Server;
let context: BrowserContext;
let extId = '';
let hits = 0;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cqd-hang-'));
  const key = path.join(tmp, 'key.pem');
  const cert = path.join(tmp, 'cert.pem');
  // Argument-array exec: no shell, nothing user-controlled is interpolated.
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', key, '-out', cert,
    '-days', '2', '-nodes', '-subj', '/CN=drive.usercontent.google.com',
  ], { stdio: 'ignore' });
  server = https.createServer(
    { key: fs.readFileSync(key), cert: fs.readFileSync(cert) },
    // Accept the connection, read the request, then hang forever.
    (req) => {
      hits += 1;
      req.resume();
    },
  );
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;

  context = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
      '--ignore-certificate-errors',
      `--host-resolver-rules=MAP drive.usercontent.google.com 127.0.0.1:${port}`,
    ],
  });
  let sw = context.serviceWorkers().find((w) => w.url().includes('background.js'));
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 20_000 });
  extId = new URL(sw.url()).host;
});

test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((r) => server?.close(() => r()));
});

test('a hanging download host settles CQD_DOWNLOAD honestly within the start timeout', async () => {
  test.setTimeout(120_000);
  const popup = await context.newPage();
  await popup.bringToFront();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForLoadState('domcontentloaded');

  // Race on the NODE side: in-page setTimeout gets intensively throttled in
  // headless/hidden pages, so the settle-wait must not live in the page.
  const started = Date.now();
  const evaluateSettle = popup.evaluate(() => new Promise<{ settled: boolean; resp?: { started?: boolean; userMessage?: string } }>((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'CQD_DOWNLOAD',
        url: 'https://drive.usercontent.google.com/download?id=hang-guard&export=download&confirm=t',
        fileMeta: { name: 'hang-guard.pdf', ext: 'pdf' },
        requestId: 'hang-guard-1',
      },
      (resp) => resolve({ settled: true, resp }),
    );
  }));
  const nodeTimeout = sleep(30_000).then(() => ({ settled: false as const }));
  const raced = await Promise.race([evaluateSettle, nodeTimeout]);
  const result = { ...raced, elapsedMs: Date.now() - started };

  // THE contract: the response settles (pre-fix it never did) within the
  // start-timeout budget (+ generous CI slack), with an honest started:false.
  expect(result.settled, JSON.stringify(result)).toBe(true);
  expect(result.elapsedMs).toBeLessThan(25_000);
  expect(result.resp?.started).toBe(false);
  expect(String(result.resp?.userMessage)).toMatch(/never responded|try again/i);

  // The extension must still be alive and serving messages afterwards.
  const sw = context.serviceWorkers().find((w) => w.url().includes(extId));
  expect(sw).toBeTruthy();
  await popup.close();
});
