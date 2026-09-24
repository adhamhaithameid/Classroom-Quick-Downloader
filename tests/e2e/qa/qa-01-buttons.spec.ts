// filepath: tests/e2e/qa/qa-01-buttons.spec.ts
/**
 * ============================================================================
 * QA-01 — per-file download buttons (runbook checks 1–2, golden rules 1–4)
 * ============================================================================
 *
 * Manual checks automated here:
 * 1. real attachment cards get exactly one button each,
 * 2. Forms/YouTube/external body links never get buttons,
 *    and Forms inside attachment containers stay button-free (golden rule 3),
 * plus: button metadata (name/ext/url), duplicate-scan dedup, classwork page.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  launchQaContext,
  captureConsole,
  runCheck,
  SELECTORS,
  currentRunId,
  projectBrowser,
} from "./harness";
import {
  createScenario,
  streamPath,
  classworkPath,
  drive,
  docs,
  sheets,
  forms,
  youtube,
  external,
} from "../../simulator/scenario";

const STREAM = streamPath();
const CLASSWORK = classworkPath();
const RUNBOOK_REF = "RUNBOOK manual checks 1-2; GOLDEN rules 1-4";

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
            id: "btn-post-1",
            body: "Materials for the week.",
            attachments: [
              drive("btn-drive-1", "lecture.pdf"),
              docs("btn-docs-1", "syllabus.docx"),
              sheets("btn-sheets-1", "grades.xlsx"),
            ],
            looseLinks: [
              forms("btn-form-1", "Feedback form"),
              youtube("dQw4w9WgXcQ", "Lecture video"),
              external("https://example.com/reading", "External reading"),
            ],
          },
          {
            id: "btn-post-2",
            body: "Form-only attachment container (golden rule 3).",
            attachments: [forms("btn-form-container", "Excluded form")],
          },
        ],
      },
      {
        path: CLASSWORK,
        kind: "classwork",
        posts: [
          {
            id: "btn-cw-1",
            body: "Classwork material.",
            attachments: [drive("btn-cw-drive", "worksheet.pdf", "zip")],
          },
        ],
      },
    ],
  });
}

test.describe("qa-01 buttons", () => {
  let context: BrowserContext;
  let page: Page;
  let capture: ReturnType<typeof captureConsole>;
  let browser: "chromium" | "firefox";
  let closeQa: () => Promise<void>;

  test.beforeAll(async ({}, testInfo) => {
    browser = projectBrowser(testInfo.project.name);
    const session = await launchQaContext(browser, scenario(), { project: testInfo.project.name });
    context = session.context;
    closeQa = session.close;
    // Bail out of UI setup when the extension host never came up (Firefox);
    // runCheck skips the journeys with the recorded ENVIRONMENT reason.
    if (!session.extensionAvailable) return;
    page = await context.newPage();
    capture = captureConsole(page);
    await page.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(SELECTORS.downloadButton, { timeout: 20_000 });
  });

  test.afterAll(async () => {
    await closeQa();
  });

  test("manual checks 1-2 / golden rules 1-4: buttons, exclusions, metadata, dedup", async () => {
    await runCheck(test.info(), page, capture, "qa-01", RUNBOOK_REF, async (check) => {
      // Golden rule 1: exactly one button per real attachment card.
      const totalButtons = await page.locator(SELECTORS.downloadButton).count();
      check.expect("button count equals attachment count (3)", totalButtons, 3);

      const perContainer = await page.evaluate(
        ([sel]) =>
          [...document.querySelectorAll("[data-cqd-processed='true']")].map(
            (c) => c.querySelectorAll(sel).length,
          ),
        [SELECTORS.downloadButton],
      );
      check.assert(
        "no attachment container holds two buttons",
        perContainer.every((n) => n <= 1),
        `per-container counts: ${perContainer.join(",")}`,
      );

      const marked = await page.locator(`${SELECTORS.downloadButton}[data-cqd-injected="true"]`).count();
      check.expect("every button carries the injected marker", marked, totalButtons);

      // Golden rule 2/3: loose body links and form containers get nothing.
      const bodyLinkButtons = await page.evaluate(() => {
        const body = document.querySelector(".asQXV.QRiHXd");
        return body ? body.querySelectorAll("button.cqd-download-btn").length : -1;
      });
      check.expect("no buttons inside post bodies next to Forms/YouTube/external links", bodyLinkButtons, 0);

      const formContainerButtons = await page
        .locator('[data-attachment-id="btn-form-container"] button')
        .count();
      check.expect("a Forms link inside an attachment container stays button-free (golden rule 3)", formContainerButtons, 0);

      // Button metadata: name, extension, download URL.
      const pdf = page.locator('[data-attachment-id="btn-drive-1"] button');
      check.expect(
        "drive button data-cqd-name",
        await pdf.getAttribute("data-cqd-name"),
        "lecture.pdf",
      );
      check.expect("drive button data-cqd-ext", await pdf.getAttribute("data-cqd-ext"), "pdf");

      const docsBtn = page.locator('[data-attachment-id="btn-docs-1"] button');
      const docsUrl = await docsBtn.getAttribute("data-cqd-url");
      check.assert(
        "docs button converts to a Drive download URL (#546 family behavior)",
        !!docsUrl && docsUrl.includes("drive.usercontent.google.com/download") && docsUrl.includes("btn-docs-1"),
        docsUrl ?? "missing",
      );

      // Duplicate scans: Classroom-style churn must not duplicate buttons.
      await page.evaluate(() => (window as unknown as { __cqdSimChurn: (n: number) => void }).__cqdSimChurn(12));
      await page.waitForTimeout(1500);
      const afterChurn = await page.locator(SELECTORS.downloadButton).count();
      check.expect("button count stable after DOM churn", afterChurn, totalButtons);

      await check.screenshot("buttons-stream");
      check.expect("run id recorded", !!currentRunId(), true);

      // Classwork list page: li-wrapped cards get buttons too (manual check 1
      // covers classwork; the browser journey needs its own navigation).
      await page.evaluate(
        ([p]) => (window as unknown as { __cqdSimNavigate: (p: string) => void }).__cqdSimNavigate(p),
        [CLASSWORK],
      );
      await page.waitForSelector(`${SELECTORS.downloadButton}`, { timeout: 20_000 });
      const cwButtons = await page.locator(SELECTORS.downloadButton).count();
      check.expect("classwork material card gets exactly one button", cwButtons, 1);
      await check.screenshot("buttons-classwork");
    });
  });
});
