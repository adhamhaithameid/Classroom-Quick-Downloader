// filepath: tests/simulator/scenario.ts
/**
 * ============================================================================
 * SCENARIO — typed QA scenario model (Manual-QA Replay, layer 2)
 * ============================================================================
 *
 * QA tests describe scenarios; the simulator translates scenarios into
 * Classroom-like DOM. This module is the contract between a QA journey and
 * the simulator: pure data, no DOM, no Playwright imports.
 *
 * Principle (spec 2026-09-12): the simulator is a minimal Classroom-shaped
 * harness containing only the DOM contracts CQD needs — never a Classroom
 * clone.
 */

export type AttachmentKind = "drive" | "docs" | "sheets" | "forms" | "youtube" | "external";
export type ByteKind = "pdf" | "zip" | "xlsx";

/** Anything that can appear as an attachment card or a loose body link. */
export interface LinkSpec {
  kind: AttachmentKind;
  /** Drive/Docs/Sheets file id, forms form id, youtube video id. */
  id?: string;
  /** Displayed filename / link text. */
  name: string;
  /** External links only. */
  url?: string;
  /** Which deterministic bytes the Drive/Docs simulator serves for this file. */
  bytes?: ByteKind;
}

/** An attachment rendered inside a real Classroom attachment container. */
export type AttachmentSpec = LinkSpec;

export interface PostSpec {
  id: string;
  author?: string;
  body?: string;
  /** Inline body links — CQD must never button these (they are not attachments). */
  looseLinks?: LinkSpec[];
  /** Rendered inside real attachment containers — these get buttons. */
  attachments?: AttachmentSpec[];
  /** Class comment count; null means no comment indicator at all. */
  comments?: number | null;
  /** Edited marker: diff shown on the badge, optional date for the meta row. */
  edited?: { diff: number; date?: string } | null;
  /** Insert this post into the DOM only after N ms (SPA churn resilience). */
  insertAfterMs?: number;
}

export interface DetailsSpec {
  kind: "material" | "assignment";
  id: string;
  title: string;
  attachments: AttachmentSpec[];
  looseLinks?: LinkSpec[];
  comments?: number | null;
}

export interface SubmissionsRow {
  id: string;
  student: string;
  attachments: AttachmentSpec[];
}

export interface SubmissionsSpec {
  /** CourseWork id the submissions belong to. */
  id: string;
  rows: SubmissionsRow[];
}

export type RouteSpec =
  | { path: string; kind: "stream"; posts: PostSpec[]; loadMorePosts?: PostSpec[] }
  | { path: string; kind: "classwork"; posts: PostSpec[]; loadMorePosts?: PostSpec[] }
  | { path: string; kind: "details"; details: DetailsSpec }
  | { path: string; kind: "submissions"; submissions: SubmissionsSpec };

export interface Scenario {
  /** BCP-47-ish language tag placed on <html lang>. */
  locale: string;
  dir: "ltr" | "rtl";
  theme: "light" | "dark";
  initialPath: string;
  routes: RouteSpec[];
  courseName?: string;
}

// ---------------------------------------------------------------------------
// Attachment factories — the vocabulary QA journeys write in.
// ---------------------------------------------------------------------------

export function drive(id: string, name: string, bytes: ByteKind = "pdf"): AttachmentSpec {
  return { kind: "drive", id, name, bytes };
}

export function docs(id: string, name: string, bytes: ByteKind = "pdf"): AttachmentSpec {
  return { kind: "docs", id, name, bytes };
}

export function sheets(id: string, name: string, bytes: ByteKind = "xlsx"): AttachmentSpec {
  return { kind: "sheets", id, name, bytes };
}

export function forms(id: string, name: string): AttachmentSpec {
  return { kind: "forms", id, name };
}

export function youtube(videoId: string, name: string): AttachmentSpec {
  return { kind: "youtube", id: videoId, name };
}

export function external(url: string, name: string): AttachmentSpec {
  return { kind: "external", url, name };
}

// ---------------------------------------------------------------------------
// URL helpers — the simulator's single source of Classroom URL shapes.
// ---------------------------------------------------------------------------

export const COURSE_ID = "class-123";

export function streamPath(courseId = COURSE_ID): string {
  return `/u/0/c/${courseId}`;
}

export function classworkPath(courseId = COURSE_ID): string {
  return `/u/0/c/${courseId}/t/all`;
}

export function assignmentDetailsPath(assignmentId: string, courseId = COURSE_ID): string {
  return `/u/0/c/${courseId}/a/${assignmentId}/details`;
}

export function materialDetailsPath(materialId: string, courseId = COURSE_ID): string {
  return `/u/0/c/${courseId}/m/${materialId}/details`;
}

export function submissionsPath(assignmentId: string, courseId = COURSE_ID): string {
  return `/u/0/c/${courseId}/a/${assignmentId}/submissions/by-status/and-sort-name/all/all`;
}

/**
 * Validate + freeze a scenario. Throws on the mistakes a QA author is most
 * likely to make (duplicate routes/ids, missing initial route) so failures
 * surface as HARNESS, not as confusing browser behavior.
 */
export function createScenario(scenario: Scenario): Scenario {
  const paths = new Set<string>();
  for (const route of scenario.routes) {
    if (paths.has(route.path)) {
      throw new Error(`scenario: duplicate route path "${route.path}"`);
    }
    paths.add(route.path);
  }
  if (!paths.has(scenario.initialPath)) {
    throw new Error(
      `scenario: initialPath "${scenario.initialPath}" has no matching route (have: ${[...paths].join(", ")})`,
    );
  }
  for (const route of scenario.routes) {
    if (route.kind === "stream" || route.kind === "classwork") {
      const ids = route.posts.map((p) => p.id);
      if (new Set(ids).size !== ids.length) {
        throw new Error(`scenario: duplicate post ids on ${route.path}`);
      }
    }
  }
  return scenario;
}

/** Anchor href for a link spec — mirrors real Classroom URL shapes. */
export function linkHref(link: LinkSpec): string {
  switch (link.kind) {
    case "drive":
      return `https://drive.google.com/file/d/${link.id}/view?usp=classroom_web&authuser=0`;
    case "docs":
      return `https://docs.google.com/document/d/${link.id}/edit`;
    case "sheets":
      return `https://docs.google.com/spreadsheets/d/${link.id}/edit`;
    case "forms":
      return `https://docs.google.com/forms/d/${link.id}/viewform`;
    case "youtube":
      return `https://www.youtube.com/watch?v=${link.id}`;
    case "external":
      return link.url ?? "https://example.com/";
  }
}
