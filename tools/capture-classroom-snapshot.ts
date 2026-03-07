/**
 * capture-classroom-snapshot.ts
 *
 * Playwright script that captures DOM HTML + screenshots for each Google Classroom
 * page type. Used as Phase 0 baseline before any V2 refactoring.
 *
 * Usage:
 *   npx tsx tools/capture-classroom-snapshot.ts --profile <chrome-profile-dir> [--output <dir>]
 *
 * Prerequisites:
 *   - pnpm add -D playwright @playwright/test (in root)
 *   - A Chrome profile already logged into Google Classroom
 *
 * Output:
 *   <output-dir>/<page-type>/
 *     ├── snapshot.html     (full page HTML)
 *     ├── screenshot.png    (viewport screenshot)
 *     └── metadata.json     (URL, timestamp, viewport size, selectors found)
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Configuration
// ============================================================================

interface PageTarget {
  name: string;
  urlPattern: string;
  description: string;
  /** CSS selectors to check for presence (from selector-catalog.md) */
  checkSelectors: string[];
}

const PAGE_TARGETS: PageTarget[] = [
  {
    name: 'stream',
    urlPattern: '/c/{classId}',
    description: 'Stream (class home) — announcements and posts',
    checkSelectors: [
      'div[data-stream-item-id]',
      '.N5dSp',
      '.IMvYId',
      '.asQXV.QRiHXd',
    ],
  },
  {
    name: 'classwork_list',
    urlPattern: '/w/{classId}/t/all',
    description: 'Classwork list — all assignments and materials',
    checkSelectors: [
      'li[data-stream-item-id]',
      'li.tfGBod',
      '.jWCzBe.gmNu1d',
      '.qCWAqb.seqYL',
    ],
  },
  {
    name: 'classwork_topic',
    urlPattern: '/w/{classId}/tc/{topicId}',
    description: 'Topic Classwork — assignments filtered by topic',
    checkSelectors: [
      'div.sVNOQ[data-stream-item-id]',
      'div.etr9pd',
      'div.i8Wprc',
      '.RcHwO',
    ],
  },
  {
    name: 'assignment_details',
    urlPattern: '/c/{classId}/a/{itemId}/details',
    description: 'Assignment details — single assignment view',
    checkSelectors: [
      '[data-drive-id]',
      '[data-id][data-item-id]',
      '.KlRXdf',
    ],
  },
  {
    name: 'material_details',
    urlPattern: '/c/{classId}/m/{itemId}/details',
    description: 'Material details — single material view',
    checkSelectors: [
      '[data-drive-id]',
      '[data-id][data-item-id]',
    ],
  },
  {
    name: 'student_submissions',
    urlPattern: '/c/{classId}/a/{itemId}/submissions/{studentId}',
    description: 'Student submissions — individual student work',
    checkSelectors: [
      '[data-drive-id]',
    ],
  },
  {
    name: 'student_work_teacher',
    urlPattern: '/c/{classId}/a/{itemId}/submissions',
    description: 'Student work (teacher view) — all submissions',
    checkSelectors: [],
  },
  {
    name: 'announcement_detail',
    urlPattern: '/c/{classId}/p/{postId}',
    description: 'Announcement detail — single post view',
    checkSelectors: [
      'div[data-stream-item-id]',
      '.N5dSp',
    ],
  },
];

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const profileIdx = args.indexOf('--profile');
  const outputIdx = args.indexOf('--output');

  if (profileIdx === -1) {
    console.error('Usage: npx tsx tools/capture-classroom-snapshot.ts --profile <chrome-profile-dir> [--output <dir>]');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx tools/capture-classroom-snapshot.ts --profile ~/Library/Application\\ Support/Google/Chrome/Profile\\ 1');
    process.exit(1);
  }

  const profileDir = args[profileIdx + 1];
  const outputDir = outputIdx !== -1
    ? args[outputIdx + 1]
    : path.resolve('verification/baseline', new Date().toISOString().split('T')[0]);

  console.log(`\n📸 CQD Classroom Snapshot Capture`);
  console.log(`   Profile: ${profileDir}`);
  console.log(`   Output:  ${outputDir}\n`);

  // Launch Chrome with existing profile
  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage();

  console.log('🔑 Navigating to Google Classroom...');
  await page.goto('https://classroom.google.com/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Check if logged in
  const isLoggedIn = await page.evaluate(() => {
    return !window.location.href.includes('accounts.google.com');
  });

  if (!isLoggedIn) {
    console.error('❌ Not logged into Google Classroom. Please log in manually in the Chrome profile first.');
    await browser.close();
    process.exit(1);
  }

  console.log('✅ Logged into Google Classroom\n');

  // Interactive mode: user navigates to each page type
  for (const target of PAGE_TARGETS) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 Page: ${target.name}`);
    console.log(`   Description: ${target.description}`);
    console.log(`   URL Pattern: ${target.urlPattern}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n   👉 Please navigate to a ${target.name} page in the browser.`);
    console.log(`      Press Enter when ready to capture...\n`);

    // Wait for user to press Enter
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });

    await captureSnapshot(page, target, outputDir);
  }

  console.log('\n\n✅ All snapshots captured!');
  console.log(`   Output directory: ${outputDir}`);
  await browser.close();
}

async function captureSnapshot(page: Page, target: PageTarget, outputDir: string) {
  const targetDir = path.join(outputDir, 'snapshots', target.name);
  fs.mkdirSync(targetDir, { recursive: true });

  const currentUrl = page.url();
  console.log(`   Capturing: ${currentUrl}`);

  // Wait for content to load
  await page.waitForTimeout(2000);

  // 1. Screenshot
  const screenshotPath = path.join(targetDir, 'screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`   📷 Screenshot saved`);

  // 2. HTML snapshot
  const html = await page.content();
  const htmlPath = path.join(targetDir, 'snapshot.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`   📝 HTML snapshot saved (${(html.length / 1024).toFixed(0)}KB)`);

  // 3. Selector presence check
  const selectorResults: Record<string, { found: boolean; count: number }> = {};
  for (const selector of target.checkSelectors) {
    try {
      const count = await page.locator(selector).count();
      selectorResults[selector] = { found: count > 0, count };
    } catch {
      selectorResults[selector] = { found: false, count: 0 };
    }
  }

  // 4. Check CQD injection state
  const cqdState = await page.evaluate(() => {
    return {
      downloadButtons: document.querySelectorAll('.cqd-download-btn').length,
      downloadAllButtons: document.querySelectorAll('.cqd-download-all-btn').length,
      commentBadges: document.querySelectorAll('.cqd-comment-badge').length,
      editedBadges: document.querySelectorAll('.cqd-edited-badge').length,
      bothBadges: document.querySelectorAll('.cqd-both-badge').length,
      overlays: document.querySelectorAll('.cqd-overlay-container').length,
      posts: document.querySelectorAll('[data-stream-item-id]').length,
      driveAnchors: document.querySelectorAll('a[href*="drive.google.com"]').length,
      driveIdElements: document.querySelectorAll('[data-drive-id]').length,
      pageLanguage: document.documentElement.lang || 'unknown',
      pageDirection: document.documentElement.dir || document.body.dir || 'ltr',
    };
  });

  // 5. Metadata
  const metadata = {
    captureDate: new Date().toISOString(),
    pageType: target.name,
    url: currentUrl,
    urlPattern: target.urlPattern,
    viewport: { width: 1440, height: 900 },
    selectors: selectorResults,
    cqdState,
    files: {
      screenshot: 'screenshot.png',
      html: 'snapshot.html',
    },
  };

  const metadataPath = path.join(targetDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  console.log(`   📊 Metadata saved`);

  // Print summary
  console.log(`\n   Summary:`);
  console.log(`     Posts: ${cqdState.posts}`);
  console.log(`     Download buttons: ${cqdState.downloadButtons}`);
  console.log(`     Download All buttons: ${cqdState.downloadAllButtons}`);
  console.log(`     Comment badges: ${cqdState.commentBadges}`);
  console.log(`     Edited badges: ${cqdState.editedBadges}`);
  console.log(`     Both badges: ${cqdState.bothBadges}`);
  console.log(`     Drive anchors: ${cqdState.driveAnchors}`);
  console.log(`     Drive ID elements: ${cqdState.driveIdElements}`);
  console.log(`     Page language: ${cqdState.pageLanguage}`);
  console.log(`     Page direction: ${cqdState.pageDirection}`);

  // Print selector check
  console.log(`\n   Selector Check:`);
  for (const [selector, result] of Object.entries(selectorResults)) {
    const icon = result.found ? '✅' : '❌';
    console.log(`     ${icon} ${selector} (${result.count} found)`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
