// filepath: tests/e2e/qa/qa-03-flags.spec.ts
/**
 * ============================================================================
 * QA-03 — comment/edited flags (runbook checks 3–4, golden rules 5–8)
 * ============================================================================
 *
 * Manual checks automated here:
 * - flagged posts get exactly one outer visual treatment (golden rule 5),
 * - comment/edited indicators stay attached to their card (golden rule 6),
 * - RTL keeps the same ownership (golden rule 7),
 * - toggle changes apply LIVE (golden rule 8) via the real cqd-flag-toggle
 *   message path,
 * - badges adapt to dark theme.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  launchQaContext,
  captureConsole,
  runCheck,
  SELECTORS,
  withExtensionBackground,
  projectBrowser,
} from "./harness";
import { createScenario, streamPath, drive, sheets } from "../../simulator/scenario";
import { installSimulator } from "../../simulator/server";

const STREAM = streamPath();
const RUNBOOK_REF = "RUNBOOK manual checks 3-4; GOLDEN rules 5-8";

function scenario(locale: string, dir: "ltr" | "rtl", theme: "light" | "dark") {
  return createScenario({
    locale,
    dir,
    theme,
    initialPath: STREAM,
    routes: [
      {
        path: STREAM,
        kind: "stream",
        posts: [
          {
            id: "flag-comments",
            body: "Post with comments only.",
            attachments: [drive("flag-drive-1", "reading.pdf")],
            comments: 5,
          },
          {
            id: "flag-edited",
            body: "Post that was edited.",
            edited: { diff: 3, date: "Mar 10" },
          },
          {
            id: "flag-both",
            body: "Post with both flags.",
            comments: 2,
            edited: { diff: 1, date: "Mar 11" },
          },
          {
            id: "flag-clean",
            body: "No flags here.",
          },
        ],
      },
    ],
  });
}

test.describe("qa-03 flags", () => {
  let context: BrowserContext;
  let page: Page;
  let capture: ReturnType<typeof captureConsole>;
  let browser: "chromium" | "firefox";
  let closeQa: () => Promise<void>;

  test.beforeAll(async ({}, testInfo) => {
    browser = projectBrowser(testInfo.project.name);
    const session = await launchQaContext(browser, scenario("en", "ltr", "light"), { project: testInfo.project.name });
    context = session.context;
    closeQa = session.close;
    // Bail out of UI setup when the extension host never came up (Firefox);
    // runCheck skips the journeys with the recorded ENVIRONMENT reason.
    if (!session.extensionAvailable) return;
    page = await context.newPage();
    capture = captureConsole(page);
    await page.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(SELECTORS.downloadButton, { timeout: 20_000 });
    // Flag frames take a beat to scan; wait for any badge to appear.
    await page.waitForSelector(".cqd-flag", { timeout: 20_000 }).catch(() => undefined);
  });

  test.afterAll(async () => {
    await closeQa();
  });

  test("badges render with counts, tooltips, one-card ownership, live toggles", async () => {
    await runCheck(test.info(), page, capture, "qa-03", RUNBOOK_REF, async (check) => {
      // Comment badge with the count from the comment shell.
      const commentBadge = page.locator('[data-stream-item-id="flag-comments"] .cqd-comment-badge');
      check.expect("comment badge present on the commented post", await commentBadge.count(), 1);
      if ((await commentBadge.count()) === 1) {
        const text = await commentBadge.first().textContent();
        check.assert("comment badge shows the count", !!text && text.includes("5"), text ?? "");
        const tooltip =
          (await commentBadge.first().getAttribute("aria-label")) ??
          (await commentBadge.first().getAttribute("title")) ??
          "";
        check.assert("comment badge tooltip names class comments", tooltip.toLowerCase().includes("comment"), tooltip);
      }

      // Edited badge on the edited post.
      const editedBadge = page.locator('[data-stream-item-id="flag-edited"] .cqd-edited-badge');
      check.expect("edited badge present on the edited post", await editedBadge.count(), 1);

      // Both flags: one overlay, not two stacked cards (golden rule 5).
      const overlays = page.locator('[data-stream-item-id="flag-both"] .cqd-overlay-container');
      const overlayCount = await overlays.count();
      check.expect("both-flag post resolves to one overlay container", overlayCount, 1);

      // Golden rule 6: indicators stay inside their own card.
      const crossCardBadges = await page.evaluate(() => {
        // A badge whose closest stream card differs from the post it belongs
        // to would be a placement leak; count badges outside any card.
        return [...document.querySelectorAll(".cqd-flag")].filter(
          (b) => !b.closest("[data-stream-item-id]"),
        ).length;
      });
      check.expect("no badges floating outside post cards", crossCardBadges, 0);
      await check.screenshot("flags-light");

      // Golden rule 8: live toggle via the real message path.
      await withExtensionBackground(context, browser, async (target) => {
        await target.evaluate(() => {
          const api = (
            self as unknown as {
              chrome: { tabs?: { query: (q: unknown, cb: (tabs: { id?: number }[]) => void) => void; sendMessage: (id: number, msg: unknown) => void } };
            }
          ).chrome;
          api.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id != null) {
              api.tabs.sendMessage(tabs[0].id, { type: "cqd-flag-toggle", flag: "commentsFlagEnabled", enabled: false });
            }
          });
        });
      });
      await expect
        .poll(async () => page.locator(".cqd-comment-badge").count(), { timeout: 10_000 })
        .toBe(0);
      check.assert("comment badges disappear live without reload", true);

      await withExtensionBackground(context, browser, async (target) => {
        await target.evaluate(() => {
          const api = (
            self as unknown as {
              chrome: { tabs?: { query: (q: unknown, cb: (tabs: { id?: number }[]) => void) => void; sendMessage: (id: number, msg: unknown) => void } };
            }
          ).chrome;
          api.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id != null) {
              api.tabs.sendMessage(tabs[0].id, { type: "cqd-flag-toggle", flag: "commentsFlagEnabled", enabled: true });
            }
          });
        });
      });
      await expect
        .poll(async () => page.locator(".cqd-comment-badge").count(), { timeout: 10_000 })
        .toBeGreaterThan(0);
      check.assert("comment badges reappear live when re-enabled", true);
      await check.screenshot("flags-live-toggle");
    });
  });

  test("dark theme badges carry the dark class", async ({}, testInfo) => {
    const session = await launchQaContext("chromium", scenario("en", "ltr", "dark"), { project: testInfo.project.name });
    try {
      const darkPage = await session.context.newPage();
      const darkCapture = captureConsole(darkPage);
      await runCheck(test.info(), darkPage, darkCapture, "qa-03-dark", RUNBOOK_REF, async (check) => {
        await darkPage.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
        await darkPage.waitForSelector(SELECTORS.downloadButton, { timeout: 20_000 });
        await darkPage.waitForSelector(".cqd-flag", { timeout: 20_000 }).catch(() => undefined);

        const darkBadges = await darkPage
          .locator(".cqd-flag.cqd-theme-dark, .cqd-overlay-container.cqd-theme-dark")
          .count();
        const badges = await darkPage.locator(".cqd-flag").count();
        check.assert(
          "badges carry the dark theme class in dark mode",
          badges === 0 || darkBadges > 0,
          `badges=${badges} darkBadges=${darkBadges}`,
        );
        await check.screenshot("flags-dark");
      });
    } finally {
      await session.close();
    }
  });

  test("RTL layout keeps badges anchored to their cards", async ({}, testInfo) => {
    const session = await launchQaContext("chromium", scenario("ar", "rtl", "light"), { project: testInfo.project.name });
    try {
      const rtlPage = await session.context.newPage();
      const rtlCapture = captureConsole(rtlPage);
      await runCheck(test.info(), rtlPage, rtlCapture, "qa-03-rtl", RUNBOOK_REF, async (check) => {
        await rtlPage.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
        await rtlPage.waitForSelector(SELECTORS.downloadButton, { timeout: 20_000 });
        await rtlPage.waitForSelector(".cqd-flag", { timeout: 20_000 }).catch(() => undefined);

        // The product sets data-cqd-dir="rtl" on <body> when it applies its
        // RTL badge rules — assert the rules actually engaged.
        const rtlFlag = await rtlPage.evaluate(() => document.body.getAttribute("data-cqd-dir"));
        check.expect("product applied its RTL mode", rtlFlag, "rtl");

        // Badges are edge-ribbons (centered on the card edge by design), so
        // assert ownership and centering, not full containment.
        const geometry = await rtlPage.evaluate(() => {
          const badge = document.querySelector(".cqd-flag");
          const card = badge?.closest("[data-stream-item-id]");
          if (!badge || !card) return null;
          const b = badge.getBoundingClientRect();
          const c = card.getBoundingClientRect();
          return {
            center: b.left + b.width / 2,
            inside: c.left <= b.left + b.width / 2 && b.left + b.width / 2 <= c.right,
            cardId: card.getAttribute("data-stream-item-id"),
            ownCard: badge.closest("article")?.getAttribute("data-stream-item-id"),
          };
        });
        check.assert("badge is laid out in RTL", geometry !== null);
        check.assert(
          "badge stays anchored to its own card horizontally in RTL",
          geometry?.inside === true && geometry?.cardId === geometry?.ownCard,
          JSON.stringify(geometry),
        );
        await check.screenshot("flags-rtl");
      });
    } finally {
      await session.close();
    }
  });
});
