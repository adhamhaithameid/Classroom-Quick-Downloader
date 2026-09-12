// filepath: tests/e2e/global-setup.ts
/**
 * ============================================================================
 * PLAYWRIGHT GLOBAL SETUP — Build Extension Before Tests
 * ============================================================================
 *
 * Builds the extension so real browsers can load it:
 * - Chromium: extension/.output/chrome-mv3 loaded via --load-extension.
 * - Firefox:  extension/.output/firefox-mv2 zipped into a prepared profile
 *             (tests/e2e/.firefox-profile) with prefs that allow unsigned
 *             installation — Firefox has no --load-extension flag.
 *
 * @since v4.0.0
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const REPO_ROOT = path.resolve(__dirname, "../..");
const EXTENSION_DIR = path.join(REPO_ROOT, "extension");
const OUTPUT_DIR = path.join(EXTENSION_DIR, ".output/chrome-mv3");
const FIREFOX_OUTPUT_DIR = path.join(EXTENSION_DIR, ".output/firefox-mv2");
const FIREFOX_PROFILE_DIR = path.join(REPO_ROOT, "tests/e2e/.firefox-profile");
const FIREFOX_GECKO_ID = "classroom-quick-downloader@adhamhaitham.dev";

/** Run an npm script in the extension workspace — argument-list form, no shell. */
function runExtensionScript(script: string, timeoutMs = 180_000): void {
  const result = spawnSync("pnpm", [script], {
    cwd: EXTENSION_DIR,
    stdio: "pipe",
    timeout: timeoutMs,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const stderr = result.stderr || result.stdout || "";
    throw new Error(`pnpm ${script} failed (exit ${result.status}):\n${stderr.slice(-2000)}`);
  }
}

function ensureChromeBuild(): void {
  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    console.log("✅ Chromium build already present, skipping rebuild");
    return;
  }
  console.log("\n🔨 Building extension for Chromium (MV3)...");
  runExtensionScript("build");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Extension manifest not found at ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  console.log(`📦 Extension v${manifest.version} ready for testing\n`);
}

/**
 * Firefox has no --load-extension: the supported route is a prepared profile
 * with the extension present as an .xpi and prefs allowing unsigned install.
 */
function ensureFirefoxProfile(): void {
  const manifestPath = path.join(FIREFOX_OUTPUT_DIR, "manifest.json");
  const firefoxZips = fs.existsSync(path.join(EXTENSION_DIR, ".output"))
    ? fs
        .readdirSync(path.join(EXTENSION_DIR, ".output"))
        .filter((f) => f.endsWith("-firefox.zip"))
    : [];
  if (!fs.existsSync(manifestPath) || firefoxZips.length === 0) {
    console.log("\n🔨 Building extension for Firefox (MV2)...");
    runExtensionScript("firefox"); // wxt build -b firefox && wxt zip -b firefox
  }

  // wxt zip names the artifact <name>-<version>-firefox.zip — glob for it.
  const sourceZip = firefoxZips
    .map((f) => path.join(EXTENSION_DIR, ".output", f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (!sourceZip) {
    throw new Error("Firefox zip not found in extension/.output — run pnpm -C extension run firefox first.");
  }

  const extensionsDir = path.join(FIREFOX_PROFILE_DIR, "extensions");
  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.copyFileSync(sourceZip, path.join(extensionsDir, `${FIREFOX_GECKO_ID}.xpi`));

  // user.js prefs: allow the unsigned MV2 build at startup, every start.
  const userJs = [
    'user_pref("xpinstall.signatures.required", false);',
    'user_pref("extensions.autoDisableScopes", 0);',
    'user_pref("extensions.enabledScopes", 15);',
    'user_pref("extensions.experiments.enabled", true);',
  ].join("\n");
  fs.writeFileSync(path.join(FIREFOX_PROFILE_DIR, "user.js"), `${userJs}\n`);
  console.log("✅ Firefox profile prepared with the MV2 extension\n");
}

export default async function globalSetup(): Promise<void> {
  ensureChromeBuild();

  const projects = (process.env.PLAYWRIGHT_PROJECTS ?? "").split(",").filter(Boolean);
  if (projects.length === 0 || projects.includes("qa-firefox")) {
    ensureFirefoxProfile();
  }
}
