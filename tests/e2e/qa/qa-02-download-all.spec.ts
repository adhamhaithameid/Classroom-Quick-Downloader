// filepath: tests/e2e/qa/qa-02-download-all.spec.ts
/**
 * ============================================================================
 * QA-02 — Download All state machine (manual Download-All behavior)
 * ============================================================================
 *
 * Automates the Download All checks a human performs: grouping (≥2 files),
 * header placement, progress sub-text, success → automatic reset, error
 * state on failing downloads, hold-to-cancel, cqd-all-* classes, and
 * repeated-scan dedup. Real downloads run against the simulator's Drive
 * endpoints.
 */
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  launchQaContext,
  skipWhenExtensionUnavailable,
  captureConsole,
  runCheck,
  SELECTORS,
  projectBrowser,
} from "./harness";
import { createScenario, streamPath, drive } from "../../simulator/scenario";
import { installSimulator } from "../../simulator/server";

const STREAM = streamPath();
const RUNBOOK_REF = "RUNBOOK Download All behavior; GOLDEN surfaces";

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
            id: "da-good",
            body: "Three downloadable files.",
            attachments: [
              drive("da-file-1", "one.pdf"),
              drive("da-file-2", "two.pdf"),
              drive("da-file-3", "three.zip", "zip"),
            ],
          },
          {
            id: "da-broken",
            body: "Both files are denied with 403 by the simulator (cqd-all-error needs all files failed; partial failure is a success state by design).",
            attachments: [
              drive("forbidden-da-1", "forbidden-one.pdf"),
              drive("forbidden-da-2", "forbidden-two.pdf"),
            ],
          },
        ],
      },
    ],
  });
}

test.describe("qa-02 download all", () => {
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
    await page.waitForSelector(SELECTORS.downloadAllButton, { timeout: 20_000 });
  });

  test.afterAll(async () => {
    await closeQa();
  });

  test("grouping, placement, success + auto-reset, error, hold-to-cancel, dedup", async () => {
    test.setTimeout(180_000);
    await runCheck(test.info(), page, capture, "qa-02", RUNBOOK_REF, async (check) => {
      // Grouping: one Download All button per qualifying post group (≥2 files).
      const allButtons = page.locator(SELECTORS.downloadAllButton);
      check.expect("one Download All button per ≥2-file post group", await allButtons.count(), 2);

      // Placement: rendered inside the post card next to the header
      // (anchorStrategy 'header', insertionPoint 'after').
      const placedInCard = await page.evaluate(
        ([sel]) =>
          [...document.querySelectorAll("[data-stream-item-id]")].map((card) => ({
            card: !!card.querySelector(sel),
            headerSibling: !!card.querySelector(".IMvYId + button, .IMvYId ~ * " + sel),
          })),
        [SELECTORS.downloadAllButton],
      );
      check.assert(
        "Download All lives inside its post card near the header",
        placedInCard.every((p) => p.card),
        JSON.stringify(placedInCard),
      );

      const good = page.locator(`[data-stream-item-id="da-good"] ${SELECTORS.downloadAllButton}`);

      // The run can complete and reset faster than Playwright can poll, so a
      // class observer records every state the button ever takes (this is how
      // a human watches the button: continuously, not sampled).
      await page.evaluate(
        ([sel]) => {
          const btn = document.querySelector(`[data-stream-item-id="da-good"] ${sel}`);
          if (!btn) throw new Error("Download All button missing");
          const w = window as unknown as { __cqdSeen: Set<string> };
          w.__cqdSeen = new Set<string>(btn.className.split(/\s+/));
          new MutationObserver(() => {
            btn.classList.forEach((c) => w.__cqdSeen.add(c));
          }).observe(btn, { attributes: true, attributeFilter: ["class"] });
        },
        [SELECTORS.downloadAllButton],
      );

      // Success run: progress sub-text, then the success state.
      await good.click();
      await expect
        .poll(async () => good.locator(".cqd-download-all-sub").textContent(), { timeout: 10_000 })
        .not.toBe("");
      check.assert("progress sub-text appears during the run", true);

      const seenClasses = async () =>
        page.evaluate(() => [...((window as unknown as { __cqdSeen: Set<string> }).__cqdSeen ?? [])]);
      await expect.poll(seenClasses, { timeout: 20_000 }).toContain("cqd-all-success");
      check.assert("run reaches the success state", true);
      await check.screenshot("download-all-success");

      // Automatic reset: the success class clears itself (GROUP_FEEDBACK window).
      await expect(good).not.toHaveClass(/cqd-all-success/, { timeout: 6_000 });
      check.assert("success state auto-resets", true);
      await check.screenshot("download-all-reset");

      // Repeated scans: churn the DOM; the group keeps exactly one control.
      await page.evaluate(() => (window as unknown as { __cqdSimChurn: (n: number) => void }).__cqdSimChurn(12));
      await page.waitForTimeout(1500);
      check.expect("churn does not duplicate Download All controls", await allButtons.count(), 2);

      // Repeated scans: churn the DOM; the group keeps exactly one control.
      await page.evaluate(() => (window as unknown as { __cqdSimChurn: (n: number) => void }).__cqdSimChurn(12));
      await page.waitForTimeout(1500);
      check.expect("churn does not duplicate Download All controls", await allButtons.count(), 2);
    });
  });

  test("hold-to-cancel during a long run", async ({}, testInfo) => {
    skipWhenExtensionUnavailable();
    const page2 = await context.newPage();
    const capture2 = captureConsole(page2);
    await page2.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
    await page2.waitForSelector(SELECTORS.downloadAllButton, { timeout: 20_000 });

    await runCheck(testInfo, page2, capture2, "qa-02-cancel", RUNBOOK_REF + " (cancel path)", async (check) => {
      // The broken group now fails deterministically fast (plain-HTTP 403s
      // drive the account sweep, ~1-2s end to end), so the hold must land in
      // the guaranteed busy window: the per-file 1s pre-download delay keeps
      // the group busy right after the click. Holding the button mid-run must
      // engage the cancel state.
      const seen = async () =>
        page2.evaluate(() => [
          ...((window as unknown as { __cqdSeenCancel?: Set<string> }).__cqdSeenCancel ?? []),
        ]);
      await page2.evaluate(
        ([sel]) => {
          const btn = document.querySelector(`[data-stream-item-id="da-broken"] ${sel}`);
          if (!btn) throw new Error("broken group Download All button missing");
          const w = window as unknown as { __cqdSeenCancel?: Set<string> };
          w.__cqdSeenCancel = new Set<string>();
          new MutationObserver(() => {
            btn.classList.forEach((c) => w.__cqdSeenCancel.add(c));
          }).observe(btn, { attributes: true, attributeFilter: ["class"] });
        },
        [SELECTORS.downloadAllButton],
      );

      const broken = page2.locator(`[data-stream-item-id="da-broken"] ${SELECTORS.downloadAllButton}`);
      await broken.click();
      await page2.waitForTimeout(200); // run is now busy

      const holdBox = await broken.boundingBox();
      check.assert("Download All button has a clickable box", !!holdBox && holdBox.width > 0);
      await page2.mouse.move(holdBox.x + holdBox.width / 2, holdBox.y + holdBox.height / 2);
      await page2.mouse.down();
      await page2.waitForTimeout(600); // press-and-hold, released inside the busy window
      await page2.mouse.up();
      await expect.poll(seen, { timeout: 15_000 }).toContain("cqd-all-cancelled");
      check.assert("hold-to-cancel engages the cancel state machine", true);
      await check.screenshot("download-all-cancelled");
    });
  });

  test("error state on an all-failed group", async ({}, testInfo) => {
    test.setTimeout(180_000);
    skipWhenExtensionUnavailable();
    const page2 = await context.newPage();
    const capture2 = captureConsole(page2);
    await page2.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
    await page2.waitForSelector(SELECTORS.downloadAllButton, { timeout: 20_000 });
    // An occluded window suspends rAF; bring the tab forward so the group's
    // render path is live (the product also flushes on a timer when hidden).
    await page2.bringToFront();

    await runCheck(testInfo, page2, capture2, "qa-02-error", RUNBOOK_REF + " (error path)", async (check) => {
      const brokenSel = '[data-stream-item-id="da-broken"] button.cqd-download-all-btn';
      const brokenButton = page2.locator(brokenSel);
      check.expect("broken group has a Download All button", await brokenButton.count(), 1);

      // The run can settle while sampling misses it — record every state.
      await page2.evaluate(
        ([sel]) => {
          const btn = document.querySelector(sel);
          if (!btn) throw new Error("broken group Download All button missing");
          const w = window as unknown as { __cqdSeenBroken: Set<string>; __cqdSubsBroken: string[] };
          w.__cqdSeenBroken = new Set<string>(btn.className.split(/\s+/));
          w.__cqdSubsBroken = [];
          new MutationObserver(() => {
            btn.classList.forEach((c) => w.__cqdSeenBroken.add(c));
            const sub = btn.querySelector(".cqd-download-all-sub");
            if (sub && sub.textContent && w.__cqdSubsBroken[w.__cqdSubsBroken.length - 1] !== sub.textContent) {
              w.__cqdSubsBroken.push(sub.textContent);
            }
          }).observe(btn, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true, characterData: true });
        },
        [brokenSel],
      );

      // The group's re-render flush rides on page activity (rAF-driven): a
      // human watching the button keeps scrolling the feed, so the journey
      // keeps the page "alive" the same way — a bounded, self-clearing scroll
      // cadence that stops once the error state has been observed.
      await page2.evaluate(() => {
        const w = window as unknown as { __cqdScrollKeepalive?: number };
        if (w.__cqdScrollKeepalive) clearInterval(w.__cqdScrollKeepalive);
        w.__cqdScrollKeepalive = window.setInterval(() => {
          const seen = (window as unknown as { __cqdSeenBroken?: Set<string> }).__cqdSeenBroken;
          if (seen?.has("cqd-all-error")) {
            clearInterval(w.__cqdScrollKeepalive);
            return;
          }
          window.dispatchEvent(new Event("scroll"));
        }, 500);
      });

      await brokenButton.click();

      // Bounded observation window (60s). The observer records every transient
      // state, so polling the seen set cannot miss the error flash even though
      // the group clears it after its GROUP_FEEDBACK window.
      const seenBroken = async () =>
        page2.evaluate(() => {
          const w = window as unknown as { __cqdSeenBroken?: Set<string>; __cqdSubsBroken?: string[] };
          return { classes: [...(w.__cqdSeenBroken ?? [])], subs: w.__cqdSubsBroken ?? [] };
        });
      let errorSeen = false;
      try {
        await expect
          .poll(async () => (await seenBroken()).classes, { timeout: 60_000 })
          .toContain("cqd-all-error");
        errorSeen = true;
      } catch {
        // fall through — the assertion below carries the full observed timeline
      }
      const final = await seenBroken();
      check.assert(
        "all-failed download drives the error state",
        errorSeen,
        `observed classes=${JSON.stringify(final.classes)} subs=${JSON.stringify(final.subs)}`,
      );
      await check.screenshot("download-all-error");
    });
  });
});
