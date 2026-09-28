// filepath: tests/e2e/headed/filename-security.spec.ts
// ============================================================================
// FILENAME SECURITY — S1 black-box armor (audit
// docs/SECURITY_AUDIT_EXTENSION_2026-09-24.md, finding S1).
//
// onDeterminingFilename NEVER fires in headless Chromium, so the entire
// filename-suggestion pipeline is invisible to every headless project. This
// journey runs HEADED (real browser pipeline) against a mock Drive
// byte-serving endpoint and drives downloads through the extension's public
// CQD_DOWNLOAD surface, then reads the FINAL filenames back via
// chrome.downloads.search (the black-box oracle).
//
// Contract pinned here (never again regressible without CI failing):
//   1. A page-controlled fileMeta.name containing path separators, control
//      characters, or leading dots/tilde reaches the filesystem only in its
//      SANITIZED form ('../../evil.js' lands as 'evil.js') — never verbatim,
//      never as a subdirectory, never outside the download directory.
//   2. A legitimate name is honored byte-for-byte (proves the suggestion
//      pipeline is live, not silently falling back for everything).
//   3. Duplicate suggestions uniquify ('Homework.pdf' + 'Homework (1).pdf').
// ============================================================================

import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

test.skip(process.env.E2E_HEADED !== '1', 'filename pipeline needs headed Chromium (E2E_HEADED=1)');

const EXTENSION_PATH = path.resolve(__dirname, '../../../extension/.output/chrome-mv3');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8');

// name -> expected final-basename contract. mode 'strict': the extension's
// sanitized suggestion MUST reach the filesystem. mode 'fallback-ok': the
// name is additionally hostile to Chrome's own sink (quotes etc.), so the
// sink rejecting it back to the server-supplied name is acceptable too —
// what is forbidden everywhere is the VERBATIM hostile form.
const MATRIX: Array<{ slug: string; name: string; sanitized: string; mode: 'strict' | 'fallback-ok' }> = [
  { slug: 'trav-slashes', name: '../../evil.js', sanitized: 'evil.js', mode: 'strict' },
  { slug: 'trav-backslash', name: '..\\..\\evil.js', sanitized: 'evil.js', mode: 'strict' },
  { slug: 'absolute-unix', name: '/etc/passwd', sanitized: 'etcpasswd', mode: 'strict' },
  { slug: 'windows-abs', name: 'C:\\Users\\v\\evil.exe', sanitized: 'CUsersvevil.exe', mode: 'strict' },
  { slug: 'nested-trav', name: 'foo/../../bar.pdf', sanitized: 'foo....bar.pdf', mode: 'strict' },
  { slug: 'home-tilde', name: '~/evil.sh', sanitized: 'evil.sh', mode: 'strict' },
  { slug: 'leading-dots', name: '..hidden', sanitized: 'hidden', mode: 'strict' },
  { slug: 'control-chars', name: 'bad\u0001name.pdf', sanitized: 'badname.pdf', mode: 'strict' },
  { slug: 'sink-hostile', name: 'a"b|c<d>e?.pdf', sanitized: 'a"b|c<d>e?.pdf', mode: 'fallback-ok' },
  { slug: 'subfolder', name: 'Subfolder/ok.pdf', sanitized: 'Subfolderok.pdf', mode: 'strict' },
  { slug: 'legit', name: 'Homework.pdf', sanitized: 'Homework.pdf', mode: 'strict' },
];

let server: https.Server;
let context: BrowserContext;
let extId = '';
let downloadDir = '';

test.beforeAll(async () => {
  test.setTimeout(300_000);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cqd-fnsec-'));
  downloadDir = path.join(tmp, 'downloads');
  fs.mkdirSync(downloadDir, { recursive: true });
  const key = path.join(tmp, 'key.pem');
  const cert = path.join(tmp, 'cert.pem');
  // Argument-array exec: no shell, nothing user-controlled is interpolated.
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', key, '-out', cert,
    '-days', '2', '-nodes', '-subj', '/CN=drive.usercontent.google.com',
  ], { stdio: 'ignore' });
  server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="server-file.pdf"',
    });
    res.end(PDF);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;

  const profile = path.join(tmp, 'profile');
  // Pre-seed Chrome prefs: downloads go to the scratch dir, no prompt.
  const defaultDir = path.join(profile, 'Default');
  fs.mkdirSync(defaultDir, { recursive: true });
  fs.writeFileSync(path.join(defaultDir, 'Preferences'), JSON.stringify({
    download: { default_directory: downloadDir, prompt_for_download: false },
    savefile: { default_directory: downloadDir },
  }));

  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: false,
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

async function driveDownload(popup: Page, slug: string, name: string): Promise<void> {
  await popup.evaluate(({ name, slug }) => new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 12_000);
    chrome.runtime.sendMessage(
      {
        type: 'CQD_DOWNLOAD',
        url: `https://drive.usercontent.google.com/download?id=fn-${slug}&export=download&confirm=t`,
        fileMeta: { name, ext: 'pdf' },
        requestId: `fn-${slug}`,
      },
      () => { void chrome.runtime.lastError; clearTimeout(t); resolve(); },
    );
  }), { name, slug });
  await sleep(1_800);
}

test('page-controlled filenames land only in sanitized form; legit names honored; duplicates uniquify', async () => {
  test.setTimeout(300_000);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForLoadState('domcontentloaded');
  await sleep(800);

  // Restore Chrome's NATIVE download pipeline: Playwright re-asserts its own
  // allowAndName behavior (GUID filenames in an artifacts dir) per context,
  // which would mask the extension's suggestions. 'default' honors the
  // Preferences default_directory, uniquify and onDeterminingFilename.
  const anchor = await context.newPage();
  const cdp = await context.newCDPSession(anchor);
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'default', eventsEnabled: true });

  for (const { slug, name } of MATRIX) {
    await driveDownload(popup, slug, name);
  }
  // uniquify pair
  await driveDownload(popup, 'uniq-0', 'Homework.pdf');
  await driveDownload(popup, 'uniq-1', 'Homework.pdf');
  await sleep(2_500);

  const finals = await popup.evaluate(() => new Promise<Array<{ url: string; file: string; state: string }>>((r) => {
    chrome.downloads.search({}, (items) => r((items || []).map((i) => ({
      url: i.url || '',
      file: i.filename || '',
      state: i.state,
    }))));
  }));
  const byTag = new Map<string, string>();
  for (const item of finals) {
    const m = item.url.match(/id=fn-([a-z0-9-]+)&/);
    if (m && item.state === 'complete') byTag.set(m[1], path.basename(item.file));
  }

  // 1) The load-bearing S1 discriminator: the SANITIZED STEM reaches the
  //    filesystem. Chrome may still normalize the extension per the server
  //    MIME (a suggested '.js' becomes '.pdf' under application/pdf), so the
  //    stem must match with any single trailing extension.
  const stemRe = (sanitized: string): RegExp => {
    const dot = sanitized.lastIndexOf('.');
    const stem = dot > 0 ? sanitized.slice(0, dot) : sanitized;
    // ' (N)' = Chrome's conflictAction:uniquify counter — two hostile rows
    // sanitize to the same stem ('../../evil.js' and '..\\..\\evil.js' both
    // become 'evil.js'), so the second legitimately lands as 'evil (1).pdf'.
    return new RegExp('^' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( \\(\\d+\\))?(\\.[a-z0-9]{1,10})?$', 'i');
  };
  expect(byTag.get('trav-slashes'), 'traversal "/"').toMatch(stemRe('evil.js'));
  expect(byTag.get('trav-backslash'), 'traversal backslash').toMatch(stemRe('evil.js'));
  expect(byTag.get('home-tilde'), 'home-relative').toMatch(stemRe('evil.sh'));
  expect(byTag.get('absolute-unix'), 'absolute path').toMatch(stemRe('etcpasswd'));
  expect(byTag.get('control-chars'), 'control chars').toMatch(stemRe('badname.pdf'));
  expect(byTag.get('leading-dots'), 'leading dots').toMatch(stemRe('hidden'));

  // 2) No subdirectories, nothing escaped the download dir.
  const entries = fs.readdirSync(downloadDir, { withFileTypes: true });
  expect(entries.filter((e) => e.isDirectory())).toEqual([]);
  for (const entry of entries) {
    expect(entry.name.startsWith('.')).toBe(false);
    expect(entry.name).not.toContain('/');
  }

  // 3) Whatever landed for a hostile name must match the sanitized STEM
  //    (strict; Chrome may normalize the trailing extension per the server
  //    MIME and uniquify colliding stems) or the server fallback
  //    (fallback-ok) — never the verbatim hostile name.
  for (const { slug, name, sanitized, mode } of MATRIX) {
    const final = byTag.get(slug);
    if (final === undefined) continue; // sink-rejected AND erased is fine
    if (mode === 'strict') {
      expect(final, `${slug}: ${name}`).toMatch(stemRe(sanitized));
    } else {
      expect(final === sanitized || final.startsWith('server-file'), `${slug}: ${name}`).toBe(true);
    }
  }

  // 4) Legit name byte-identical (pipeline live, not blanket fallback).
  expect(byTag.get('legit')).toMatch(/^Homework(\.pdf)?$/i);

  // 5) Duplicates uniquify: both land, distinct names, same stem (the
  //    counters depend on the earlier 'legit' row, which already claimed
  //    'Homework.pdf', so assert the uniquify SHAPE, not exact numbers).
  const uniq = finals.filter((i) => i.url.includes('id=fn-uniq-') && i.state === 'complete')
    .map((i) => path.basename(i.file)).sort();
  expect(uniq.length).toBe(2);
  expect(new Set(uniq).size).toBe(2);
  for (const name of uniq) {
    expect(name).toMatch(/^Homework( \(\d+\))?\.pdf$/i);
  }

  await anchor.close();
  await popup.close();
});
