// filepath: tests/e2e/global-setup.ts
/**
 * ============================================================================
 * PLAYWRIGHT GLOBAL SETUP — Build Extension Before Tests
 * ============================================================================
 *
 * Playwright calls this once before all tests. We use it to build the
 * extension so Chromium can load it.
 *
 * The WXT build outputs to extension/.output/chrome-mv3/ which is
 * what Chromium expects for --load-extension.
 *
 * @author Adham — the "obvious" step that took me 2 hours to figure out
 * @since v4.0.0
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export default async function globalSetup() {
  const extensionDir = path.resolve(__dirname, '../../extension');
  const outputDir = path.resolve(extensionDir, '.output/chrome-mv3');

  // Check if we need to rebuild
  // If the output directory exists and is recent (< 5 min), skip rebuild
  const needsBuild = !fs.existsSync(outputDir) ||
    !fs.existsSync(path.join(outputDir, 'manifest.json'));

  if (needsBuild) {
    console.log('\n🔨 Building extension for Playwright tests...');
    try {
      execSync('pnpm build', {
        cwd: extensionDir,
        stdio: 'pipe',
        timeout: 120_000, // 2 min timeout for build
      });
      console.log('✅ Extension built successfully');
    } catch (error) {
      console.error('❌ Extension build failed:', (error as Error).message);
      throw new Error('Failed to build extension. Run `pnpm -C extension build` to debug.');
    }
  } else {
    console.log('✅ Extension already built, skipping rebuild');
  }

  // Verify the manifest exists
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Extension manifest not found at ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`📦 Extension v${manifest.version} ready for testing\n`);
}
