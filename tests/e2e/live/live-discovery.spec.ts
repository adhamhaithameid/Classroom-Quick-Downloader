// filepath: tests/e2e/live/live-discovery.spec.ts
/**
 * ============================================================================
 * LIVE DISCOVERY — find the real classes and each one's teacher/student role
 * ============================================================================
 *
 * Walks the signed-in account's real Classroom home, visits each class's
 * stream page, and classifies the role via teacher-only DOM signals (see
 * parse.ts). Writes the stable qa-artifacts/live/classes.json that the
 * student/teacher suites resolve their target class from when no
 * LIVE_*_CLASS_ID env override is set — so `pnpm test:live` just works
 * against whatever classrooms the account actually has.
 *
 * READ-ONLY: navigation and DOM inspection only.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  absoluteClassroomUrl,
  gotoLive,
  launchLiveContext,
  liveArtifact,
  liveGateReason,
  liveRunId,
  liveScreenshot,
  pageHtml,
  probeSignedIn,
} from "./live-harness";
import { detectRole, parseAccountEmail, parseClassCards } from "./parse";

const gate = liveGateReason();
test.skip(gate !== null, gate ?? "");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const STABLE_CLASSES_JSON = path.join(REPO_ROOT, "qa-artifacts/live/classes.json");

test.describe("live class discovery + role detection", () => {
  let context: BrowserContext;
  let page: Page;
  let primaryAuthuser: number;

  test.beforeAll(async () => {
    if (gate) return;
    context = await launchLiveContext(liveRunId());
    page = await context.newPage();
    // Primary authuser = first signed-in authuser from the auth suite (or
    // LIVE_DISCOVERY_AUTHUSER override; probes are cheap so re-verify).
    primaryAuthuser = Number(process.env.LIVE_DISCOVERY_AUTHUSER ?? "0");
    const probe = await probeSignedIn(page, primaryAuthuser);
    if (!probe.signedIn) {
      const fallback = await probeSignedIn(page, primaryAuthuser === 0 ? 1 : 0);
      if (fallback.signedIn) {
        primaryAuthuser = fallback.authuser;
      } else {
        throw new Error(
          `no signed-in session for u/${primaryAuthuser} (${probe.finalUrl.slice(0, 90)}) — run \`pnpm test:live:login\``,
        );
      }
    }
    console.log(`[live-discovery] primary authuser u/${primaryAuthuser} (${probe.email ?? parseAccountEmail(null) ?? "account"})`);
  });

  test.afterAll(async () => {
    await context?.close().catch(() => undefined);
  });

  test("discovers real classes and classifies each role", async () => {
    test.setTimeout(420_000);
    const maxClasses = Number(process.env.LIVE_MAX_CLASSES ?? "10");

    await gotoLive(page, absoluteClassroomUrl(`/u/${primaryAuthuser}/h`));
    let html = await pageHtml(page);
    let cards = parseClassCards(html);

    // SPA lazy-render: re-read a few times before concluding "no classes".
    for (let i = 0; i < 5 && cards.length === 0; i += 1) {
      await page.waitForTimeout(2_000);
      cards = parseClassCards(await pageHtml(page));
    }
    if (cards.length === 0) {
      await liveScreenshot(page, "discovery", "home-no-classes");
      throw new Error(
        "no class cards found on the Classroom home — either the account has no classes (seed the sandbox class, see docs/LIVE_CLASSROOM_TESTING.md) or the DOM contract drifted (update parse.ts).",
      );
    }

    const discovered: {
      id: string;
      name: string | null;
      authuser: number;
      role: string;
      evidence: string[];
      href: string;
    }[] = [];

    for (const card of cards.slice(0, maxClasses)) {
      await gotoLive(page, absoluteClassroomUrl(card.href));
      const detection = detectRole(await pageHtml(page));
      discovered.push({
        id: card.id,
        name: card.name,
        authuser: primaryAuthuser,
        role: detection.role,
        evidence: detection.evidence,
        href: card.href,
      });
      await liveScreenshot(page, "discovery", `class-${discovered.length}`);
      console.log(
        `[live-discovery] ${card.name ?? card.id}: role=${detection.role} (${detection.evidence.join(" | ")})`,
      );
    }

    await liveArtifact("discovery", "discovery.json", {
      checkedAt: new Date().toISOString(),
      authuser: primaryAuthuser,
      classes: discovered,
    });
    // Stable artifact for the role suites + the login tool state.
    fs.mkdirSync(path.dirname(STABLE_CLASSES_JSON), { recursive: true });
    fs.writeFileSync(
      STABLE_CLASSES_JSON,
      `${JSON.stringify(discovered.map(({ id, name, authuser, role }) => ({ id, name, authuser, role })), null, 2)}\n`,
    );

    const teachers = discovered.filter((c) => c.role === "teacher").length;
    const students = discovered.filter((c) => c.role === "student").length;
    console.log(`[live-discovery] ${discovered.length} class(es): ${teachers} teacher, ${students} student, ${discovered.length - teachers - students} unknown`);

    expect(discovered.length).toBeGreaterThan(0);
    // Classes whose role is "unknown" mean the page didn't render as a class
    // (drift or slow load) — surface them loudly rather than silently passing.
    const unknown = discovered.filter((c) => c.role === "unknown");
    expect(
      unknown,
      `role detection failed for: ${unknown.map((c) => c.name ?? c.id).join(", ")} — inspect qa-artifacts/live screenshots`,
    ).toEqual([]);
  });
});
