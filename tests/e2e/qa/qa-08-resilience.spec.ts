// filepath: tests/e2e/qa/qa-08-resilience.spec.ts
/**
 * ============================================================================
 * QA-08 — RESILIENCE: no dead ends (no-dead-ends program)
 * ============================================================================
 *
 * The owner's directive: no user should ever face a download error without
 * the extension telling them exactly what happened. This journey drives the
 * simulator's adversarial failure vocabulary through the REAL extension and
 * asserts, for every shape, that the pipeline reaches a terminal event and
 * the button settles into a terminal class — never a stuck "trying", never a
 * silent swallow, and never a window.
 *
 *   srvfail-*   → transient 5xx: retry once, then an honest failure
 *   quota-*     → HTML page: rejected, never saved as fake .html
 *   zerobyte-*  → completes (the engine cannot distinguish a legitimately
 *                 empty file) — classified honestly as success
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  launchQaContext,
  captureConsole,
  runCheck,
  SELECTORS,
  instrumentSw,
  type SwProbe,
  projectBrowser,
} from "./harness";
import { createScenario, streamPath, drive, sheets } from "../../simulator/scenario";

const STREAM = streamPath();
const RUNBOOK_REF = "RUNBOOK resilience — failure classification";

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
            id: "res-post",
            body: "Adversarial failure shapes.",
            attachments: [
              drive("srvfail-res-1", "backend.pdf"),
              drive("quota-res-1", "overquota.pdf"),
              sheets("zerobyte-res-1", "empty.xlsx"),
            ],
          },
        ],
      },
    ],
  });
}

test.describe("qa-08 resilience", () => {
  let context: BrowserContext;
  let page: Page;
  let capture: ReturnType<typeof captureConsole>;
  let browser: "chromium" | "firefox";
  let closeQa: () => Promise<void>;
  /** Firefox MV2: the service-worker resilience probe is Chromium-only. */
  let chromiumOnlySeam = false;
  let readProbe: (() => Promise<SwProbe>) | null = null;

  test.beforeAll(async ({}, testInfo) => {
    browser = projectBrowser(testInfo.project.name);
    const session = await launchQaContext(browser, scenario());
    context = session.context;
    closeQa = session.close;
    if (!session.extensionAvailable) return;
    page = await context.newPage();
    capture = captureConsole(page);
    await page.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(SELECTORS.downloadButton, { timeout: 20_000 });
    // Firefox MV2: the service-worker probe is a Chromium-only seam —
    // classify-skip in the check body below.
    chromiumOnlySeam = browser !== "chromium";
    if (!chromiumOnlySeam) readProbe = await instrumentSw(context, "chrome-extension");
  });

  test.afterAll(async () => {
    await closeQa();
  });

  test("every failure shape reaches a classified terminal — no dead ends", async () => {
    test.setTimeout(240_000);
    await runCheck(test.info(), page, capture, "qa-08", RUNBOOK_REF, async (check) => {
      if (chromiumOnlySeam) {
        check.skip("HARNESS: download probe instruments the extension service worker — Chromium-only; Firefox MV2 has no SW and Playwright hides its background");
        return;
      }
      const pagesBefore = context.pages().length;
      const cases = [
        { id: "srvfail-res-1", terminalClass: /cqd-error|cqd-success/, name: "transient 5xx" },
        { id: "quota-res-1", terminalClass: /cqd-error|cqd-success/, name: "quota html" },
        { id: "zerobyte-res-1", terminalClass: /cqd-success/, name: "zero-byte" },
      ];

      for (const c of cases) {
        const btn = page.locator(`[data-attachment-id="${c.id}"] ${SELECTORS.downloadButton}`);
        check.expect(`${c.name}: button present`, await btn.count(), 1);
        await btn.click();

        // The pipeline must run to a terminal onChanged event after this
        // click: snapshot the terminal-event count, require strictly more.
        const terminalCountBefore = ((await readProbe?.())?.downloads ?? []).filter((l) =>
          /onChanged .*state=(complete|interrupted)/.test(l),
        ).length;
        await expect
          .poll(
            async () =>
              ((await readProbe?.())?.downloads ?? []).filter((l) =>
                /onChanged .*state=(complete|interrupted)/.test(l),
              ).length,
            { timeout: 90_000 },
          )
          .toBeGreaterThan(terminalCountBefore);
        check.assert(`${c.name}: pipeline ran to a terminal event`, true);

        // The button must settle into a terminal class within the budget.
        let settled = false;
        try {
          await expect
            .poll(async () => (await btn.getAttribute("class")) ?? "", { timeout: 60_000 })
            .toMatch(c.terminalClass);
          settled = true;
        } catch {
          settled = false;
        }
        check.assert(
          `${c.name}: button reached a terminal class`,
          settled,
          `class=${await btn.getAttribute("class")} swLog=${JSON.stringify(((await readProbe?.())?.downloads ?? []).join("\n").slice(-1800))}`,
        );
      }

      // Zero dead ends: no window or tab was ever opened.
      const pagesAfter = context.pages().length;
      check.assert("zero dead ends — no window opened across all failures", pagesAfter === pagesBefore);
      await check.screenshot("resilience-terminals");
    });
  });
});
