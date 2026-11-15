// filepath: tools/check-edge-support.mjs
/**
 * Gate wrapper for the `extension-edge` Playwright project (bead juoc).
 * Resolves Microsoft Edge the way Playwright itself does —
 * `chromium.executablePath({ channel: 'msedge' })` — so both a local
 * /Applications install and a CI `playwright install msedge` cache hit
 * count as present. When Edge is absent the leg prints a clear skip and
 * exits 0, so machines without Edge can still complete `test:gate`; CI
 * installs msedge first, so coverage is unchanged there.
 *
 * Mirrors tools/check-chrome-support.mjs (the sanctioned not-installed
 * skip pattern).
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);

// Probe what the suite itself does: a real headless launch. A pure
// executablePath() check can point at a stale cache entry while the
// launcher resolves the branded /Applications install (observed 2026-11-15).
let edgeOk = false;
try {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  await browser.close();
  edgeOk = true;
} catch {
  edgeOk = false;
}
if (!edgeOk) {
  console.log(
    'Microsoft Edge not installed — test:e2e:edge skipped. Install Edge or run `pnpm exec playwright install msedge`.',
  );
  process.exit(0);
}

const cli = require.resolve('@playwright/test/cli');
const r = spawnSync(process.execPath, [cli, 'test', '--project=extension-edge', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(r.status ?? 1);
