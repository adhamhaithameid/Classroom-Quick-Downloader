// filepath: tests/e2e/qa/qa-07-live-canary.spec.ts
/**
 * ============================================================================
 * QA-07 — LIVE CLASSROOM CANARY (Layer 3: production drift detection)
 * ============================================================================
 *
 * STRICTLY READ-ONLY. Runs ONLY when BOTH are true:
 *   1. QA_LIVE_CLASSROOM=1
 *   2. The dedicated live profile (tests/e2e/.live-profile, see
 *      tests/e2e/live/live-harness.ts) exists — created once by
 *      `pnpm test:live:login` (a human signs in with a real Google account).
 *
 * Purpose: detect when Google's production Classroom DOM drifts away from
 * the structural contracts CQD and the simulator rely on. This is NOT a
 * second QA suite — no clicks on download controls, no downloads, no writes
 * to Classroom data of any kind.
 *
 * AUTH — why this is a persistent profile, not storageState:
 * `chromium.launchPersistentContext()` has no `storageState` option; Google
 * blocks scripted logins, so `--load-extension` (which requires a persistent
 * context) is combined with the SAME dedicated signed-in profile the rest of
 * the live suite uses (tests/e2e/.live-profile). See
 * docs/research/live-classroom-e2e-testing.md for the empirical writeup of
 * the bug this replaced (storageState silently dropped, canary ran
 * signed-out) and extension/tests/qa-07-live-canary.guard.test.ts for the
 * hermetic regression guard.
 *
 * QA_LIVE_STORAGE_STATE (legacy, optional): when set, its cookies are
 * imported into the persistent context via context.addCookies() — on top of,
 * not instead of, the profile's own session — so the env var actually does
 * something rather than being silently ignored. New setups should just run
 * `pnpm test:live:login` and skip this variable entirely.
 */
import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import { PROFILE_DIR, EXTENSION_PATH, liveGateReason } from "../live/live-harness";

const ENABLED = process.env.QA_LIVE_CLASSROOM === "1";
const STORAGE_STATE = process.env.QA_LIVE_STORAGE_STATE ?? "";
// liveGateReason() checks LIVE_CLASSROOM=1 (the live-suite gate); the canary
// has its own QA_LIVE_CLASSROOM=1 gate, so only reuse its profile-existence
// half here.
const GATE_REASON = !ENABLED
  ? "live canary is gated: set QA_LIVE_CLASSROOM=1 and sign in once via `pnpm test:live:login` to run"
  : !fs.existsSync(PROFILE_DIR)
    ? `no live profile at tests/e2e/.live-profile — run \`pnpm test:live:login\` once and sign in with your Google account(s)`
    : null;
void liveGateReason;

test.skip(GATE_REASON !== null, GATE_REASON ?? "");

const STREAM_URL = process.env.QA_LIVE_CLASSROOM_URL ?? "https://classroom.google.com/u/0/h";

/**
 * True once the page shows a Google-account affordance instead of a sign-in
 * prompt. The canary must FAIL LOUDLY (not silently observe an anonymous
 * page) when this comes back false — see the "signed-in guard" test below.
 */
async function isSignedIn(page: Page): Promise<boolean> {
  if (/accounts\.google\.com/.test(page.url())) return false;
  return page.evaluate(() => {
    const el = document.querySelector(
      "a[aria-label*='Google Account'], div[aria-label*='Google Account'], img[aria-label*='@']",
    );
    return el != null;
  });
}

test.describe("live classroom canary (read-only drift detection)", () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    if (GATE_REASON !== null) return;
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      // Headless by default like every other suite (channel 'chromium' is the
      // only headless build with extension support); E2E_HEADED=1 opts into a
      // visible window — useful if Google's bot heuristics ever object to a
      // headless signed-in session.
      channel: "chromium",
      headless: process.env.E2E_HEADED !== "1",
      args: [
        `--load-extension=${EXTENSION_PATH}`,
        "--no-first-run",
        "--disable-default-apps",
      ],
    });
    if (STORAGE_STATE && fs.existsSync(STORAGE_STATE)) {
      const state = JSON.parse(fs.readFileSync(STORAGE_STATE, "utf8")) as { cookies?: Parameters<BrowserContext["addCookies"]>[0] };
      if (state.cookies?.length) await context.addCookies(state.cookies);
    }
  });

  test.afterAll(async () => {
    await context?.close().catch(() => undefined);
  });

  test("live profile is actually signed in to Google (not an anonymous session)", async () => {
    test.setTimeout(60_000);
    const page = await context.newPage();
    await page.goto(STREAM_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const signedIn = await isSignedIn(page);
    await page.close();
    expect(
      signedIn,
      `canary profile is signed OUT (landed on ${page.url()}) — re-run \`pnpm test:live:login\` to refresh the session; ` +
        "drift assertions below would be meaningless against an anonymous page",
    ).toBe(true);
  });

  test("production Classroom still exposes the structural contracts CQD keys on", async ({}, testInfo) => {
    test.setTimeout(120_000);
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    // READ-ONLY: navigation + DOM inspection + screenshots only.
    await page.goto(STREAM_URL, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/classroom\.google\.com/);
    await page.waitForTimeout(5000);

    // Loud failure instead of a silent false "no drift": if the session
    // isn't signed in, the observations below are meaningless.
    expect(
      await isSignedIn(page),
      `canary is signed OUT (${page.url()}) — refusing to report structural-contract observations against an anonymous page`,
    ).toBe(true);

    const observations = await page.evaluate(() => ({
      streamItems: document.querySelectorAll("[data-stream-item-id]").length,
      driveAnchors: document.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]').length,
      cqdButtons: document.querySelectorAll("button.cqd-download-btn").length,
      cqdFlags: document.querySelectorAll(".cqd-flag").length,
      title: document.title.slice(0, 80),
    }));
    console.log("[canary] observations:", JSON.stringify(observations));

    test.info().annotations.push({ type: "evidence", description: JSON.stringify(observations) });
    await page.screenshot({ path: "qa-artifacts/live-canary.png", fullPage: true });

    // Drift assertions — production compatibility, NOT functional QA.
    expect(observations.streamItems, "stream-item containers must exist in production DOM").toBeGreaterThan(0);
    expect(consoleErrors.filter((e) => e.includes("CQD")), "no severe extension errors on live Classroom").toEqual([]);
    void testInfo;
  });
});
