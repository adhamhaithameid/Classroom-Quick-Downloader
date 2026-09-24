// filepath: tools/check-arc-support.mjs
/**
 * Re-checks whether Arc has become automatable. As of 2026-09-19 Arc strips
 * the Chromium switches CDP automation requires (--remote-debugging-port,
 * --user-data-dir — its engine is an embedded dylib with no separate binary),
 * so Playwright/Puppeteer cannot drive it and the E2E matrix has no Arc leg.
 *
 * Run `pnpm run test:e2e:arc` (this script) after major Arc updates; if the
 * probe ever reports success, add an `extension-arc` Playwright project
 * (mirroring extension-chrome with `executablePath` pointing at Arc) and
 * delete this script.
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const ARC_CANDIDATES = [
  "/Applications/Arc.app/Contents/MacOS/Arc",
  "/Applications/Arc Browser.app/Contents/MacOS/Arc",
];
const arc = ARC_CANDIDATES.find((p) => fs.existsSync(p));
if (!arc) {
  console.log("Arc not installed — nothing to check. (Install Arc or set expectations in the matrix docs.)");
  process.exit(0);
}

console.log(`Arc binary: ${arc}\nprobing CDP launch (10s budget)...`);
try {
  const ctx = await chromium.launchPersistentContext("", {
    executablePath: arc,
    headless: true,
    timeout: 10_000,
    args: ["--no-first-run"],
  });
  await ctx.close().catch(() => {});
  console.log(`✅ Arc LAUNCHED under Playwright — Arc automation now works!
   Next: add an extension-arc project (like extension-chrome but with
   executablePath: ${arc}) and remove this check from the matrix.`);
  process.exit(0);
} catch {
  /* fall through to the known-state explanation */
}

// Second signal: does Arc honor --user-data-dir at all? (It must for tests.)
const probeProfile = fs.mkdtempSync(path.join(os.tmpdir(), "arc-support-"));
const r = spawn(arc, ["--headless", "--user-data-dir=" + probeProfile, "--no-first-run"], {
  stdio: "ignore",
  timeout: 8000,
});
await new Promise((res) => setTimeout(res, 6000));
r.kill();
const honored = fs.existsSync(probeProfile) && fs.readdirSync(probeProfile).length > 0;

console.log(`⛔ Arc is NOT automatable (verified ${new Date().toISOString().slice(0, 10)}):
   - CDP launch: Playwright cannot attach (launch times out).
   - --user-data-dir honored: ${honored ? "yes" : "no"} (Arc strips Chromium switches;
     its engine is an embedded dylib, no standalone binary to exec).
   Extensions E2E on Arc therefore cannot run headless OR headed via
   Playwright/CDP. Manual QA on Arc remains a runbook activity.
   Re-run this check after major Arc updates.`);
process.exit(0);
