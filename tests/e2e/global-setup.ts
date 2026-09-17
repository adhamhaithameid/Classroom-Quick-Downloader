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
 * Chromium rebuild policy (S10 parked, bead 0fe): the build is reused only
 * when its source hash (extension/src + extension/entrypoints +
 * extension/package.json) matches the stamp in tests/e2e/.build-stamp
 * (gitignored); QA_FORCE_REBUILD=1 forces a rebuild. A stale build can no
 * longer mask source changes.
 *
 * @since v4.0.0
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";

const REPO_ROOT = path.resolve(__dirname, "../..");
const EXTENSION_DIR = path.join(REPO_ROOT, "extension");
const OUTPUT_DIR = path.join(EXTENSION_DIR, ".output/chrome-mv3");
const FIREFOX_OUTPUT_DIR = path.join(EXTENSION_DIR, ".output/firefox-mv2");
const FIREFOX_PROFILE_DIR = path.join(REPO_ROOT, "tests/e2e/.firefox-profile");
const FIREFOX_GECKO_ID = "classroom-quick-downloader@adhamhaitham.dev";
const BUILD_STAMP_PATH = path.join(REPO_ROOT, "tests/e2e/.build-stamp");

/** Sources whose content the Chrome build depends on (repo-relative dirs). */
const FINGERPRINT_DIRS = ["src", "entrypoints"];

/**
 * Cheap content fingerprint of the sources the Chrome build depends on:
 * extension/src + extension/entrypoints + extension/package.json. sha1 over
 * each file's path and bytes (~hundreds of small files, single-digit ms) —
 * deterministic across checkouts, unlike mtime comparisons.
 */
export function computeBuildFingerprint(): string {
  const hash = createHash("sha1");
  const addFile = (absPath: string, relPath: string): void => {
    hash.update(relPath);
    hash.update("\0");
    hash.update(fs.readFileSync(absPath));
    hash.update("\0");
  };
  const walk = (absDir: string, relDir: string): void => {
    const entries = fs.readdirSync(absDir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const abs = path.join(absDir, entry.name);
      const rel = `${relDir}/${entry.name}`;
      if (entry.isDirectory()) walk(abs, rel);
      else if (entry.isFile()) addFile(abs, rel);
    }
  };
  addFile(path.join(EXTENSION_DIR, "package.json"), "package.json");
  for (const dir of FINGERPRINT_DIRS) {
    walk(path.join(EXTENSION_DIR, dir), dir);
  }
  return hash.digest("hex");
}

/**
 * Rebuild decision (S10 parked item, bead 0fe hazard): a stale
 * .output/chrome-mv3 used to mask source changes because presence alone
 * skipped the rebuild. Now the build is reused only when a previous
 * global-setup stamped the SAME source fingerprint into
 * tests/e2e/.build-stamp (gitignored); QA_FORCE_REBUILD=1 always rebuilds.
 */
export function shouldRebuildChrome(opts: {
  force: boolean;
  manifestExists: boolean;
  stamp: string | null;
  fingerprint: string;
}): boolean {
  if (opts.force) return true;
  if (!opts.manifestExists) return true;
  return opts.stamp !== opts.fingerprint;
}

function readBuildStamp(): string | null {
  try {
    return fs.readFileSync(BUILD_STAMP_PATH, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

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
  const force = process.env.QA_FORCE_REBUILD === "1";
  const fingerprint = computeBuildFingerprint();
  const stamp = readBuildStamp();
  if (!shouldRebuildChrome({
    force,
    manifestExists: fs.existsSync(manifestPath),
    stamp,
    fingerprint,
  })) {
    console.log("✅ Chromium build up to date (source hash matches stamp), skipping rebuild");
    return;
  }
  const reason = force
    ? "QA_FORCE_REBUILD=1"
    : fs.existsSync(manifestPath)
      ? "source hash changed since stamp"
      : "no previous build";
  console.log(`\n🔨 Building extension for Chromium (MV3) — ${reason}...`);
  runExtensionScript("build");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Extension manifest not found at ${manifestPath}`);
  }
  // Stamp only after a verified build so a failed build never poisons it.
  fs.writeFileSync(BUILD_STAMP_PATH, `${fingerprint}\n`);
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
