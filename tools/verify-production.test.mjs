// Regression guard for the production verifier's legacy-host check: a
// verifier with no test is an unverified verifier (bead sqa9.4). The fixture
// server replays the two production states that mattered:
//   301 → the healthy contract (rhq's expected state)
//   200 + HTML → the regression state, where the JS-redirect fallback masks
//                the failure from users while splitting crawl budget
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { checkLegacyRedirect } from './check-legacy-redirect.mjs';

const CANONICAL = 'classroom-quick-downloader.adhamhaithameid.is-a.dev';

function startFixture(handler) {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function withFixture(handler, run) {
  const { server, port } = await startFixture(handler);
  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('passes when the legacy host 301s to the canonical domain', async () => {
  await withFixture(
    (_req, res) => {
      res.writeHead(301, { Location: `https://${CANONICAL}/` });
      res.end();
    },
    (base) =>
      checkLegacyRedirect({ legacyBase: base, canonicalHost: CANONICAL }).then((location) =>
        assert.equal(location, `https://${CANONICAL}/`)
      )
  );
});

test('fails when the legacy host serves 200 with full HTML (the rhq regression)', async () => {
  await withFixture(
    (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><html><body>full site markup</body></html>');
    },
    (base) =>
      assert.rejects(checkLegacyRedirect({ legacyBase: base, canonicalHost: CANONICAL }), {
        message: 'HTTP 200, expected 301'
      })
  );
});

test('fails when the 301 targets somewhere other than the canonical domain', async () => {
  await withFixture(
    (_req, res) => {
      res.writeHead(301, { Location: 'https://evil.example/' });
      res.end();
    },
    (base) =>
      assert.rejects(checkLegacyRedirect({ legacyBase: base, canonicalHost: CANONICAL }), {
        message: 'redirect target https://evil.example/'
      })
  );
});
