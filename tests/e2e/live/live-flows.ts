// filepath: tests/e2e/live/live-flows.ts
/**
 * ============================================================================
 * LIVE FLOWS — reusable multi-step flows shared by the student/teacher specs
 * ============================================================================
 *
 * A "flow" is a sequence of live navigation + structural assertions that both
 * role suites reuse:
 * - resolveTargetClass: env override first (LIVE_STUDENT_CLASS_ID /
 *   LIVE_TEACHER_CLASS_ID), else the discovery artifact (classes.json) —
 *   so a plain `pnpm test:live` just works after discovery has run once.
 * - findAssignmentWithAttachments: walks classwork links (bounded) until it
 *   finds an assignment details page with real Drive attachments.
 * - exerciseDetailsDownloads: waits for CQD injection, clicks download and
 *   download-all, and verifies REAL files land on disk via the SW probe.
 *
 * Every skip path returns an actionable message — the operator must always
 * know whether the next move is seeding data, setting an env var, or
 * re-running discovery.
 */

import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import {
  absoluteClassroomUrl,
  gotoLive,
  liveArtifact,
  liveScreenshot,
  pageHtml,
  verifiedDownloads,
  waitForVerifiedDownloads,
  type LiveDownloadEvent,
  type LiveDownloadProbe,
} from "./live-harness";
import {
  countCqdDownloadAllButtons,
  countCqdDownloadButtons,
  countDriveAttachments,
  parseAssignmentLinks,
  type LiveRole,
} from "./parse";

const REPO_ROOT = path.resolve(__dirname, "../../..");
/** Stable cross-run discovery artifact (qa-artifacts/ is gitignored). */
const CLASSES_ARTIFACT = path.join(REPO_ROOT, "qa-artifacts/live/classes.json");

export interface ResolvedClass {
  authuser: number;
  classId: string;
  /** Normalized /u/N/c/<id> href. */
  href: string;
  name: string | null;
  role: LiveRole;
}

export type Resolution =
  | { kind: "ok"; target: ResolvedClass }
  | { kind: "skip"; reason: string };

interface DiscoveryEntry {
  id: string;
  name: string | null;
  role: string;
  authuser: number;
}

/**
 * Resolve the class a role suite should run against:
 * 1. LIVE_<ROLE>_CLASS_ID env (with LIVE_<ROLE>_AUTHUSER, default 0),
 * 2. first matching class in the discovery artifact (student = non-teacher,
 *    teacher = role "teacher").
 */
export function resolveTargetClass(role: "student" | "teacher"): Resolution {
  const envId = process.env[role === "student" ? "LIVE_STUDENT_CLASS_ID" : "LIVE_TEACHER_CLASS_ID"];
  const envUser = Number(process.env[role === "student" ? "LIVE_STUDENT_AUTHUSER" : "LIVE_TEACHER_AUTHUSER"] ?? "0");
  if (envId) {
    return {
      kind: "ok",
      target: {
        authuser: Number.isInteger(envUser) && envUser >= 0 ? envUser : 0,
        classId: envId,
        href: `/u/${Number.isInteger(envUser) && envUser >= 0 ? envUser : 0}/c/${envId}`,
        name: null,
        role,
      },
    };
  }
  let entries: DiscoveryEntry[];
  try {
    entries = JSON.parse(fs.readFileSync(CLASSES_ARTIFACT, "utf-8")) as DiscoveryEntry[];
  } catch {
    return {
      kind: "skip",
      reason: `no class target: set LIVE_${role.toUpperCase()}_CLASS_ID or run the discovery suite first (pnpm test:live:discovery — writes ${path.relative(REPO_ROOT, CLASSES_ARTIFACT)})`,
    };
  }
  const match = entries.find((e) => (role === "teacher" ? e.role === "teacher" : e.role !== "teacher"));
  if (!match) {
    return {
      kind: "skip",
      reason: `discovery found no ${role}-role class (roles seen: ${entries.map((e) => `${e.name ?? e.id}=${e.role}`).join(", ") || "none"}) — check LIVE_${role.toUpperCase()}_AUTHUSER or re-seed the sandbox class`,
    };
  }
  return {
    kind: "ok",
    target: {
      authuser: match.authuser,
      classId: match.id,
      href: `/u/${match.authuser}/c/${match.id}`,
      name: match.name,
      role: match.role as LiveRole,
    },
  };
}

export interface FoundAssignment {
  detailsHref: string;
  attachments: number;
}

/**
 * Walk the classwork page's assignment links (bounded by LIVE_MAX_ASSIGNMENTS,
 * default 4) and return the first whose details page carries real Drive
 * attachment cards. Returns null when none found (seeding needed).
 */
export async function findAssignmentWithAttachments(
  page: Page,
  target: ResolvedClass,
): Promise<FoundAssignment | null> {
  const max = Number(process.env.LIVE_MAX_ASSIGNMENTS ?? "4");
  await gotoLive(page, absoluteClassroomUrl(`${target.href}/w/all`));
  const links = parseAssignmentLinks(await pageHtml(page)).slice(0, max);
  for (const link of links) {
    await gotoLive(page, absoluteClassroomUrl(link.href));
    const attachments = countDriveAttachments(await pageHtml(page));
    if (attachments > 0) return { detailsHref: link.href, attachments };
  }
  return null;
}

export interface DetailsDownloadOutcome {
  assignments: { detailsHref: string; attachments: number };
  single: LiveDownloadEvent;
  allCount: number;
}

/**
 * On the CURRENT assignment details page: assert CQD injection matches the
 * attachment contract, click one download + the download-all control, and
 * verify real files land on disk (probe lookups with existsOnDisk).
 */
export async function exerciseDetailsDownloads(
  page: Page,
  getProbe: () => Promise<LiveDownloadProbe>,
  detailsHref: string,
  attachments: number,
): Promise<DetailsDownloadOutcome> {
  // CQD injects after Classroom's SPA settles — poll the DOM for the buttons
  // instead of a single fragile read.
  const deadline = Date.now() + 30_000;
  let html = await pageHtml(page);
  while (Date.now() < deadline && countCqdDownloadButtons(html) < attachments) {
    await page.waitForTimeout(1_500);
    html = await pageHtml(page);
  }
  const injected = countCqdDownloadButtons(html);
  if (injected < attachments) {
    throw new Error(`PRODUCT: expected ${attachments} CQD download button(s) on ${detailsHref}, found ${injected} (attachment cards: ${countDriveAttachments(html)})`);
  }

  await page.click("button.cqd-download-btn >> nth=0");
  const single = (await waitForVerifiedDownloads(getProbe, 1))[0];
  if (!single.totalBytes || single.totalBytes <= 0) {
    throw new Error(`PRODUCT: downloaded file has no bytes (${single.filename ?? "?"}, mime ${single.mime ?? "?"})`);
  }

  const allButtons = countCqdDownloadAllButtons(html);
  let allCount = 0;
  if (allButtons >= 1) {
    const before = verifiedDownloads(await getProbe()).length;
    await page.click("button.cqd-download-all-btn");
    // Download-all re-fetches every attachment (attachments count includes
    // the one already downloaded) — at least `attachments` total files.
    const verified = await waitForVerifiedDownloads(getProbe, Math.max(before + attachments, 2));
    allCount = verified.length - before;
  }
  return { assignments: { detailsHref, attachments }, single, allCount };
}

/** Persist the outcome of a details-download exercise as run evidence. */
export async function recordDetailsOutcome(
  page: Page,
  check: string,
  target: ResolvedClass,
  outcome: DetailsDownloadOutcome,
): Promise<void> {
  await liveScreenshot(page, check, "details-after-downloads");
  await liveArtifact(check, "download-outcome.json", {
    class: { id: target.classId, name: target.name, authuser: target.authuser },
    ...outcome,
    verifiedAt: new Date().toISOString(),
  });
}
