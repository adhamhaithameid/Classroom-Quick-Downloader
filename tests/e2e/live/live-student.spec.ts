// filepath: tests/e2e/live/live-student.spec.ts
/**
 * ============================================================================
 * LIVE STUDENT ROLE — real attachments, real downloads, on a real class
 * ============================================================================
 *
 * Runs against a class where the signed-in account is a STUDENT (env override
 * LIVE_STUDENT_CLASS_ID/LIVE_STUDENT_AUTHUSER, else the discovery artifact).
 * On the first assignment with real Drive attachments:
 *   1. CQD must inject exactly one download button per attachment card,
 *   2. clicking it must produce a REAL file on disk (chrome.downloads.search
 *      lookup + filesystem verification — bytes > 0),
 *   3. download-all must fetch every attachment.
 *
 * READ-ONLY toward Classroom: the account downloads files it can already see;
 * nothing is created, submitted, or modified.
 */

import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  instrumentLiveDownloads,
  launchLiveContext,
  liveGateReason,
  liveRunId,
  probeSignedIn,
} from "./live-harness";
import {
  exerciseDetailsDownloads,
  findAssignmentWithAttachments,
  recordDetailsOutcome,
  resolveTargetClass,
} from "./live-flows";

const gate = liveGateReason();
const resolution = resolveTargetClass("student");
test.skip(gate !== null, gate ?? "");
test.skip(resolution.kind === "skip", resolution.kind === "skip" ? resolution.reason : "");

test.describe("live student role (real downloads)", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    if (gate || resolution.kind !== "ok") return;
    context = await launchLiveContext(liveRunId());
    page = await context.newPage();
    const probe = await probeSignedIn(page, resolution.target.authuser);
    if (!probe.signedIn) {
      throw new Error(
        `student account u/${resolution.target.authuser} is not signed in (${probe.finalUrl.slice(0, 80)}) — run \`pnpm test:live:login\``,
      );
    }
  });

  test.afterAll(async () => {
    await context?.close().catch(() => undefined);
  });

  test("injects download buttons on real attachments and downloads them to disk", async () => {
    test.setTimeout(420_000);
    if (resolution.kind !== "ok") return;
    const target = resolution.target;

    const found = await findAssignmentWithAttachments(page, target);
    if (!found) {
      test.skip(
        true,
        `no assignment with Drive attachments found in class ${target.name ?? target.classId} — seed one as the teacher (see docs/LIVE_CLASSROOM_TESTING.md § seeding) or raise LIVE_MAX_ASSIGNMENTS`,
      );
      return;
    }
    console.log(`[live-student] exercising ${found.detailsHref} (${found.attachments} attachments)`);

    const getProbe = await instrumentLiveDownloads(context);
    const outcome = await exerciseDetailsDownloads(page, getProbe, found.detailsHref, found.attachments);
    await recordDetailsOutcome(page, "student", target, outcome);

    expect(outcome.single.existsOnDisk ?? false, "downloaded file must exist on disk").toBe(true);
    expect(outcome.single.totalBytes ?? 0, "downloaded file must have bytes").toBeGreaterThan(0);
    if (outcome.assignments.attachments >= 2) {
      expect(
        outcome.allCount,
        "download-all must fetch every attachment",
      ).toBeGreaterThanOrEqual(outcome.assignments.attachments);
    }
    console.log(
      `[live-student] verified: ${outcome.single.filename} (${outcome.single.totalBytes} bytes, ${outcome.single.mime}); download-all fetched ${outcome.allCount}`,
    );
  });
});
