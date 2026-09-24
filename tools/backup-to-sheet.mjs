#!/usr/bin/env node
// Builds the repo backup "sheet" from a wrangler d1 execute --json dump of the
// event_archive table, and optionally pushes it to the live Google Sheet when
// Google service-account credentials are provided.
//
// Usage:
//   node tools/backup-to-sheet.mjs <event-archive.json> <out-dir>
//     1st arg: JSON output of:
//       wrangler d1 execute SITE_CACHE_DB --remote --json \
//         "SELECT batch_id, kind, created_at_utc, event_count, weighted_count, archived_at_utc
//          FROM event_archive ORDER BY created_at_utc ASC"
//     2nd arg: directory that receives event-archive.csv + backup-summary.csv
//
// Optional Google Sheets push (runs only when BOTH env vars are set):
//   GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON — full service-account JSON key
//   GOOGLE_SHEETS_ID                   — target spreadsheet id
//   GOOGLE_SHEETS_RANGE                — default "Sheet1!A1"
// The spreadsheet must be shared with the service-account's client_email.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import crypto from 'node:crypto';

const [, , inputArg, outDirArg] = process.argv;
if (!inputArg || !outDirArg) {
  console.error('usage: node tools/backup-to-sheet.mjs <event-archive.json> <out-dir>');
  process.exit(1);
}
const outDir = resolve(outDirArg);
mkdirSync(outDir, { recursive: true });

function toIso(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '';
  return new Date(value).toISOString();
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n';
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(resolve(inputArg), 'utf8'));
} catch (error) {
  console.error(`FATAL: cannot read ${inputArg}: ${error.message}`);
  process.exit(1);
}

// wrangler d1 execute --json wraps rows in one of two shapes depending on
// version; normalize here.
const rows = Array.isArray(parsed)
  ? (parsed[0]?.results ?? [])
  : (parsed?.results ?? []);

const header = [
  'batch_id', 'kind', 'created_at_utc', 'created_at_iso',
  'event_count', 'weighted_count', 'archived_at_utc', 'archived_at_iso',
];
const body = rows.map((row) => [
  row.batch_id ?? '',
  row.kind ?? '',
  row.created_at_utc ?? '',
  toIso(row.created_at_utc),
  row.event_count ?? 0,
  row.weighted_count ?? 0,
  row.archived_at_utc ?? '',
  toIso(row.archived_at_utc),
]);

writeFileSync(join(outDir, 'event-archive.csv'), toCsv([header, ...body]));

// Summary: per-kind totals.
const byKind = new Map();
for (const row of body) {
  const kind = row[1] || 'unknown';
  const entry = byKind.get(kind) ?? { batches: 0, events: 0, weighted: 0 };
  entry.batches += 1;
  entry.events += Number(row[4]) || 0;
  entry.weighted += Number(row[5]) || 0;
  byKind.set(kind, entry);
}
const summaryRows = [
  ['kind', 'batches', 'event_count', 'weighted_count', 'generated_at_iso'],
  ...[...byKind.entries()].map(([kind, entry]) => [
    kind, entry.batches, entry.events, entry.weighted, new Date().toISOString(),
  ]),
];
writeFileSync(join(outDir, 'backup-summary.csv'), toCsv(summaryRows));

console.log(`backup sheet: ${body.length} archived batches -> ${join(outDir, 'event-archive.csv')}`);

// --- Optional Google Sheets push ------------------------------------------------

const serviceAccountRaw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
const sheetId = process.env.GOOGLE_SHEETS_ID;
if (!serviceAccountRaw || !sheetId) {
  console.log('Google Sheets push skipped (GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON / GOOGLE_SHEETS_ID not both set).');
  process.exit(0);
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key).toString('base64url');
  const assertion = `${header}.${claims}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`google token endpoint returned ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error('google token response missing access_token');
  }
  return payload.access_token;
}

try {
  const serviceAccount = JSON.parse(serviceAccountRaw);
  const token = await getAccessToken(serviceAccount);
  const range = process.env.GOOGLE_SHEETS_RANGE || 'Sheet1!A1';
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ values: [header, ...body] }),
    },
  );
  if (!updateResponse.ok) {
    const detail = await updateResponse.text().catch(() => '');
    throw new Error(`sheets update returned ${updateResponse.status}: ${detail.slice(0, 200)}`);
  }
  console.log(`Google Sheet ${sheetId} updated with ${body.length} rows.`);
} catch (error) {
  console.error(`Google Sheets push failed (repo backup still valid): ${error.message}`);
  process.exit(1);
}
