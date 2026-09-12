// filepath: tests/e2e/qa/qa-07-live-canary.spec.ts
/**
 * ============================================================================
 * QA-07 — LIVE CLASSROOM CANARY (Layer 3: production drift detection)
 * ============================================================================
 *
 * STRICTLY READ-ONLY. Runs ONLY when BOTH are true:
 *   1. QA_LIVE_CLASSROOM=1
 *   2. QA_LIVE_STORAGE_STATE points at a Playwright storageState file from a
 *      dedicated (non-primary) signed-in profile.
 *
 * Purpose: detect when Google's production Classroom DOM drifts away from
 * the structural contracts CQD and the simulator rely on. This is NOT a
 * second QA suite — no clicks on download controls, no downloads, no writes
 * to Classroom data of any kind.
 */
import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ENABLED = process.env.QA_LIVE_CLASSROOM === "1";
const STORAGE_STATE = process.env.QA_LIVE_STORAGE_STATE ?? "";

test.skip(!ENABLED, "live canary is gated: set QA_LIVE_CLASSROOM=1 and QA_LIVE_STORAGE_STATE to run");
test.skip(ENABLED && !STORAGE_STATE, "QA_LIVE_STORAGE_STATE must point at a signed-in storage state file");

const STREAM_URL = process.env.QA_LIVE_CLASSROOM_URL ?? "https://classroom.google.com/u/0/h";

test.describe("live classroom canary (read-only drift detection)", () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    if (!ENABLED || !STORAGE_STATE || !fs.existsSync(STORAGE_STATE)) return;
    context = await chromium.launchPersistentContext("", {
      headless: false,
      storageState: STORAGE_STATE,
      args: [
        `--load-extension=${path.resolve(__dirname, "../../extension/.output/chrome-mv3")}`,
        "--no-first-run",
        "--disable-default-apps",
      ],
    });
  });

  test.afterAll(async () => {
    await context?.close().catch(() => undefined);
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
