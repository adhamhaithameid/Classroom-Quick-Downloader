// filepath: tools/check-chrome-support.mjs
/**
 * Re-checks whether branded Google Chrome can load unpacked extensions again.
 * Since Chrome 137, branded builds ignore --load-extension and
 * --disable-extensions-except (anti-abuse measure), so NO extension E2E can
 * run there — verified 2026-09-19 on Chrome 150 (service worker never
 * registers, content scripts never inject). The Chrome ENGINE is covered by
 * the extension-chromium Playwright project: Chrome for Testing is Google's
 * own test build and still honors the flags.
 *
 * Run `pnpm run test:e2e:chrome` after major Chrome updates. If the probe
 * ever reports the extension loading, re-add an `extension-chrome` project
 * (mirror extension-edge with channel: 'chrome') and a qa-chrome project.
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { chromium } from "@playwright/test";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) {
  console.log("Google Chrome not installed — nothing to check.");
  process.exit(0);
}

const EXTENSION_PATH = path.resolve(process.cwd(), "extension/.output/chrome-mv3");
if (!fs.existsSync(EXTENSION_PATH)) {
  console.log("No built extension (extension/.output/chrome-mv3) — run pnpm -C extension build first.");
  process.exit(2);
}

console.log(`Chrome binary: ${chrome}\nprobing --load-extension (headless, 20s budget)...`);
try {
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chrome",
    headless: true,
    timeout: 20_000,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
    ],
  });
  let sw = ctx.serviceWorkers();
  if (sw.length === 0) {
    await ctx.waitForEvent("serviceworker", { timeout: 12_000 }).catch(() => {});
    sw = ctx.serviceWorkers();
  }
  await ctx.close().catch(() => {});
  if (sw.length > 0) {
    console.log(`✅ Branded Chrome LOADED the extension (service worker registered)!
   Google's branded-build flag removal no longer applies — re-add an
   extension-chrome project (mirror extension-edge with channel: 'chrome')
   plus qa-chrome, and add them back to test:e2e:matrix.`);
  } else {
    console.log(`⛔ Branded Chrome launched but did NOT load the extension (no service worker).
   This is the Chrome 137+ branded-build policy: --load-extension and
   --disable-extensions-except are ignored. Extension E2E cannot run on
   Google Chrome; the engine is covered by the extension-chromium project
   (Chrome for Testing honors the flags). Sources: developer.chrome.com blog
   "What's happening in Chrome extensions (June 2025)".`);
  }
} catch (err) {
  console.log(`⛔ Chrome probe failed to launch: ${String(err.message).split("\n")[0]}`);
}
process.exit(0);
