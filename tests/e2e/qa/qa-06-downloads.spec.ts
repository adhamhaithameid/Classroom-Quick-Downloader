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
import { launchQaContext, captureConsole, runCheck, SELECTORS } from "./harness";
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
            body: "Virus-scan gated file.",
            attachments: [drive("dl-gated-1", "gated.pdf")],
          },
        ],
      },
    ],
  });
}

interface SwProbe {
  downloads: string[];
}

async function instrumentSw(context: BrowserContext, swUrlMatch: string): Promise<() => Promise<SwProbe>> {
  let sw = context.serviceWorkers().find((w) => w.url().includes(swUrlMatch));
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => undefined);
  if (!sw) throw new Error("ENVIRONMENT: extension service worker not found");
  await sw.evaluate(() => {
    const w = self as unknown as {
      __cqdProbe: { downloads: string[] };
      chrome: {
        downloads: {
          download: (opts: unknown, cb?: (id?: number) => void) => void;
          onChanged: { addListener: (fn: (delta: { id: number; state?: { current: string } }) => void) => void };
        };
        runtime: { lastError?: { message?: string } };
      };
    };
    w.__cqdProbe = { downloads: [] };
    const api = w.chrome.downloads;
    const orig = api.download.bind(api);
    api.download = (opts: unknown, cb?: (id?: number) => void) => {
      w.__cqdProbe.downloads.push(`start ${JSON.stringify(opts).slice(0, 140)}`);
      return orig(opts, (id?: number) => {
        w.__cqdProbe.downloads.push(`callback id=${id} err=${w.chrome.runtime.lastError?.message ?? "none"}`);
        cb?.(id);
      });
    };
    api.onChanged.addListener((delta) => {
      w.__cqdProbe.downloads.push(`onChanged id=${delta.id} state=${delta.state ? delta.state.current : "?"}`);
    });
  });
  return () => sw!.evaluate(() => (self as unknown as { __cqdProbe: SwProbe }).__cqdProbe);
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
    browser = testInfo.project.name === "qa-firefox" ? "firefox" : "chromium";
    const session = await launchQaContext(browser, scenario());
    context = session.context;
    closeQa = session.close;
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

  test("Drive bypass flow: gated file → interstitial → download → button success", async () => {
    test.setTimeout(180_000);
    await runCheck(test.info(), page, capture, "qa-06-bypass", RUNBOOK_REF + " (bypass)", async (check) => {
      const btn = page.locator(`[data-attachment-id="dl-gated-1"] ${SELECTORS.downloadButton}`);
      await btn.click();

      // The bypass content script auto-clicks the interstitial; the download
      // completes after the gated id is finally fetched.
      await expect
        .poll(async () => (await readProbe()).downloads.join("\n"), { timeout: 60_000 })
        .toContain("onChanged id=4 state=complete");
      check.assert("gated download reached state=complete after the bypass flow", true);

      const served = servedDownloads().find((d) => d.url.includes("id=dl-gated-1"));
      check.assert(
        "gated file served with Content-Disposition filename",
        !!served && served.filename === "gated.pdf",
        JSON.stringify(served ?? {}),
      );

      await expect(btn).toHaveClass(/cqd-success/, { timeout: 15_000 });
      check.assert("originating button flipped to success", true);
      await check.screenshot("bypass-success");
    });
  });
});
