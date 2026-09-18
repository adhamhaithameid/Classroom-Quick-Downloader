#!/usr/bin/env node
// Verifies the website, worker, and Oracle agree on the website-event contract.
// Run from the repo root:  node tools/verify-analytics-contract.mjs
// Exit 0 = contract agreed; exit 1 = drift between packages.

import { readFileSync } from 'node:fs';

const expectedTypes = ['cta', 'map', 'content'];
const expectedActions = ['install_click', 'download_click', 'map_yes', 'map_no', 'guide_cta_click', 'faq_expand', 'guide_engaged'];
const expectedActionToType = {
  install_click: 'cta',
  download_click: 'cta',
  map_yes: 'map',
  map_no: 'map',
  guide_cta_click: 'cta',
  faq_expand: 'content',
  guide_engaged: 'content',
};

function read(path) {
  // Paths are repo-root-relative; this file lives one level below it.
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function extractArray(source, constName) {
  const match = source.match(new RegExp(`${constName}\\s*=\\s*\\[([^\\]]*)\\]`, 's'));
  if (!match) return null;
  return [...match[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

const failures = [];

// 1) Website unions (source of truth for what clients may send)
const websiteTypesSource = read('website/src/lib/types/public.ts');
const eventTypeUnion = websiteTypesSource.match(/export type WebsiteEventType =([\s\S]*?);/)?.[1] ?? '';
for (const t of expectedTypes) {
  if (!eventTypeUnion.includes(`'${t}'`)) failures.push(`website WebsiteEventType union missing "${t}"`);
}
const actionUnion = websiteTypesSource.match(/export type WebsiteEventAction =([\s\S]*?);/)?.[1] ?? '';
for (const a of expectedActions) {
  if (!actionUnion.includes(`'${a}'`)) failures.push(`website WebsiteEventAction union missing "${a}"`);
}

// 2) Worker whitelist
const workerSource = read('cloudflare-worker/src/downloads_do.ts');
const workerTypes = extractArray(workerSource, 'WEBSITE_EVENT_TYPE_VALUES');
const workerActions = extractArray(workerSource, 'WEBSITE_EVENT_ACTION_VALUES');
if (!workerTypes || expectedTypes.some((t) => !workerTypes.includes(t))) {
  failures.push(`worker WEBSITE_EVENT_TYPE_VALUES drift: ${JSON.stringify(workerTypes)}`);
}
if (!workerActions || expectedActions.some((a) => !workerActions.includes(a))) {
  failures.push(`worker WEBSITE_EVENT_ACTION_VALUES drift: ${JSON.stringify(workerActions)}`);
}
for (const [action, type] of Object.entries(expectedActionToType)) {
  const mapMatch = workerSource.match(/WEBSITE_EVENT_ACTION_TO_TYPE[^=]*=\s*\{([\s\S]*?)\}/);
  const entry = new RegExp(`\\b${action}:\\s*"${type}"`);
  if (!mapMatch || !entry.test(mapMatch[1])) {
    failures.push(`worker action->type map wrong for ${action}`);
  }
}

// 3) Oracle whitelist
const oracleSource = read('oracle-backend/internal/handlers/public_website.go');
const oracleMapMatch = oracleSource.match(/publicWebsiteEventActionToType\s*=\s*map\[string\]string\{([\s\S]*?)\}/);
if (!oracleMapMatch) {
  failures.push('oracle publicWebsiteEventActionToType not found');
} else {
  for (const [action, type] of Object.entries(expectedActionToType)) {
    const entry = new RegExp(`"${action}":\\s*"${type}"`);
    if (!entry.test(oracleMapMatch[1])) failures.push(`oracle action->type map wrong for ${action}`);
  }
}
const oraclePlacementsMatch = oracleSource.match(/publicWebsiteEventAllowedPlacements\s*=\s*map\[string\]struct\{\}(\{[\s\S]*?\n\t\})/);
if (!oraclePlacementsMatch) {
  failures.push('oracle publicWebsiteEventAllowedPlacements not found');
} else {
  for (const placement of ['guide_primary', 'guide_secondary', 'faq_item', 'guide_scroll']) {
    if (!oraclePlacementsMatch[1].includes(`"${placement}"`)) {
      failures.push(`oracle placement whitelist missing "${placement}"`);
    }
  }
}

if (failures.length > 0) {
  console.error('[contract] DRIFT DETECTED:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('[contract] website, worker, and oracle agree on the website-event contract.');
