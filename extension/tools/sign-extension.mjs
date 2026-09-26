// filepath: extension/tools/sign-extension.mjs
/**
 * sign-extension.mjs — sign the Firefox (MV2) build via Mozilla's
 * addons-server API v5 (S11 T3, owner-blocked leg of the E2E matrix).
 *
 * Why hand-rolled: `web-ext sign` would drag in the whole web-ext CLI and its
 * dependency tree for one HTTP flow. The AMO signing API is two calls (PUT
 * the zip, poll for the signed download), auth is a plain HS256 JWT, and
 * node:crypto + global fetch cover both with zero new dependencies.
 *
 * Flow (https://addons.mozilla.org/api/v5/):
 *   1. PUT /addons/<id>/versions/<version>/  (multipart `upload` field)
 *   2. Poll GET the same URL until the version's `file` object appears
 *      (validation + signing happens server-side; `unlisted` signs
 *      automatically, `listed` only after human review approval).
 *   3. GET the file url -> write the signed xpi + a metadata json.
 *
 * Environment:
 *   AMO_JWT_ISSUER  (required) AMO API key issuer
 *                   (https://addons.mozilla.org/developers/addon/api/key/)
 *   AMO_JWT_SECRET  (required) the matching AMO API key secret
 *   AMO_ADDON_ID    (optional) add-on GUID or slug. Default: the gecko id
 *                   from wxt.config.ts (classroom-quick-downloader@…).
 *   AMO_XPI_PATH    (optional) zip to upload. Default: newest
 *                   extension/.output/*-firefox.zip (pnpm -C extension firefox).
 *   AMO_CHANNEL     (optional) "unlisted" (default) or "listed".
 *   AMO_BASE_URL    (optional) default https://addons.mozilla.org.
 *   AMO_POLL_TIMEOUT_MS (optional) default 180000.
 *
 * Output:
 *   extension/.output/signed.xpi       — the AMO-signed package
 *   extension/.output/signed.xpi.json  — version metadata (guid, version,
 *                                        file hash/url, timestamps)
 *
 * CI: .github/workflows/ci.yml (extension-e2e) runs this only when the
 * AMO_JWT_ISSUER / AMO_JWT_SECRET repo secrets exist, then drives the
 * qa-firefox-signed Playwright project against the signed xpi.
 *
 * Usage:
 *   AMO_JWT_ISSUER=… AMO_JWT_SECRET=… pnpm -C extension sign:extension
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(EXTENSION_ROOT, '.output');
const FIREFOX_MANIFEST = path.join(OUTPUT_DIR, 'firefox-mv2', 'manifest.json');
const SIGNED_XPI_PATH = path.join(OUTPUT_DIR, 'signed.xpi');
const SIGNED_META_PATH = path.join(OUTPUT_DIR, 'signed.xpi.json');
const DEFAULT_ADDON_ID = 'classroom-quick-downloader@adhamhaitham.dev';
const POLL_INTERVAL_MS = 3_000;

/** Exit with a formatted, actionable error. */
function fail(message) {
  console.error(`✗ sign-extension: ${message}`);
  process.exit(1);
}

/** Resolve and validate env; every problem is reported before exiting. */
function readEnv() {
  const missing = ['AMO_JWT_ISSUER', 'AMO_JWT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    fail(
      `missing required environment variable(s): ${missing.join(', ')}. ` +
        `Create an API key at https://addons.mozilla.org/developers/addon/api/key/ ` +
        `and export AMO_JWT_ISSUER + AMO_JWT_SECRET before running this script.`,
    );
  }
  const channel = process.env.AMO_CHANNEL ?? 'unlisted';
  if (channel !== 'listed' && channel !== 'unlisted') {
    fail(`AMO_CHANNEL must be "listed" or "unlisted", got "${channel}".`);
  }
  return {
    issuer: process.env.AMO_JWT_ISSUER,
    secret: process.env.AMO_JWT_SECRET,
    addonId: process.env.AMO_ADDON_ID || DEFAULT_ADDON_ID,
    channel,
    baseUrl: (process.env.AMO_BASE_URL || 'https://addons.mozilla.org').replace(/\/+$/, ''),
    pollTimeoutMs: Number(process.env.AMO_POLL_TIMEOUT_MS || 180_000),
  };
}

/** Newest *-firefox.zip in .output (what `pnpm -C extension firefox` produces). */
function findDefaultZip() {
  const zips = fs.existsSync(OUTPUT_DIR)
    ? fs
        .readdirSync(OUTPUT_DIR)
        .filter((f) => f.endsWith('-firefox.zip'))
        .map((f) => path.join(OUTPUT_DIR, f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    : [];
  return zips[0] ?? null;
}

/** Version of the uploaded build: manifest first, zip filename as fallback. */
function resolveVersion(xpiPath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(FIREFOX_MANIFEST, 'utf8'));
    if (manifest.version) return manifest.version;
  } catch {
    /* fall through to filename parsing */
  }
  const match = path.basename(xpiPath).match(/-([0-9]+(?:\.[0-9]+)+)-firefox\.zip$/);
  if (match) return match[1];
  fail(
    `cannot determine the version to sign for ${path.basename(xpiPath)} — ` +
      `no ${path.relative(EXTENSION_ROOT, FIREFOX_MANIFEST)} and no "-<version>-firefox.zip" name. ` +
      `Run pnpm -C extension firefox first.`,
  );
}

/** Minimal HS256 JWT per the AMO auth contract (iss + jti + iat + exp <= iat+5min). */
function makeJwt(issuer, secret) {
  const b64url = (value) => Buffer.from(value).toString('base64url');
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({ iss: issuer, jti: randomUUID(), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300 }),
  );
  const input = `${head}.${body}`;
  const sig = createHmac('sha256', secret).update(input).digest('base64url');
  return `${input}.${sig}`;
}

/** Describe an API failure with everything needed to act on it. */
function apiError(context, status, bodyText) {
  let detail = bodyText?.slice(0, 1500) ?? '';
  try {
    const json = JSON.parse(bodyText);
    if (json.error) detail = json.error;
    if (json.validation_errors) detail = JSON.stringify(json.validation_errors, null, 2);
    if (json.detail) detail = json.detail;
  } catch {
    /* keep raw text */
  }
  const hints = {
    401: 'JWT rejected — check AMO_JWT_ISSUER/AMO_JWT_SECRET and that this machine’s clock is accurate.',
    403: 'Credentials are valid but not allowed to modify this add-on — check AMO_ADDON_ID ownership.',
    404: 'Add-on or version not found under this account — check AMO_ADDON_ID (GUID or slug).',
    409: 'This version already exists on AMO. For unlisted channels the signed file is simply polled — if this persists unexpectedly, bump extension/package.json version or delete the AMO version.',
  };
  return new Error(`AMO API ${context} failed (HTTP ${status}): ${detail}${hints[status] ? `\nhint: ${hints[status]}` : ''}`);
}

/**
 * Create flow for a guid AMO has never seen (addons-server docs: the
 * version PUT "will either update an existing add-on … or will create a
 * new add-on if the guid does not exist" only via the addon-resource PUT,
 * which requires a prior processed+valid upload):
 *   1. POST /api/v5/addons/upload/   (file + channel)
 *   2. GET  /api/v5/addons/upload/<uuid>/  until processed && valid
 *   3. PUT  /api/v5/addons/addon/<guid>/  { upload: uuid }
 * Returns true when the version now exists (poll of versionUrl will find it).
 */
async function createNewAddon(env, jwt, xpiPath, versionUrl, version) {
  const form = new FormData();
  form.append(
    'upload',
    new Blob([new Uint8Array(fs.readFileSync(xpiPath))], { type: 'application/octet-stream' }),
    path.basename(xpiPath),
  );
  form.append('channel', env.channel);
  const upRes = await fetch(`${env.baseUrl}/api/v5/addons/upload/`, {
    method: 'POST',
    headers: { Authorization: `JWT ${jwt}` },
    body: form,
  });
  if (!upRes.ok) {
    console.error(`create flow: upload POST failed (${upRes.status}): ${await upRes.text()}`);
    return false;
  }
  const { uuid } = await upRes.json();
  console.log(`✓ File uploaded (uuid ${uuid}) — waiting for AMO validation…`);
  const deadline = Date.now() + env.pollTimeoutMs;
  while (Date.now() < deadline) {
    const st = await fetch(`${env.baseUrl}/api/v5/addons/upload/${uuid}/`, {
      headers: { Authorization: `JWT ${jwt}` },
    });
    if (st.ok) {
      const j = await st.json();
      if (j.processed && j.valid) break;
      if (j.processed && !j.valid) {
        console.error(`create flow: AMO validation failed:\n${JSON.stringify(j.validation, null, 2)}`);
        return false;
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  const createRes = await fetch(`${env.baseUrl}/api/v5/addons/addon/${encodeURIComponent(env.addonId)}/`, {
    method: 'PUT',
    headers: { Authorization: `JWT ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: { version, upload: uuid, channel: env.channel } }),
  });
  if (!createRes.ok) {
    if (createRes.status === 409) {
      // "Version 1.8.0 already exists" — an earlier run (or store upload)
      // already registered this version. The version resource is exactly
      // what the poll step below needs, so treat this as success and fetch
      // its signed file. Re-runs of CI for the same package version stay
      // green instead of wedging the signed-Firefox leg.
      console.log('ℹ Version already exists on AMO — polling for its signed file…');
      return true;
    }
    console.error(`create flow: addon PUT failed (${createRes.status}): ${await createRes.text()}`);
    return false;
  }
  console.log('✓ Add-on created from upload.');
  return true;
}

async function main() {
  const env = readEnv();

  const xpiPath = process.env.AMO_XPI_PATH || findDefaultZip();
  if (!xpiPath || !fs.existsSync(xpiPath)) {
    fail(
      xpiPath
        ? `AMO_XPI_PATH does not exist: ${xpiPath}`
        : `no *-firefox.zip found in ${OUTPUT_DIR} — run pnpm -C extension firefox first.`,
    );
  }
  const version = resolveVersion(xpiPath);
  const versionUrl = `${env.baseUrl}/api/v5/addons/${encodeURIComponent(env.addonId)}/versions/${encodeURIComponent(version)}/`;
  console.log(`✶ Signing ${path.basename(xpiPath)} (v${version}, channel=${env.channel}) for ${env.addonId}`);

  // 1. Upload: PUT the zip as the multipart `upload` field.
  const jwt = makeJwt(env.issuer, env.secret);
  const form = new FormData();
  form.append(
    'upload',
    new Blob([new Uint8Array(fs.readFileSync(xpiPath))], { type: 'application/octet-stream' }),
    path.basename(xpiPath),
  );
  form.append('channel', env.channel);
  const putRes = await fetch(versionUrl, {
    method: 'PUT',
    headers: { Authorization: `JWT ${jwt}` },
    body: form,
  });
  if (putRes.status === 404) {
    // The version PUT cannot create a NEW add-on (addons-server returns 404).
    // Fallback: the documented create flow — POST the file to /upload/,
    // poll validation, then PUT the addon resource with the upload uuid.
    console.log('ℹ Version endpoint 404 — add-on not on AMO yet; running the create flow…');
    const created = await createNewAddon(env, jwt, xpiPath, versionUrl, version);
    if (!created) {
      fail((await apiError('upload', putRes.status, await putRes.text())).message);
    }
  } else if (!putRes.ok) {
    fail((await apiError('upload', putRes.status, await putRes.text())).message);
  }
  console.log('✓ Uploaded — AMO is validating/signing the version…');

  // 2. Poll until the signed file object exists (validation is async).
  // The single-version detail endpoint 404s for some server-side states
  // even when the addon-resource PUT reports the version as existing, so
  // every round also walks the add-on's full version list (filter=all is
  // required to see unlisted versions) looking for the signed file.
  const findSignedFile = async () => {
    const getRes = await fetch(versionUrl, { headers: { Authorization: `JWT ${jwt}` } });
    if (getRes.ok) {
      const json = await getRes.json();
      if (json.validation_errors) {
        fail(`AMO rejected the upload:\n${JSON.stringify(json.validation_errors, null, 2)}`);
      }
      if (json.file?.url) return json.file;
    }
    const listRes = await fetch(
      `${env.baseUrl}/api/v5/addons/${encodeURIComponent(env.addonId)}/versions/?filter=all`,
      { headers: { Authorization: `JWT ${jwt}` } },
    );
    if (listRes.ok) {
      const list = await listRes.json().catch(() => null);
      const match = (list?.results ?? []).find((v) => v?.version === version);
      if (match?.file?.url) return match.file;
    }
    return null;
  };
  const deadline = Date.now() + env.pollTimeoutMs;
  let file = null;
  let lastDiagAt = 0;
  while (Date.now() < deadline) {
    file = await findSignedFile();
    if (file?.url) break;
    if (Date.now() - lastDiagAt > 30_000) {
      lastDiagAt = Date.now();
      const detail = await fetch(versionUrl, { headers: { Authorization: `JWT ${jwt}` } });
      const list = await fetch(
        `${env.baseUrl}/api/v5/addons/${encodeURIComponent(env.addonId)}/versions/?filter=all`,
        { headers: { Authorization: `JWT ${jwt}` } },
      );
      const listBody = list.ok ? await list.json().catch(() => null) : null;
      const versions = (listBody?.results ?? []).map((v) => v?.version).slice(0, 6);
      console.log(
        `… waiting: version detail HTTP ${detail.status}, version list HTTP ${list.status}` +
          (versions.length ? ` (latest: ${versions.join(', ')})` : ' (no versions visible)') +
          ` — ${Math.round((deadline - Date.now()) / 1000)}s left`,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  if (!file?.url) {
    fail(
      `signing did not complete within ${env.pollTimeoutMs} ms. Check the version manually: ${versionUrl}` +
        (env.channel === 'listed' ? ' (listed channels sign only after review approval.)' : '') +
        ` If the version exists but exposes no file, its server-side state is stuck — ` +
        `delete that version on AMO (or bump extension/package.json) and re-run.`,
    );
  }

  // 3. Download the signed package + write metadata.
  const xpiRes = await fetch(file.url, { headers: { Authorization: `JWT ${jwt}` } });
  if (!xpiRes.ok) fail((await apiError('download', xpiRes.status, await xpiRes.text())).message);
  const bytes = Buffer.from(await xpiRes.arrayBuffer());
  if (bytes.length === 0) fail('downloaded signed xpi is empty — refusing to write it.');
  fs.writeFileSync(SIGNED_XPI_PATH, bytes);

  const metadata = {
    addon: env.addonId,
    version,
    channel: env.channel,
    sourceZip: path.resolve(xpiPath),
    signedXpi: SIGNED_XPI_PATH,
    fileHash: `sha256:${file.hash ?? 'n/a'}`,
    fileUrl: file.url,
    signedAt: new Date().toISOString(),
  };
  fs.writeFileSync(SIGNED_META_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`✓ Signed xpi written to ${path.relative(EXTENSION_ROOT, SIGNED_XPI_PATH)} (${bytes.length} bytes)`);
  console.log(`✓ Metadata written to ${path.relative(EXTENSION_ROOT, SIGNED_META_PATH)}`);
}

main().catch((error) => fail(error?.message ?? String(error)));
