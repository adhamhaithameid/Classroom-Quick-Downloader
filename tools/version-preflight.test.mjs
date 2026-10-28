#!/usr/bin/env node
// Unit tests for the release version preflight's decision core
// (tools/version-preflight.mjs). Pattern follows tools/pre-push-scope.test.mjs.
// Network probes are injectable (fetchImpl) and NOT exercised here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semverGt, buildAmoJwt, classify, parseArgs, runProbes, probeAmo, probeEdge } from './version-preflight.mjs';

test('semverGt: numeric segment compare, not string compare', () => {
  assert.equal(semverGt('1.9.3', '1.9.2'), true);
  assert.equal(semverGt('1.10.0', '1.9.99'), true);
  assert.equal(semverGt('2.0.0', '1.99.99'), true);
  assert.equal(semverGt('1.9.3', '1.9.3'), false);
  assert.equal(semverGt('1.9.2', '1.9.3'), false);
});

test('buildAmoJwt: three base64url segments decoding to alg HS256 + issuer', () => {
  const token = buildAmoJwt('user:123:456', 'secret-value', 1_700_000_000_000);
  const parts = token.split('.');
  assert.equal(parts.length, 3);
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  assert.equal(header.alg, 'HS256');
  assert.equal(header.typ, 'JWT');
  assert.equal(payload.iss, 'user:123:456');
  assert.ok(payload.exp > payload.iat);
  assert.ok(payload.jti.length >= 16);
});

const CREDS = {
  cws: { clientId: 'id', clientSecret: 'sec', refreshToken: 'rt', itemId: 'item' },
  edge: { apiKey: 'key', productId: 'prod', clientId: 'edge-client' },
  amo: { issuer: 'iss', secret: 'secret', addonSlug: 'slug' },
};

test('classify: all stores current -> no publish, no fail', () => {
  const r = classify({ extensionVersion: '1.9.3', releaseSet: ['cws', 'edge', 'amo'], credentials: CREDS, probes: { cws: { ok: true, live: '1.9.3' }, edge: { ok: true, live: '1.9.3' }, amo: { ok: true, live: '1.9.3' } } });
  assert.deepEqual(r.publishSet, []);
  assert.deepEqual(r.failures, []);
});

test('classify: bumped store is publish-needed, others current', () => {
  const r = classify({ extensionVersion: '1.9.4', releaseSet: ['cws', 'edge', 'amo'], credentials: CREDS, probes: { cws: { ok: true, live: '1.9.3' }, edge: { ok: true, live: '1.9.4' }, amo: { ok: true, live: '1.9.4' } } });
  assert.deepEqual(r.publishSet, ['cws']);
  assert.deepEqual(r.failures, []);
  assert.equal(r.perStore.edge.verdict, 'current');
});

test('classify: missing secrets for a release-set store fails closed', () => {
  const r = classify({ extensionVersion: '1.9.4', releaseSet: ['cws', 'edge', 'amo'], credentials: { cws: CREDS.cws }, probes: {} });
  assert.ok(r.failures.some((f) => f.store === 'edge' && f.reason === 'missing-secrets'));
  assert.ok(r.failures.some((f) => f.store === 'amo' && f.reason === 'missing-secrets'));
});

test('classify: probe failure fails closed unless allowUnknown lists the store', () => {
  const base = { extensionVersion: '1.9.4', releaseSet: ['cws', 'edge', 'amo'], credentials: CREDS, probes: { cws: { ok: true, live: '1.9.3' }, edge: { ok: false, error: 'http 503' }, amo: { ok: true, live: '1.9.4' } } };
  const blocked = classify(base);
  assert.deepEqual(blocked.failures, [{ store: 'edge', reason: 'unknown' }]);
  const allowed = classify({ ...base, allowUnknown: ['edge'] });
  assert.deepEqual(allowed.failures, []);
  assert.deepEqual(allowed.publishSet, ['cws', 'edge']);
});

test('classify: store outside the release set is skipped without credentials', () => {
  const r = classify({ extensionVersion: '1.9.4', releaseSet: ['amo'], credentials: {}, probes: {} });
  assert.equal(r.perStore.amo.verdict, 'missing-secrets');
  assert.equal(r.perStore.cws.verdict, 'skipped');
  assert.equal(r.perStore.edge.verdict, 'skipped');
});

test('classify: in-review/equal version counts as current (retry-safe)', () => {
  const r = classify({ extensionVersion: '1.9.4', releaseSet: ['amo'], credentials: CREDS.amo, probes: { amo: { ok: true, live: '1.9.4', note: 'in-review' } } });
  assert.deepEqual(r.publishSet, []);
  assert.equal(r.perStore.amo.verdict, 'current');
});

test('classify: rollback attempt (extension older than live) is current, never publish', () => {
  const r = classify({ extensionVersion: '1.9.1', releaseSet: ['cws'], credentials: CREDS.cws, probes: { cws: { ok: true, live: '1.9.3' } } });
  assert.deepEqual(r.publishSet, []);
  assert.equal(r.perStore.cws.verdict, 'current');
});

test('parseArgs: release set, allow-unknown, extension version, json', () => {
  const a = parseArgs(['--release-set', 'cws,amo', '--allow-unknown', 'edge', '--extension-version', '1.9.9', '--json']);
  assert.deepEqual(a.releaseSet, ['cws', 'amo']);
  assert.deepEqual(a.allowUnknown, ['edge']);
  assert.equal(a.extensionVersion, '1.9.9');
  assert.equal(a.json, true);
});

test('parseArgs: defaults are all stores, no allowlist', () => {
  const a = parseArgs([]);
  assert.deepEqual(a.releaseSet, ['cws', 'edge', 'amo']);
  assert.deepEqual(a.allowUnknown, []);
  assert.equal(a.extensionVersion, null);
});

test('runProbes: probes only release-set stores with credentials', async () => {
  const probed = [];
  const impls = {
    cws: async () => { probed.push('cws'); return { ok: true, live: '1.0.0' }; },
    edge: async () => { probed.push('edge'); return { ok: true, live: '1.0.0' }; },
    amo: async () => { probed.push('amo'); return { ok: true, live: '1.0.0' }; },
  };
  const probes = await runProbes({ releaseSet: ['amo'], credentials: { amo: {}, cws: {} }, impls });
  assert.deepEqual(probed, ['amo']);
  assert.equal(probes.amo.ok, true);
  assert.equal(probes.cws, undefined);
});

test('runProbes: a throwing probe becomes ok:false, never a fatal error', async () => {
  const impls = {
    cws: async () => { throw new Error('socket hang up'); },
    edge: async () => ({ ok: true, live: '1.0.0' }),
    amo: async () => ({ ok: true, live: '1.0.0' }),
  };
  const probes = await runProbes({ releaseSet: ['cws', 'edge', 'amo'], credentials: { cws: {}, edge: {}, amo: {} }, impls });
  assert.equal(probes.cws.ok, false);
  assert.match(probes.cws.error, /socket hang up/);
  assert.equal(probes.edge.ok, true);
});

test('probeAmo: 404 on the JWT endpoint falls back to the public GET (known AMO owner-JWT quirk)', async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ authed: Boolean(opts.headers?.Authorization) });
    if (opts.headers?.Authorization) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({ results: [{ version: '1.9.3' }, { version: '1.9.2' }] }) };
  };
  const r = await probeAmo({ issuer: 'i', secret: 's', addonSlug: 'slug', fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.live, '1.9.3');
  assert.match(r.note, /public versions only/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].authed, true);
  assert.equal(calls[1].authed, false);
});

test('probeAmo: non-404 auth failures stay failed (no silent downgrade)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const r = await probeAmo({ issuer: 'i', secret: 's', addonSlug: 'slug', fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'http 401');
});

test('probeEdge: valid credentials (404 on dummy operation) pass with no live version', async () => {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, headers: opts.headers });
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const r = await probeEdge({ apiKey: 'k', productId: 'p', clientId: 'c', fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.live, null);
  assert.match(r.note, /no version read/);
  assert.equal(calls[0].headers['X-ClientID'], 'c');
  assert.match(calls[0].headers.Authorization, /^ApiKey /);
  assert.match(calls[0].url, /api\.addons\.microsoftedge\.microsoft\.com/);
});

test('probeEdge: 401/403 stays failed (bad credentials)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const r = await probeEdge({ apiKey: 'k', productId: 'p', clientId: 'c', fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'http 401');
});

test('classify: Edge with no live version (edge-only set) is publish-needed, not a crash', () => {
  const r = classify({ extensionVersion: '1.9.4', releaseSet: ['edge'], credentials: CREDS.edge, probes: { edge: { ok: true, live: null, note: 'credentials valid' } } });
  assert.deepEqual(r.publishSet, ['edge']);
  assert.deepEqual(r.failures, []);
});
