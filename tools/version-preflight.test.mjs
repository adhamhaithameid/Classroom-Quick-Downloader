#!/usr/bin/env node
// Unit tests for the release version preflight's decision core
// (tools/version-preflight.mjs). Pattern follows tools/pre-push-scope.test.mjs.
// Network probes are injectable (fetchImpl) and NOT exercised here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semverGt, buildAmoJwt, classify, parseArgs } from './version-preflight.mjs';

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
  edge: { apiKey: 'key', productId: 'prod' },
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
