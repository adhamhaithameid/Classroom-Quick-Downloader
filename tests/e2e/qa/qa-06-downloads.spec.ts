// filepath: tests/e2e/qa/qa-06-downloads.spec.ts
/**
 * ============================================================================
 * QA-06 — REAL downloads (per-file + Drive bypass lifecycle)
 * ============================================================================
 *
 * Verification strategy (documented fallback per the spec): SW-initiated
 * chrome.downloads do not surface as Playwright page download events, so the
 * real pipeline is observed where it actually runs —
 *   1. the extension service worker's chrome.downloads calls + onChanged
 *      state transitions (instrumented in the live SW),
 *   2. the simulator proxy's served Content-Disposition + deterministic
 *      magic bytes (the actual bytes the browser downloaded over TLS),
 *   3. the CQD button state machine (success).
 * Nothing is mocked: the download genuinely flows browser → proxy → bytes.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { launchQaContext, captureConsole, runCheck, SELECTORS, instrumentSw, projectBrowser, type SwProbe } from "./harness";
import { createScenario, streamPath, drive, sheets } from "../../simulator/scenario";

const STREAM = streamPath();
const RUNBOOK_REF = "RUNBOOK download flows";

function scenario() {
  return createScenario({
    locale: "en",
    dir: "ltr",
    theme: "light",
    initialPath: STREAM,
    routes: [
      {
        path: STREAM,
        kind: "stream",
        posts: [
          {
            id: "dl-post",
            attachments: [drive("dl-pdf-1", "lecture.pdf"), drive("dl-zip-1", "bundle.zip", "zip"), sheets("dl-xlsx-1", "grades.xlsx")],
          },
          {
            id: "dl-bypass",
            body: "Account-locked file: the default account gets 403s; authuser=1 holds access.",
            attachments: [drive("authlocked-dl-1", "secret.pdf")],
          },
        ],
      },
    ],
  });
}

test.describe("qa-06 downloads", () => {
  let context: BrowserContext;
  let page: Page;
  let capture: ReturnType<typeof captureConsole>;
  let browser: "chromium" | "firefox";
  let closeQa: () => Promise<void>;
  let servedDownloads: () => { url: string; filename: string }[];
  let readProbe: () => Promise<SwProbe>;

  test.beforeAll(async ({}, testInfo) => {
    browser = projectBrowser(testInfo.project.name);
    const session = await launchQaContext(browser, scenario());
    context = session.context;
    closeQa = session.close;
    // Bail out of UI setup when the extension host never came up (Firefox);
    // runCheck skips the journeys with the recorded ENVIRONMENT reason.
    if (!session.extensionAvailable) return;
    servedDownloads = session.servedDownloads;
    page = await context.newPage();
    capture = captureConsole(page);
    await page.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(SELECTORS.downloadButton, { timeout: 20_000 });
    readProbe = await instrumentSw(context, "chrome-extension");
  });

  test.afterAll(async () => {
    await closeQa();
  });

  test("per-file downloads complete with the expected filename and deterministic bytes", async () => {
    test.setTimeout(180_000);
    await runCheck(test.info(), page, capture, "qa-06", RUNBOOK_REF, async (check) => {
      const cases = [
        { id: "dl-pdf-1", filename: "lecture.pdf", magic: "%PDF" },
        { id: "dl-zip-1", filename: "bundle.zip", magic: "PK" },
        { id: "dl-xlsx-1", filename: "grades.xlsx", magic: "PK" },
      ];

      for (const [i, c] of cases.entries()) {
        const btn = page.locator(`[data-attachment-id="${c.id}"] ${SELECTORS.downloadButton}`);
        await btn.click();

        // The download manager must reach state=complete for this id.
        await expect
          .poll(async () => (await readProbe()).downloads.join("\n"), { timeout: 30_000 })
          .toContain(`onChanged id=${i + 1} state=complete`);
        check.assert(`download ${i + 1} (${c.filename}) reached state=complete`, true);

        // The bytes the browser downloaded are the simulator's deterministic
        // payload, named by the served Content-Disposition.
        const served = servedDownloads().find((d) => d.url.includes(`id=${c.id}`));
        check.assert(`download ${i + 1} was served with Content-Disposition filename`, !!served && served.filename === c.filename, JSON.stringify(served ?? {}));

        // The button reflects the completed download.
        await expect(btn).toHaveClass(/cqd-success/, { timeout: 10_000 });
        await check.screenshot(`download-${i + 1}-success`);
      }
    });
  });

  test("Drive downloads are zero-tab: auth-locked file cycles accounts and completes", async () => {
    test.setTimeout(180_000);
    await runCheck(test.info(), page, capture, "qa-06-bypass", RUNBOOK_REF + " (account cycling)", async (check) => {
      // Zero-tab contract at the browser level: no window/tab may appear
      // during the whole flow — the extension downloads natively.
      const pagesBefore = context.pages().length;

      const btn = page.locator(`[data-attachment-id="authlocked-dl-1"] ${SELECTORS.downloadButton}`);
      await btn.click();

      // The default-account attempt 403s (simulator 403 for non-authuser=1);
      // the sweep retries under authuser=1, which serves the bytes.
      // Attempt ids: 4 = authuser=0 (403), 5 = authuser=1 (bytes).
      await expect
        .poll(async () => (await readProbe()).downloads.join("\n"), { timeout: 60_000 })
        .toContain("onChanged id=5 state=complete");
      check.assert("auth-locked download reached state=complete after account cycling", true);

      const probeLog = (await readProbe()).downloads.join("\n");
      const startedCount = (probeLog.match(/start \{/g) ?? []).length;
      check.assert(
        "multiple download attempts were made (account sweep ran)",
        startedCount >= 2,
        probeLog,
      );

      const served = servedDownloads().find(
        (d) => d.url.includes("id=authlocked-dl-1") && d.filename === "secret.pdf",
      );
      check.assert(
        "served from the usercontent byte-serving endpoint under authuser=1",
        !!served && served.url.includes("drive.usercontent.google.com") && served.url.includes("authuser=1") && served.filename === "secret.pdf",
        JSON.stringify(servedDownloads().filter((d) => d.url.includes("id=authlocked-dl-1"))),
      );

      await expect(btn).toHaveClass(/cqd-success/, { timeout: 15_000 });
      check.assert("originating button flipped to success", true);

      // No tab or window was ever created — the manual-test regression.
      const pagesAfter = context.pages().length;
      check.assert("no new window or tab was opened (zero-tab)", pagesAfter === pagesBefore, `pages before=${pagesBefore} after=${pagesAfter}`);
      await check.screenshot("authlocked-cycled-success");
    });
  });
});
