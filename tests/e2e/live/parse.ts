// filepath: tests/e2e/live/parse.ts
/**
 * ============================================================================
 * LIVE CLASSROOM PARSERS — pure, offline-testable extraction from real DOM
 * ============================================================================
 *
 * Everything here takes an HTML STRING (page.content()) or a URL string and
 * returns plain data. No Playwright, no browser, no network — so the parsers
 * are unit-tested offline in parse.spec.ts against representative markup and
 * can drift-detect against production without any login.
 *
 * Tolerance contract: production Classroom is an obfuscated-class SPA that
 * changes without notice. These parsers therefore key on STABLE attributes
 * (href shapes, aria-labels, data-* attributes) and return "unknown"/empty
 * rather than throwing when Google drifts. The live specs translate an
 * "unknown" into an explicit, actionable skip/fail message instead of a
 * confusing assertion error.
 *
 * @author Adham
 * @since v1.7.0
 */

/** One class card discovered on the classroom.google.com home/classes page. */
export interface LiveClassCard {
  /** The opaque class id from the /c/<id> URL segment. */
  id: string;
  /** Best-effort class name (aria-label or anchor text); null when unavailable. */
  name: string | null;
  /** Normalized path, e.g. "/u/0/c/<id>". */
  href: string;
}

/** Role signal extracted from a class page (stream or classwork). */
export type LiveRole = "teacher" | "student" | "unknown";

export interface LiveRoleDetection {
  role: LiveRole;
  /** Every signal that fired (or the reason none did) — goes into artifacts. */
  evidence: string[];
}

/**
 * Anchor href for a class, optionally namespaced by an education domain:
 * personal accounts use /u/N/c/<id>, Workspace accounts use /u/N/a/<domain>/c/<id>.
 */
const CLASS_HREF = /\/u\/(\d+)(?:\/a\/[^/"']+)?\/c\/([A-Za-z0-9_-]+)/;

/**
 * Extract class cards from the Classroom home ("All classes") HTML.
 *
 * Keys on the href shape (the only stable contract), dedupes by class id
 * (each card renders several overlapping anchors), and takes the name from
 * the anchor's aria-label when present, else from stripped anchor text.
 * Order follows document order, which matches the home grid.
 */
export function parseClassCards(html: string): LiveClassCard[] {
  const byId = new Map<string, LiveClassCard>();
  const anchors = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const anchor of anchors) {
    const attrs = anchor[1];
    const hrefMatch = /href="([^"]*)"/i.exec(attrs);
    if (!hrefMatch) continue;
    // Classroom SPA hrefs are often relative ("./u/0/c/<id>") — normalize.
    const href = hrefMatch[1].replace(/^\.\//, "/");
    const parsed = CLASS_HREF.exec(href);
    if (!parsed) continue;
    const id = parsed[2];
    if (byId.has(id)) continue;
    const aria = /aria-label="([^"]*)"/i.exec(attrs);
    let name: string | null = aria ? decodeEntities(aria[1]) : null;
    if (!name) {
      const text = anchor[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      name = text.length > 0 ? text.slice(0, 120) : null;
    }
    // Keep the canonical /u/N/c/<id> path (drop any /a/<domain> for brevity).
    byId.set(id, { id, name, href: `/u/${parsed[1]}/c/${id}` });
  }
  return [...byId.values()];
}

/**
 * Assignment (courseWork) details links found on a classwork page:
 * /u/N[/a/domain]/c/<classId>/a/<itemId> with an optional trailing view segment.
 */
export interface LiveAssignmentLink {
  itemId: string;
  /** Normalized absolute path to the details view. */
  href: string;
}

/** Extract deduped assignment links from a classwork page HTML. */
export function parseAssignmentLinks(html: string): LiveAssignmentLink[] {
  const seen = new Map<string, LiveAssignmentLink>();
  const anchors = html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/gi);
  for (const anchor of anchors) {
    const href = anchor[1].replace(/^\.\//, "/");
    const parsed = /^\/u\/(\d+)(?:\/a\/[^/]+)?\/c\/([A-Za-z0-9_-]+)\/a\/([A-Za-z0-9_-]+)/.exec(href);
    if (!parsed) continue;
    const itemId = parsed[3];
    if (seen.has(itemId)) continue;
    seen.set(itemId, { itemId, href: `/u/${parsed[1]}/c/${parsed[2]}/a/${itemId}/details` });
  }
  return [...seen.values()];
}

/**
 * Count real attachment cards on an assignment/material details page.
 * Keys on CQD's structural contract: [data-drive-id] (details views).
 */
export function countDriveAttachments(html: string): number {
  return (html.match(/data-drive-id="/g) ?? []).length;
}

/**
 * Count student-work submission attachment cards (teacher submissions view).
 * Keys on the .WkZsyc container contract the student-work scripts key on.
 */
export function countSubmissionAttachmentCards(html: string): number {
  return (html.match(/class="[^"]*WkZsyc[^"]*"/g) ?? []).length;
}

/** Count CQD-injected single-download buttons in any page HTML. */
export function countCqdDownloadButtons(html: string): number {
  return (html.match(/class="[^"]*cqd-download-btn[^"]*"/g) ?? []).length;
}

/** Count CQD-injected download-all buttons in any page HTML. */
export function countCqdDownloadAllButtons(html: string): number {
  return (html.match(/class="[^"]*cqd-download-all-btn[^"]*"/g) ?? []).length;
}

// ---------------------------------------------------------------------------
// Role detection
// ---------------------------------------------------------------------------

/**
 * Teacher-only DOM signals. A student account NEVER renders these, so any
 * single hit classifies the account as teacher for that class.
 *
 * Text signals are locale-sensitive; en + ar are covered (the maintainer's
 * accounts) and everything else degrades to "unknown" — never a wrong role.
 */
const TEACHER_SIGNALS: { label: string; pattern: RegExp }[] = [
  {
    label: "stream compose box (Announce something to your class)",
    pattern: /announce something to your class/i,
  },
  {
    label: "stream compose box (Arabic: أعلن شيئًا لصفك)",
    pattern: /أعلن\s+شيئً?ا?\s+لصفك/,
  },
  {
    label: "classwork create button (aria-label)",
    pattern: /aria-label="(Create|إنشاء)"/i,
  },
];

/**
 * Role detection from a rendered class page (stream or classwork HTML).
 *
 * teacher  — at least one teacher-only signal fired;
 * unknown  — the page doesn't even look like a loaded class shell (drift,
 *            interstitial, or wrong page) — callers must not trust it;
 * student  — a valid class shell with ZERO teacher signals.
 */
export function detectRole(html: string): LiveRoleDetection {
  if (!hasClassShell(html)) {
    return { role: "unknown", evidence: ["no class shell detected (tabs/stream missing) — page did not load as a class"] };
  }
  const evidence: string[] = [];
  for (const signal of TEACHER_SIGNALS) {
    if (signal.pattern.test(html)) evidence.push(`teacher: ${signal.label}`);
  }
  if (evidence.length > 0) return { role: "teacher", evidence };
  return { role: "student", evidence: ["valid class shell with no teacher-only signals"] };
}

/** A loaded class page shows the stream/classwork/people navigation shell. */
export function hasClassShell(html: string): boolean {
  const tabShapes = [
    /href="[^"]*\/w\/all"/, // classwork tab
    /data-stream-item-id=/, // stream posts
    /aria-label="[^"]*(Stream|Classwork|People|School work)[^"]*"/i,
    /href="[^"]*\/p\/[^"]*"/, // posts
  ];
  return tabShapes.some((p) => p.test(html));
}

// ---------------------------------------------------------------------------
// URL / authuser helpers
// ---------------------------------------------------------------------------

/** The authuser index (the /u/N/ segment) of a classroom URL; null if absent. */
export function authuserFromUrl(url: string): number | null {
  const m = /\/u\/(\d+)/.exec(url);
  return m ? Number(m[1]) : null;
}

/** True when the browser ended up on a Google sign-in/chooser page. */
export function isSignInRedirect(url: string): boolean {
  return /https:\/\/accounts\.google\.com/.test(url);
}

/**
 * True when the browser hit the SIGNED-OUT landing pages: since 2025 an
 * unauthenticated visit to classroom.google.com bounces to the Workspace for
 * Education marketing page (edu.google.com/.../classroom/), not accounts.google.com.
 * Verified live 2026-09-19 against the fresh dedicated profile.
 */
export function isSignedOutLanding(url: string): boolean {
  return isSignInRedirect(url) || /^https:\/\/edu\.google\.com\//.test(url);
}

/** True when the URL is a signed-in classroom.google.com page. */
export function isClassroomUrl(url: string): boolean {
  return /^https:\/\/classroom\.google\.com/.test(url);
}

/** Best-effort email extraction from the Google Account avatar aria-label. */
export function parseAccountEmail(ariaLabel: string | null): string | null {
  if (!ariaLabel) return null;
  const m = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(ariaLabel);
  return m ? m[1] : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
