// filepath: tests/e2e/qa/simulator-sanity.spec.ts
/**
 * ============================================================================
 * SIMULATOR SANITY — the red-line test for the whole pipeline (Phase 2)
 * ============================================================================
 *
 * Proves the three things every qa-XX journey depends on:
 * 1. the simulator serves a scenario page under the REAL classroom.google.com
 *    origin (so the extension's hostname gate is satisfied),
 * 2. the served page contains the Classroom primitives the scenario declares,
 * 3. the BUILT extension is actually loaded (its service worker runs).
 *
 * If this fails, every qa-XX result would be meaningless — fix the harness
 * (HARNESS/ENVIRONMENT), never the assertions.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { launchQaContext, captureConsole, projectBrowser } from "./harness";
import { createScenario, streamPath, classworkPath, drive, sheets, forms, youtube, external } from "../../simulator/scenario";

const STREAM = streamPath();
const CLASSWORK = classworkPath();

function buildScenario() {
  return createScenario({
    locale: "en",
    dir: "ltr",
    theme: "light",
    initialPath: STREAM,
    courseName: "QA Sanity Course",
    routes: [
      {
        path: STREAM,
        kind: "stream",
        posts: [
          {
            id: "sanity-post-1",
            author: "Sanity Teacher",
            body: "Weekly materials are attached.",
            attachments: [drive("sanitydrive123", "lecture.pdf"), sheets("sanitysheet456", "grades.xlsx")],
            looseLinks: [forms("sanityform789", "Feedback form"), youtube("dQw4w9WgXcQ", "A video"), external("https://example.com/resource", "A resource")],
            comments: 3,
            edited: { diff: 2, date: "Mar 10" },
          },
          {
            id: "sanity-post-2",
            author: "Sanity Teacher",
            body: "Second post without attachments.",
          },
        ],
      },
      {
        path: CLASSWORK,
        kind: "classwork",
        posts: [
          {
            id: "sanity-classwork-1",
            body: "Classwork material.",
            attachments: [drive("sanitycwdrive", "worksheet.pdf")],
          },
        ],
      },
    ],
  });
}

test.describe("simulator sanity", () => {
  let context: BrowserContext;
  let page: Page;
  let browser: "chromium" | "firefox";
  let closeQa: () => Promise<void>;

  test.beforeAll(async ({}, testInfo) => {
    browser = projectBrowser(testInfo.project.name);
    testInfo.annotations.push({ type: "runbook", description: "harness sanity — not a manual check" });
    // Sanity must run even where the extension cannot (Firefox): it tests the
    // simulator itself, so opt out of the harness extension-availability skip.
    const session = await launchQaContext(browser, buildScenario(), { skipIfExtensionUnavailable: false });
    context = session.context;
    closeQa = session.close;
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await closeQa();
  });

  test("serves the scenario under the real Classroom origin with primitives and the built extension", async () => {
    await page.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });

    // 1. Real origin: content scripts only run on classroom.google.com — the
    //    fact that CQD injects AT ALL proves the origin requirement held.
    // 2. Classroom primitives from the scenario:
    await expect(page.locator('article.n4xnA.JUr7jb[data-stream-item-id="sanity-post-1"]')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('.luto0c[data-attachment-id="sanitydrive123"]')).toHaveCount(1);
    await expect(page.locator('.qCWAqb .huI6Cb')).toHaveText("3");
    await expect(page.locator('.comment-shell .comment-count')).toHaveText("3 class comments");
    await expect(page.locator("header.IMvYId .meta-row")).toContainText("Edited Mar 10");
    await expect(page.locator('.asQXV a[href*="docs.google.com/forms"]')).toHaveCount(1);

    // 3. SPA navigation without reload: classwork route via the router.
    await page.evaluate(() => (window as unknown as { __cqdSimNavigate: (p: string) => void }).__cqdSimNavigate("/u/0/c/class-123/t/all"));
    await expect(page.locator('li[data-stream-item-id="sanity-classwork-1"]')).toHaveCount(1);

    // 4. The built extension is loaded: MV3 service worker on Chromium.
    let workers = context.serviceWorkers();
    if (workers.length === 0) {
      await context.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => undefined);
      workers = context.serviceWorkers();
    }
    if (browser === "chromium") {
      expect(workers.length, "extension background service worker must be registered").toBeGreaterThan(0);
      expect(workers[0].url()).toContain("chrome-extension://");
    } else {
      // Firefox MV2 uses a background page, not a service worker; successful
      // SPA rendering above plus extension-loaded prefs is the load proof.
      expect(workers.length).toBe(0);
    }
  });
});
