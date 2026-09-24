// filepath: tests/e2e/zen/zen-extension.mjs
/**
 * ============================================================================
 * ZEN BROWSER EXTENSION SMOKE — WebDriver harness (Playwright cannot drive
 * stock Gecko builds)
 * ============================================================================
 *
 * Zen Browser is a Firefox fork. Playwright's Firefox engine speaks Juggler,
 * a protocol compiled only into Playwright's own Firefox build, so a stock
 * Gecko binary (Zen, and for the same reason the installed Firefox.app) can
 * only be automated over WebDriver/Marionette. This harness drives Zen
 * through geckodriver with zero npm dependencies (plain fetch).
 *
 * Verified against the platform's hard limits (2026-09-19, see beads):
 *   - WebDriver (classic AND BiDi) refuses navigation to moz-extension://
 *     and about: pages, so the popup UI cannot be driven here.
 *   - moz:profile breaks session create ("Invalid byte 45").
 * What IS verifiable, and what this harness asserts:
 *   1. Zen launches under automation (headless by default; E2E_HEADED=1 opts
 *      into a visible window, same switch as the Playwright suites).
 *   2. The built firefox-mv2 extension installs (temporary addon install) —
 *      Zen honours xpinstall.signatures.required=false, so the unsigned zip
 *      is accepted, unlike Playwright's bundled Firefox.
 *   3. The content script INJECTS on a classroom.google.com fixture: a PAC
 *      pref routes that host to a local CONNECT proxy serving self-signed
 *      TLS, and acceptInsecureCerts lets the navigation through — the page
 *      is the real classroom origin as far as the extension is concerned.
 *   4. Screenshot evidence under qa-artifacts/zen-<runid>/.
 *
 * Usage:
 *   node tests/e2e/zen/zen-extension.mjs            # headless
 *   E2E_HEADED=1 node tests/e2e/zen/zen-extension.mjs
 *   ZEN_BINARY=/path/to/zen node tests/e2e/zen/zen-extension.mjs
 *   GECKODRIVER=/path/to/geckodriver node tests/e2e/zen/zen-extension.mjs
 *
 * Exit codes: 0 pass, 1 test failure, 2 environment problem (missing
 * browser/geckodriver).
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const EXTENSION_OUTPUT = path.join(REPO_ROOT, "extension/.output");
const ARTIFACTS = path.join(REPO_ROOT, "qa-artifacts");
const ADDON_ID = "classroom-quick-downloader@adhamhaitham.dev";
// Fixed moz-extension UUID seeded via the uuids pref so the (future) popup
// URL is deterministic — the same pattern the prepared Playwright profile uses.
const ADDON_UUID = "ca1dd00d-0000-4000-8000-00000000ca1d";
const GECKODRIVER_VERSION = process.env.GECKODRIVER_VERSION ?? "0.36.0";
const HEADLESS = process.env.E2E_HEADED !== "1";
const PAGE_URL = "https://classroom.google.com/c/course-1/a/work-1/submissions/student-1";
const BUTTON_SELECTOR = "button.cqd-download-btn";

let passed = 0;
let failed = 0;
function check(description, ok, details = "") {
  if (ok) {
    passed += 1;
    console.log(`  ✅ ${description}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${description}${details ? ` — ${details}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Environment resolution (browser binary, geckodriver, extension zip)
// ---------------------------------------------------------------------------

function findZenBinary() {
  if (process.env.ZEN_BINARY) return process.env.ZEN_BINARY;
  const candidates = [
    "/Applications/Zen Browser.app/Contents/MacOS/zen", // pre-rebrand name
    "/Applications/Zen.app/Contents/MacOS/zen",
    "/usr/bin/zen-browser",
    "/usr/bin/zen",
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function geckodriverTarget() {
  const arch = process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "64" : null;
  if (!arch) return null;
  const platform =
    process.platform === "darwin" ? `macos-${arch}` : process.platform === "linux" ? (arch === "aarch64" ? "linux-aarch64" : "linux64") : null;
  if (!platform) return null;
  const archiveExt = process.platform === "win32" ? ".zip" : ".tar.gz";
  const assetPlatform = process.platform === "win32" ? "win64" : platform;
  return {
    dir: path.join(os.tmpdir(), `cqd-geckodriver-${GECKODRIVER_VERSION}-${platform}`),
    url: `https://github.com/mozilla/geckodriver/releases/download/v${GECKODRIVER_VERSION}/geckodriver-v${GECKODRIVER_VERSION}-${assetPlatform}${archiveExt}`,
    archiveExt,
  };
}

/** Locate or download geckodriver (brew is NOT required; mirrors Playwright's auto-provisioning). */
function ensureGeckodriver() {
  if (process.env.GECKODRIVER) return process.env.GECKODRIVER;
  const which = spawnSync("which", ["geckodriver"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  const target = geckodriverTarget();
  if (!target) throw new Error("no geckodriver on PATH and platform unsupported for auto-download");
  const bin = path.join(target.dir, process.platform === "win32" ? "geckodriver.exe" : "geckodriver");
  if (fs.existsSync(bin)) return bin;
  fs.mkdirSync(target.dir, { recursive: true });
  const archive = path.join(target.dir, `geckodriver${target.archiveExt}`);
  console.log(`⬇️  downloading geckodriver ${GECKODRIVER_VERSION} (${target.url})`);
  spawnSync("curl", ["-fsSL", "--retry", "3", "-o", archive, target.url], { stdio: "inherit" });
  if (!fs.existsSync(archive)) throw new Error(`geckodriver download failed from ${target.url}`);
  if (target.archiveExt === ".tar.gz") spawnSync("tar", ["-xzf", archive, "-C", target.dir], { stdio: "inherit" });
  else spawnSync("unzip", ["-o", archive, "-d", target.dir], { stdio: "inherit" });
  fs.chmodSync(bin, 0o755);
  return bin;
}

/** The firefox-mv2 zip the same way global-setup.ts finds it; build if absent. */
function ensureFirefoxZip() {
  const listZips = () =>
    fs.existsSync(EXTENSION_OUTPUT) ? fs.readdirSync(EXTENSION_OUTPUT).filter((f) => f.endsWith("-firefox.zip")) : [];
  let zips = listZips();
  if (zips.length === 0) {
    console.log("🔨 building firefox-mv2 extension zip...");
    const build = spawnSync("pnpm", ["-C", "extension", "firefox"], { cwd: REPO_ROOT, stdio: "inherit" });
    if (build.status !== 0) throw new Error("pnpm -C extension firefox failed");
    zips = listZips();
  }
  const newest = zips
    .map((f) => path.join(EXTENSION_OUTPUT, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (!newest) throw new Error("firefox-mv2 zip not found after build");
  return newest;
}

// ---------------------------------------------------------------------------
// classroom.google.com fixture over a local CONNECT proxy + self-signed TLS
// (Firefox has no --host-resolver-rules / --ignore-certificate-errors; PAC +
// acceptInsecureCerts are the supported equivalents.)
// ---------------------------------------------------------------------------

const FIXTURE_HTML = `<!doctype html>
<html>
  <body>
    <main>
      <div data-stream-item-id="submission-1" style="padding:24px;">
        <a href="https://drive.google.com/file/d/1ZenFixtureFile/view">Student attachment</a>
      </div>
    </main>
  </body>
</html>`;

function makeSelfSignedCert() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cqd-zen-cert-"));
  const key = path.join(tmp, "key.pem");
  const cert = path.join(tmp, "cert.pem");
  const r = spawnSync(
    "openssl",
    ["req", "-x509", "-newkey", "rsa:2048", "-keyout", key, "-out", cert, "-days", "2", "-nodes", "-subj", "/CN=classroom.google.com"],
    { stdio: "ignore" },
  );
  if (r.status !== 0) throw new Error("openssl key generation failed");
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

/** Serves ANY tls connection the fixture page (the proxy is the only client). */
function startFixtureTlsServer(cert) {
  const server = tls.createServer({ key: cert.key, cert: cert.cert }, (socket) => {
    socket.on("data", () => {
      socket.write(
        `HTTP/1.1 200 OK\r\ncontent-type: text/html; charset=utf-8\r\ncontent-length: ${Buffer.byteLength(FIXTURE_HTML)}\r\n\r\n${FIXTURE_HTML}`,
        () => socket.end(),
      );
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

/** Minimal CONNECT proxy: forwards the tunnel to the fixture TLS server. */
function startConnectProxy(targetPort) {
  const server = net.createServer((client) => {
    let header = "";
    client.on("data", function onData(chunk) {
      header += chunk.toString();
      if (!header.includes("\r\n\r\n")) return;
      client.removeListener("data", onData);
      const m = header.match(/^CONNECT ([^\s]+) HTTP/);
      if (m) client.write("HTTP/1.1 200 Connection established\r\n\r\n");
      const upstream = net.connect(targetPort, "127.0.0.1", () => {
        client.pipe(upstream);
        upstream.pipe(client);
      });
      upstream.on("error", () => client.destroy());
    });
    client.on("error", () => {});
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

// ---------------------------------------------------------------------------
// geckodriver lifecycle + WebDriver plumbing
// ---------------------------------------------------------------------------

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function startGeckodriver(bin) {
  return new Promise(async (resolve, reject) => {
    const port = await freePort();
    const proc = spawn(bin, ["--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
    let ready = false;
    const deadline = Date.now() + 15_000;
    proc.stdout.on("data", (chunk) => {
      if (ready) return;
      // geckodriver logs "Listening on 127.0.0.1:<port>" once serving.
      if (String(chunk).includes("Listening")) {
        ready = true;
        resolve({ proc, port });
      }
    });
    const timer = setInterval(() => {
      if (ready) return clearInterval(timer);
      if (Date.now() > deadline) {
        clearInterval(timer);
        reject(new Error("geckodriver did not start within 15s"));
      }
    }, 200);
    proc.on("exit", (code) => reject(new Error(`geckodriver exited early (${code})`)));
  });
}

class WebDriver {
  constructor(port, sessionId) {
    this.base = `http://127.0.0.1:${port}`;
    this.sessionId = sessionId;
  }
  static async createSession(port, capabilities, timeoutMs = 60_000) {
    const res = await fetch(`http://127.0.0.1:${port}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ capabilities: { alwaysMatch: capabilities } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json();
    if (!body.value?.sessionId) {
      throw new Error(`session create failed: ${JSON.stringify(body.value ?? body).slice(0, 400)}`);
    }
    return new WebDriver(port, body.value.sessionId);
  }
  async command(method, endpoint, body, timeoutMs = 30_000) {
    const res = await fetch(`${this.base}${endpoint}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let value;
    try {
      value = JSON.parse(text).value;
    } catch {
      value = text;
    }
    if (value && typeof value === "object" && value.error) {
      const err = new Error(`WebDriver ${value.error}: ${value.message}`);
      err.webdriver = value.error;
      throw err;
    }
    return value;
  }
  async execute(script, args = []) {
    return this.command("POST", `/session/${this.sessionId}/execute/sync`, { script, args });
  }
  async waitFor(fnScript, timeoutMs, pollMs = 500) {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
      last = await this.execute(fnScript);
      if (last) return last;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return last;
  }
  async close() {
    await this.command("DELETE", `/session/${this.sessionId}`).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// The smoke
// ---------------------------------------------------------------------------

async function main() {
  const zen = findZenBinary();
  if (!zen || !fs.existsSync(zen)) {
    console.error("❌ Zen binary not found. Install Zen or set ZEN_BINARY=/path/to/zen");
    process.exit(2);
  }
  console.log(`🧭 Zen binary: ${zen} (${HEADLESS ? "headless" : "HEADED via E2E_HEADED=1"})`);

  const geckodriverBin = ensureGeckodriver();
  console.log(`🛞 geckodriver: ${geckodriverBin}`);
  const { proc: gdProc, port: gdPort } = await startGeckodriver(geckodriverBin);

  const zip = ensureFirefoxZip();
  console.log(`📦 extension zip: ${path.basename(zip)}`);

  const cert = makeSelfSignedCert();
  const fixture = await startFixtureTlsServer(cert);
  const proxy = await startConnectProxy(fixture.port);
  const pacPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cqd-zen-pac-")), "route.pac");
  fs.writeFileSync(
    pacPath,
    `function FindProxyForURL(url, host) { if (host === "classroom.google.com") return "PROXY 127.0.0.1:${proxy.port}"; return "DIRECT"; }`,
  );

  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const artifactDir = path.join(ARTIFACTS, `zen-${runId}`);
  fs.mkdirSync(artifactDir, { recursive: true });

  let session;
  try {
    session = await WebDriver.createSession(gdPort, {
      browserName: "firefox",
      acceptInsecureCerts: true,
      "moz:firefoxOptions": {
        binary: zen,
        args: HEADLESS ? ["-headless", "-no-remote", "-new-instance"] : ["-no-remote", "-new-instance"],
        prefs: {
          "xpinstall.signatures.required": false,
          "extensions.autoDisableScopes": 0,
          "extensions.enabledScopes": 15,
          "extensions.experiments.enabled": true,
          // Deterministic moz-extension:// UUID for the addon (pref-seeded).
          "extensions.webextensions.uuids": JSON.stringify({ [ADDON_ID]: ADDON_UUID }),
          // PAC routing: classroom.google.com -> local fixture proxy.
          "network.proxy.type": 2,
          "network.proxy.autoconfig_url": `file://${pacPath}`,
          "browser.shell.checkDefaultBrowser": false,
          "browser.startup.homepage_override.mstone": "ignore",
          "datareporting.policy.dataSubmissionEnabled": false,
          "toolkit.telemetry.enabled": false,
          "app.update.auto": false,
        },
        // NOTE: no moz:profile here — passing one fails session create on
        // Zen + geckodriver 0.36 ("Invalid byte 45"). geckodriver makes its
        // own isolated temp profile, and the prefs above are applied to it.
      },
    });
    check("Zen launches under WebDriver (headless)", true);

    const installed = await session.command(
      "POST",
      `/session/${session.sessionId}/moz/addon/install`,
      { path: zip, temporary: true },
      45_000,
    );
    check("firefox-mv2 extension installs (temporary)", installed === ADDON_ID || typeof installed === "string", `returned: ${String(installed).slice(0, 80)}`);

    // Injection: navigate to the classroom origin served by the local proxy
    // and wait for the sidecar button the content script adds.
    await session.command("POST", `/session/${session.sessionId}/url`, { url: PAGE_URL }, 45_000);
    const injected = await session.waitFor(`return Boolean(document.querySelector('${BUTTON_SELECTOR}'))`, 25_000);
    check(`content script injects on classroom fixture (${BUTTON_SELECTOR})`, injected === true);

    const url = await session.execute(`return location.href`);
    check("fixture served on the real classroom origin", String(url).startsWith("https://classroom.google.com"), `url: ${String(url).slice(0, 80)}`);

    const shot = await session.command("GET", `/session/${session.sessionId}/screenshot`);
    if (typeof shot === "string" && shot.length > 100) {
      fs.writeFileSync(path.join(artifactDir, "injection.png"), Buffer.from(shot, "base64"));
      console.log(`📸 evidence: qa-artifacts/zen-${runId}/injection.png`);
    }
  } catch (err) {
    failed += 1;
    console.error(`\n💥 ${err.message}`);
    if (err.webdriver) console.error(`   (webdriver error: ${err.webdriver})`);
  } finally {
    await session?.close();
    proxy.server.close();
    fixture.server.close();
    gdProc.kill("SIGTERM");
  }

  console.log(`\nZen extension smoke: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`💥 environment error: ${err.message}`);
  process.exit(2);
});
