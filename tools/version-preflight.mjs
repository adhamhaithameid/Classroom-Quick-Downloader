#!/usr/bin/env node
// Release version preflight (design: docs/superpowers/specs/2026-10-28--production-pipeline-design.md).
//
// Answers one question before a production release train publishes: for each
// store in the release set, is publishing needed, and can we verify it? The
// decision core is pure and unit-tested in tools/version-preflight.test.mjs;
// the probes are thin fetch wrappers with injectable fetch for tests.
//
// Verdicts per store:
//   publish-needed   extension version > live store version (or probe
//                    unknown but explicitly allowed)
//   current          live >= extension version — covers "already in review"
//                    and "already submitted" (retry-safe, no 409 surprise)
//   skipped          store not in the release set
//   missing-secrets  store in the release set but credentials absent  -> FAIL
//   unknown          store in the release set but probe failed            -> FAIL
//                    unless listed in --allow-unknown
//
// Usage:
//   node tools/version-preflight.mjs                      # probe + verdict, exit 1 on failure
//   node tools/version-preflight.mjs --json               # machine-readable verdict
//   node tools/version-preflight.mjs --release-set amo,cws
//   node tools/version-preflight.mjs --allow-unknown edge
// Credentials come from the same env vars the publish workflows use:
//   CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_ITEM_ID?/CWS_ITEM,
//   EDGE_API_KEY, EDGE_PRODUCT_ID,
//   AMO_JWT_ISSUER, AMO_JWT_SECRET, AMO_ADDON_SLUG.

import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ALL_STORES = ['cws', 'edge', 'amo'];

export function semverGt(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

/** AMO v5 API JWT: HS256, ~1 minute window, jti nonce (see extension/tools/sign-extension.mjs). */
export function buildAmoJwt(issuer, secret, nowMs = Date.now()) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { iss: issuer, jti: randomBytes(20).toString('hex'), iat: Math.floor(nowMs / 1000) - 5, exp: Math.floor(nowMs / 1000) + 60 };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

/**
 * Pure decision core. `probes` maps store -> {ok, live?, error?} for probed
 * stores; absent entries mean "not probed" (no credentials were present).
 */
export function classify({ extensionVersion, releaseSet, credentials, probes, allowUnknown = [] }) {
  const perStore = {};
  const failures = [];
  const publishSet = [];
  for (const store of ALL_STORES) {
    if (!releaseSet.includes(store)) {
      perStore[store] = { verdict: 'skipped' };
      continue;
    }
    const probe = probes[store];
    if (!probe || (!probe.ok && probe.missing)) {
      perStore[store] = { verdict: 'missing-secrets' };
      failures.push({ store, reason: 'missing-secrets' });
      continue;
    }
    if (!probe.ok) {
      const allowed = allowUnknown.includes(store);
      perStore[store] = { verdict: allowed ? 'unknown-allowed' : 'unknown', error: probe.error ?? 'probe failed' };
      if (allowed) publishSet.push(store);
      else failures.push({ store, reason: 'unknown' });
      continue;
    }
    const live = probe.live ?? null;
    if (semverGt(extensionVersion, live)) {
      perStore[store] = { verdict: 'publish-needed', live };
      publishSet.push(store);
    } else {
      perStore[store] = { verdict: 'current', live };
    }
  }
  return { perStore, publishSet, failures, extensionVersion };
}

// ---------------------------------------------------------------------------
// Probes (thin, fetch-injectable)
// ---------------------------------------------------------------------------

async function fetchJson(fetchImpl, url, opts = {}) {
  const res = await fetchImpl(url, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `http ${res.status}`, body };
  return { ok: true, body };
}

export async function probeAmo({ issuer, secret, addonSlug, fetchImpl = fetch }) {
  const token = buildAmoJwt(issuer, secret);
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${encodeURIComponent(addonSlug)}/versions/?filter=all_with_unlisted`;
  const authed = await fetchJson(fetchImpl, url, { headers: { Authorization: `JWT ${token}` } });
  // Known AMO behavior (2026-10-16+): version endpoints 404 for the owner
  // JWT on some add-on states. The LISTED add-on's versions are public data
  // — fall back to the unauthenticated GET, which cannot see in-review
  // versions (the publish leg's 409 skip covers that residue).
  let r = authed;
  let scope = 'includes unlisted/in-review versions';
  if (!authed.ok && authed.error === 'http 404') {
    r = await fetchJson(fetchImpl, url);
    scope = 'public versions only (JWT endpoint 404 — known AMO quirk); in-review versions unseen';
  }
  if (!r.ok) return r;
  const live = (r.body?.results ?? []).map((v) => v.version).sort(semverCmpDesc)[0] ?? null;
  return { ok: true, live, note: scope };
}

export async function probeCws({ clientId, clientSecret, refreshToken, itemId, fetchImpl = fetch }) {
  const tokenRes = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const tokenBody = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok) return { ok: false, error: `token http ${tokenRes.status}${tokenBody.error ? `: ${tokenBody.error}` : ''}` };
  const r = await fetchJson(fetchImpl, `https://www.googleapis.com/chromewebstore/v1.1/items/${encodeURIComponent(itemId)}`, { headers: { Authorization: `Bearer ${tokenBody.access_token}`, 'x-goog-api-version': '2' } });
  if (!r.ok) return r;
  const live = r.body?.version ?? null;
  return live ? { ok: true, live } : { ok: false, error: 'item response had no version' };
}

/**
 * Edge has NO product-read endpoint: the Update API
 * (https://api.addons.microsoftedge.microsoft.com) only exposes submission
 * upload/publish/operations (learn.microsoft.com, "Use the REST API to
 * update an extension", v1.1). So this probe validates credentials only:
 * a GET on a nonexistent operation id returns 404/400 with valid key+client
 * and 401/403 with invalid ones, touching no state. The live version is
 * derived from the CWS probe in main() (single-version repo: all stores
 * ship the same version; an Edge instance left behind self-heals on the
 * next bump — the 2026-10-20 lesson).
 */
export async function probeEdge({ apiKey, productId, clientId, fetchImpl = fetch }) {
  const r = await fetchJson(fetchImpl, `https://api.addons.microsoftedge.microsoft.com/v1/products/${encodeURIComponent(productId)}/submissions/draft/package/operations/00000000-0000-0000-0000-000000000000`, { headers: { Authorization: `ApiKey ${apiKey}`, 'X-ClientID': clientId } });
  if (r.ok || r.error === 'http 404' || r.error === 'http 400' || r.error === 'http 405') {
    return { ok: true, live: null, note: 'credentials valid; Edge API exposes no version read (derived from CWS)' };
  }
  return r;
}

/**
 * Probe exactly the release-set stores that have credentials. A probe that
 * throws is classified `unknown` (ok:false) — a network blip on one store
 * must never crash the CLI or leak into an unrelated release set.
 */
export async function runProbes({ releaseSet, credentials, impls }) {
  const probes = {};
  for (const store of ALL_STORES) {
    if (!releaseSet.includes(store) || !credentials[store]) continue;
    try {
      probes[store] = await impls[store](credentials[store]);
    } catch (err) {
      probes[store] = { ok: false, error: err?.message ?? 'probe threw' };
    }
  }
  return probes;
}

function semverCmpDesc(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pb[i] ?? 0) !== (pa[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Credential collection + CLI
// ---------------------------------------------------------------------------

export function collectCredentials(env = process.env) {
  const out = {};
  if (env.CWS_CLIENT_ID && env.CWS_CLIENT_SECRET && env.CWS_REFRESH_TOKEN) {
    out.cws = { clientId: env.CWS_CLIENT_ID, clientSecret: env.CWS_CLIENT_SECRET, refreshToken: env.CWS_REFRESH_TOKEN, itemId: env.CWS_ITEM_ID || env.CWS_ITEM || 'oemoongiefmpmomjikcjmkkkhffcbdid' };
  }
  if (env.EDGE_API_KEY && env.EDGE_PRODUCT_ID && env.EDGE_CLIENT_ID) {
    out.edge = { apiKey: env.EDGE_API_KEY, productId: env.EDGE_PRODUCT_ID, clientId: env.EDGE_CLIENT_ID };
  }
  if (env.AMO_JWT_ISSUER && env.AMO_JWT_SECRET) {
    out.amo = { issuer: env.AMO_JWT_ISSUER, secret: env.AMO_JWT_SECRET, addonSlug: env.AMO_ADDON_SLUG || 'classroom-quick-downloader' };
  }
  return out;
}

export function parseArgs(argv) {
  const get = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const releaseSetArg = get('--release-set');
  const allowUnknownArg = get('--allow-unknown');
  const splitList = (v, fallback) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback);
  return {
    releaseSet: splitList(releaseSetArg, ALL_STORES),
    allowUnknown: splitList(allowUnknownArg, []),
    extensionVersion: get('--extension-version') ?? null,
    json: argv.includes('--json'),
    allowNoProbeFail: argv.includes('--allow-no-probe-fail'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const extensionVersion = args.extensionVersion ?? JSON.parse(readFileSync(resolve('extension/package.json'), 'utf8')).version;
  const credentials = collectCredentials();

  const probes = await runProbes({
    releaseSet: args.releaseSet,
    credentials,
    impls: { cws: probeCws, edge: probeEdge, amo: probeAmo },
  });
  // Derive the Edge live version from the CWS probe: the Edge Update API
  // exposes no version read, and this repo ships one version to all stores.
  if (probes.edge?.ok && probes.edge.live == null && probes.cws?.ok) {
    probes.edge.live = probes.cws.live;
  }

  const verdict = classify({ extensionVersion, releaseSet: args.releaseSet, credentials, probes, allowUnknown: args.allowUnknown });

  if (args.json) {
    console.log(JSON.stringify({ ...verdict, args }, null, 2));
  } else {
    console.log(`[version-preflight] extension ${extensionVersion}`);
    for (const [store, info] of Object.entries(verdict.perStore)) {
      const live = info.live ? ` (live: ${info.live})` : '';
      console.log(`[version-preflight]   ${store}: ${info.verdict}${live}${info.error ? ` — ${info.error}` : ''}`);
    }
    console.log(`[version-preflight] publish set: ${verdict.publishSet.length ? verdict.publishSet.join(', ') : '(none — versions current everywhere)'}`);
  }
  // Failures must reach the run log in BOTH modes: stdout may be redirected
  // to a JSON file, so a silent exit(1) is undiagnosable from CI.
  for (const f of verdict.failures) {
    const detail = verdict.perStore[f.store]?.error ? ` — ${verdict.perStore[f.store].error}` : '';
    console.error(`[version-preflight] FAIL ${f.store}: ${f.reason}${detail}`);
  }

  if (verdict.failures.length > 0 && !args.allowNoProbeFail) process.exit(1);
}

const invokedDirectly = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error('[version-preflight] fatal:', err.message);
    process.exit(1);
  });
}
