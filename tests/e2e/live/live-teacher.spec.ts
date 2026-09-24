// filepath: tests/e2e/live/live-teacher.spec.ts
/**
 * ============================================================================
 * LIVE TEACHER ROLE — teacher UI, class attachments, student-work downloads
 * ============================================================================
 *
 * Runs against a class where the signed-in account is the TEACHER (env
 * override LIVE_TEACHER_CLASS_ID/LIVE_TEACHER_AUTHUSER, else the discovery
 * artifact). Verifies the teacher-side surface CQD supports:
 *   1. the class really renders teacher-only UI (announce compose box),
 *   2. CQD injects on stream post attachments,
 *   3. assignment details download + download-all work as teacher,
 *   4. the student-work (submissions) view — when a student has actually
 *      submitted a file — injects and downloads the submitted file.
 *
 * READ-ONLY toward Classroom: grading, returning, and posting are never
 * touched; the teacher only downloads files already visible to them.
 */

import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  absoluteClassroomUrl,
  gotoLive,
  instrumentLiveDownloads,
  launchLiveContext,
  liveArtifact,
  liveGateReason,
  liveRunId,
  liveScreenshot,
  pageHtml,
  probeSignedIn,
  waitForVerifiedDownloads,
} from "./live-harness";
import {
  exerciseDetailsDownloads,
  findAssignmentWithAttachments,
  recordDetailsOutcome,
  resolveTargetClass,
} from "./live-flows";
import {
  countCqdDownloadButtons,
  countDriveAttachments,
  countSubmissionAttachmentCards,
  detectRole,
} from "./parse";

const gate = liveGateReason();
const resolution = resolveTargetClass("teacher");
test.skip(gate !== null, gate ?? "");
test.skip(resolution.kind === "skip", resolution.kind === "skip" ? resolution.reason : "");

test.describe("live teacher role", () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    if (gate || resolution.kind !== "ok") return;
    context = await launchLiveContext(liveRunId());
    page = await context.newPage();
    const probe = await probeSignedIn(page, resolution.target.authuser);
    if (!probe.signedIn) {
      throw new Error(
        `teacher account u/${resolution.target.authuser} is not signed in (${probe.finalUrl.slice(0, 80)}) — run \`pnpm test:live:login\``,
      );
    }
  });

  test.afterAll(async () => {
    await context?.close().catch(() => undefined);
  });

  test("class page shows teacher-only UI (role verification)", async () => {
    test.setTimeout(180_000);
    if (resolution.kind !== "ok") return;
    const target = resolution.target;
    await gotoLive(page, absoluteClassroomUrl(target.href));
    const detection = detectRole(await pageHtml(page));
    await liveScreenshot(page, "teacher", "stream");
    await liveArtifact("teacher", "role.json", { target, detection });
    if (detection.role !== "teacher") {
      throw new Error(
        `expected teacher-only UI on ${target.name ?? target.classId}, detection said "${detection.role}" (${detection.evidence.join(" | ")}). If the account IS the teacher, the role signals in parse.ts drifted — update them with a capture from qa-artifacts screenshots.`,
      );
    }
    expect(detection.role).toBe("teacher");
  });

  test("injects and downloads assignment attachments as teacher", async () => {
    test.setTimeout(420_000);
    if (resolution.kind !== "ok") return;
    const target = resolution.target;

    const found = await findAssignmentWithAttachments(page, target);
    if (!found) {
      test.skip(
        true,
        `no assignment with Drive attachments in ${target.name ?? target.classId} — seed one (docs/LIVE_CLASSROOM_TESTING.md § seeding)`,
      );
      return;
    }
    const getProbe = await instrumentLiveDownloads(context);
    const outcome = await exerciseDetailsDownloads(page, getProbe, found.detailsHref, found.attachments);
    await recordDetailsOutcome(page, "teacher", target, outcome);

    expect(outcome.single.totalBytes ?? 0).toBeGreaterThan(0);
    console.log(`[live-teacher] verified teacher download: ${outcome.single.filename}`);
  });

  test("student-work view: injects and downloads a real submitted file", async () => {
    test.setTimeout(300_000);
    if (resolution.kind !== "ok") return;
    const target = resolution.target;

    const found = await findAssignmentWithAttachments(page, target);
    if (!found) {
      test.skip(true, "no assignment to check student work on — seed the class first");
      return;
    }
    // Teacher "Student work" tab: /c/<class>/a/<item> (no /details suffix).
    const itemId = /\/a\/([A-Za-z0-9_-]+)/.exec(found.detailsHref)?.[1];
    if (!itemId) {
      test.skip(true, `could not derive student-work URL from ${found.detailsHref}`);
      return;
    }
    await gotoLive(page, absoluteClassroomUrl(`/u/${target.authuser}/c/${target.classId}/a/${itemId}`));
    const html = await pageHtml(page);
    const submissionCards = countSubmissionAttachmentCards(html);
    await liveScreenshot(page, "teacher", "student-work");
    if (submissionCards === 0) {
      test.skip(
        true,
        "no submitted files in the student-work view yet — have the student account submit a file once (docs/LIVE_CLASSROOM_TESTING.md § seeding)",
      );
      return;
    }

    // CQD injects per submission attachment card; poll until stable.
    const deadline = Date.now() + 30_000;
    let current = await pageHtml(page);
    while (Date.now() < deadline && countCqdDownloadButtons(current) < submissionCards) {
      await page.waitForTimeout(1_500);
      current = await pageHtml(page);
    }
    expect(countCqdDownloadButtons(current), "one CQD button per submitted-file card").toBeGreaterThanOrEqual(
      submissionCards,
    );

    const getProbe = await instrumentLiveDownloads(context);
    await page.click("button.cqd-download-btn >> nth=0");
    const [verified] = await waitForVerifiedDownloads(getProbe, 1);
    await liveArtifact("teacher", "student-work-download.json", { verified, submissionCards });
    expect(verified.existsOnDisk ?? false).toBe(true);
    expect(verified.totalBytes ?? 0).toBeGreaterThan(0);
    console.log(`[live-teacher] verified student-work download: ${verified.filename}`);
  });
});
