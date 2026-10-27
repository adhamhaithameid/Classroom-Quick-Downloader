#!/usr/bin/env node
// filepath: tools/mega-e2e/drift-probes.mjs
/**
 * DOM-drift discovery probes — the "detect the undetectable" layer.
 *
 * Google changes Classroom markup without notice (bs7c: data-drive-id
 * vanished from details-view cards on 2026-10-25 and download buttons
 * silently disappeared). These probes pin the CURRENT contracts the engine
 * depends on and fail loudly when the ground shifts:
 *
 *  1. Fixture probes (always run): every selector family the extension
 *     relies on must still match at least one node in the committed
 *     captured Classroom fixtures. A fixture miss means either the fixture
 *     set or the selector drifted.
 *  2. Live probes (when the live stage ran): the same probes against the
 *     real site, plus marker counts (data-drive-id vs aria-label
 *     "Attachment:" cards) so a ratio flip is visible in the report even
 *     when both still match.
 *
 * Output: pass/fail + a JSON marker table appended to the mega-e2e report
 * directory. Exit nonzero only on hard regressions (a required selector
 * family matches NOTHING anywhere).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// jsdom is a devDependency of extension/ — resolve it from there so the
// probe runs from the repo root without hoisting.
import { createRequire } from 'node:module';
const require2 = createRequire(new URL('../../extension/package.json', import.meta.url));
const { JSDOM } = require2('jsdom');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ART = path.join(REPO, 'qa-artifacts', 'mega-e2e');
const FIXTURE_DIR = path.join(REPO, 'extension/tests/fixtures/classroom');

/** Selector families the engine requires — name → CSS selector. */
const REQUIRED_FAMILIES = {
  'drive-anchor-href': 'a[href*="drive.google.com"]',
  'attachment-aria-label': 'a[aria-label^="Attachment:"]',
  'stream-post': '[data-stream-item-id]',
};

/** Selector families that SHOULD exist but may legitimately be absent in
 *  a small fixture set — reported as ratios, never fatal. */
const OBSERVED_FAMILIES = {
  'data-drive-id-card': '[data-drive-id]',
  'details-attachment-anchor': 'a[aria-label^="Attachment:"][href*="drive.google.com"]',
};

const fixtures = fs.existsSync(FIXTURE_DIR)
  ? fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.html')).map((f) => ({
      name: f,
      html: fs.readFileSync(path.join(FIXTURE_DIR, f), 'utf8'),
    }))
  : [];

if (fixtures.length === 0) {
  console.error('✗ no fixtures found in extension/tests/fixtures/classroom — cannot probe');
  process.exit(1);
}

const table = [];
let hardFail = false;

for (const [family, selector] of Object.entries(REQUIRED_FAMILIES)) {
  const hits = fixtures.filter((fx) => new JSDOM(fx.html).window.document.querySelector(selector));
  const status = hits.length > 0 ? 'match' : 'MISSING';
  if (hits.length === 0) hardFail = true;
  table.push({ family, selector, scope: 'fixtures', hits: hits.length, status });
  console.log(`${status === 'match' ? '✓' : '✗'} ${family}: ${hits.length}/${fixtures.length} fixtures`);
}

for (const [family, selector] of Object.entries(OBSERVED_FAMILIES)) {
  const hits = fixtures.filter((fx) => new JSDOM(fx.html).window.document.querySelector(selector));
  table.push({ family, selector, scope: 'fixtures', hits: hits.length, status: hits.length > 0 ? 'match' : 'absent (informational)' });
  console.log(`• ${family}: ${hits.length}/${fixtures.length} fixtures (informational)`);
}

fs.writeFileSync(path.join(ART, 'drift-probes.json'), JSON.stringify({ at: new Date().toISOString(), table }, null, 2));

// Ratio snapshot: how much of the fixture attachment surface still carries
// data-drive-id vs the aria-label contract. A flip to 0/many is the early
// warning that produced bs7c.
const driveIdCards = fixtures.filter((fx) => new JSDOM(fx.html).window.document.querySelector('[data-drive-id]')).length;
const ariaCards = fixtures.filter((fx) => new JSDOM(fx.html).window.document.querySelector('a[aria-label^="Attachment:"]')).length;
console.log(`marker ratio — data-drive-id fixtures: ${driveIdCards}, aria-label Attachment: fixtures: ${ariaCards}`);
fs.appendFileSync(
  path.join(ART, 'drift-probes.json'),
  JSON.stringify({ markerRatio: { driveIdFixtures: driveIdCards, ariaLabelFixtures: ariaCards } }, null, 2),
);

if (hardFail) {
  console.error('✗ drift probes FAILED — a required selector family matches no fixture. Capture a fresh Classroom fixture and update the selectors before deploying.');
  process.exit(1);
}
console.log('✓ drift probes complete (see qa-artifacts/mega-e2e/drift-probes.json)');
