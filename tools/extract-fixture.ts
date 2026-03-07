/**
 * extract-fixture.ts
 *
 * Extracts test fixtures from captured Classroom HTML snapshots.
 * Strips PII (names, emails, profile photos, IDs) and saves clean HTML
 * for use in V2 unit/fixture tests.
 *
 * Usage:
 *   npx tsx tools/extract-fixture.ts <snapshot-html> [--output <dir>] [--page-type <type>] [--lang <lang>]
 *
 * Example:
 *   npx tsx tools/extract-fixture.ts verification/baseline/2026-03-06/snapshots/stream/snapshot.html \
 *     --output extension/tests/fixtures/classroom/ --page-type stream --lang en
 *
 * Output:
 *   <output-dir>/<page-type>-<lang>.html  (PII-stripped HTML fixture)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// PII Stripping Rules
// ============================================================================

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; description: string }> = [
  // Email addresses
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: 'student@testschool.edu',
    description: 'Email addresses',
  },
  // Google profile photo URLs
  {
    pattern: /https:\/\/lh[0-9]*\.googleusercontent\.com\/[^\s"']+/g,
    replacement: 'https://example.com/avatar-placeholder.png',
    description: 'Google profile photos',
  },
  // Google Cloud Storage URLs with personal data
  {
    pattern: /https:\/\/storage\.googleapis\.com\/[^\s"']+/g,
    replacement: 'https://example.com/storage-placeholder',
    description: 'Cloud storage URLs',
  },
  // authuser parameter values
  {
    pattern: /authuser=\d+/g,
    replacement: 'authuser=0',
    description: 'Auth user params',
  },
  // Class IDs in URLs (long numeric strings)
  {
    pattern: /(\/c\/)\d{10,}/g,
    replacement: '$1000000000000',
    description: 'Class IDs in URLs',
  },
  // Assignment/Material IDs in URLs
  {
    pattern: /(\/[am]\/)\d{10,}/g,
    replacement: '$1111111111111',
    description: 'Assignment/Material IDs',
  },
  // Student submission IDs
  {
    pattern: /(\/submissions\/)\d{10,}/g,
    replacement: '$1222222222222',
    description: 'Student submission IDs',
  },
  // Post IDs
  {
    pattern: /(\/p\/)\w{10,}/g,
    replacement: '$1postid000000',
    description: 'Post IDs',
  },
  // data-stream-item-id values (but keep the attribute)
  {
    pattern: /(data-stream-item-id=")[^"]+(")/g,
    replacement: '$1fixture-item-$2',
    description: 'Stream item IDs',
  },
  // data-drive-id values
  {
    pattern: /(data-drive-id=")[^"]+(")/g,
    replacement: '$1fixture-drive-id$2',
    description: 'Drive file IDs',
  },
  // data-id values (not data-stream-item-id)
  {
    pattern: /(data-id=")[^"]+(")/g,
    replacement: '$1fixture-id$2',
    description: 'Data ID values',
  },
  // Drive file IDs in URLs
  {
    pattern: /(\/file\/d\/)[a-zA-Z0-9_-]{20,}/g,
    replacement: '$1FIXTURE_DRIVE_FILE_ID_PLACEHOLDER',
    description: 'Drive file IDs in URLs',
  },
  // Names (common patterns in Classroom DOM)
  // Look for text in specific containers that likely contain names
  {
    pattern: /(aria-label=")[^"]*(?:posted|submitted|created|assigned|edited)[^"]*(")/gi,
    replacement: '$1Test User action$2',
    description: 'Aria labels with user actions',
  },
  // Numeric student IDs
  {
    pattern: /(studentId[=:]\s*["']?)\d{10,}/g,
    replacement: '$1333333333333',
    description: 'Student numeric IDs',
  },
];

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: npx tsx tools/extract-fixture.ts <snapshot-html> [--output <dir>] [--page-type <type>] [--lang <lang>]');
    process.exit(0);
  }

  const inputPath = args[0];
  const outputIdx = args.indexOf('--output');
  const pageTypeIdx = args.indexOf('--page-type');
  const langIdx = args.indexOf('--lang');

  const outputDir = outputIdx !== -1 ? args[outputIdx + 1] : 'extension/tests/fixtures/classroom/';
  const pageType = pageTypeIdx !== -1 ? args[pageTypeIdx + 1] : path.basename(path.dirname(inputPath));
  const lang = langIdx !== -1 ? args[langIdx + 1] : 'en';

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ File not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`\n🔧 CQD Fixture Extractor`);
  console.log(`   Input:     ${inputPath}`);
  console.log(`   Output:    ${outputDir}`);
  console.log(`   Page Type: ${pageType}`);
  console.log(`   Language:  ${lang}\n`);

  // Read input HTML
  let html = fs.readFileSync(inputPath, 'utf-8');
  const originalSize = html.length;

  // Apply PII stripping
  let strippedCount = 0;
  for (const rule of PII_PATTERNS) {
    const matches = html.match(rule.pattern);
    if (matches) {
      strippedCount += matches.length;
      html = html.replace(rule.pattern, rule.replacement);
      console.log(`   ✅ ${rule.description}: ${matches.length} occurrences stripped`);
    }
  }

  // Add fixture metadata comment at the top
  const fixtureComment = `<!--
  CQD Test Fixture
  Generated: ${new Date().toISOString()}
  Page Type: ${pageType}
  Language: ${lang}
  Source: ${path.basename(inputPath)}
  PII Stripped: ${strippedCount} occurrences
  
  WARNING: This file has been processed to remove PII.
  Do not use real Classroom HTML directly in tests.
-->
`;

  html = fixtureComment + html;

  // Write output
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${pageType}-${lang}.html`);
  fs.writeFileSync(outputPath, html, 'utf-8');

  const newSize = html.length;
  console.log(`\n   📊 Summary:`);
  console.log(`      Original: ${(originalSize / 1024).toFixed(0)}KB`);
  console.log(`      Stripped:  ${(newSize / 1024).toFixed(0)}KB`);
  console.log(`      PII items: ${strippedCount} removed`);
  console.log(`      Output:    ${outputPath}`);
}

main();
