// filepath: tests/e2e/live/parse.spec.ts
/**
 * ============================================================================
 * LIVE PARSER UNIT TESTS — offline, no browser, no Google, no auth
 * ============================================================================
 *
 * The live specs hit real classroom.google.com (gated by LIVE_CLASSROOM=1 and
 * a manually signed-in profile), so everything extractable from a page's HTML
 * must be proven HERE first: the parsers are the only part of the live suite
 * that can be exercised in CI. Fixtures mirror the structural contracts the
 * simulator (tests/simulator/pages/builder.ts) and the live canary rely on.
 *
 * Runs in the live-chromium project without any gate — it launches nothing.
 */

import { test, expect } from "@playwright/test";
import {
  authuserFromUrl,
  countCqdDownloadAllButtons,
  countCqdDownloadButtons,
  countDriveAttachments,
  countSubmissionAttachmentCards,
  detectRole,
  hasClassShell,
  isClassroomUrl,
  isSignInRedirect,
  isSignedOutLanding,
  parseAccountEmail,
  parseAssignmentLinks,
  parseClassCards,
} from "./parse";

// ---------------------------------------------------------------------------
// Class-card discovery (Classroom home "All classes" page)
// ---------------------------------------------------------------------------

test.describe("parseClassCards", () => {
  test("extracts personal-account class cards with aria-label names", () => {
    const html = `
      <main>
        <a aria-label="Physics 101" href="./u/0/c/MzI3NjM0NTgxMzMx" class="card"></a>
        <a aria-label="CQD Sandbox" href="./u/0/c/ODkxMjM0NTY3ODkw" class="card"></a>
      </main>`;
    const cards = parseClassCards(html);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({ id: "MzI3NjM0NTgxMzMx", name: "Physics 101", href: "/u/0/c/MzI3NjM0NTgxMzMx" });
    expect(cards[1].name).toBe("CQD Sandbox");
  });

  test("handles Workspace domain-namespaced hrefs and normalizes the path", () => {
    const html = `<a aria-label="Algebra" href="./u/1/a/school.edu/c/ABC123_-">x</a>`;
    const cards = parseClassCards(html);
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe("ABC123_-");
    expect(cards[0].href).toBe("/u/1/c/ABC123_-");
  });

  test("falls back to anchor text when aria-label is missing", () => {
    const html = `<a href="./u/0/c/CID1"><span><b>History</b> 9B</span></a>`;
    expect(parseClassCards(html)[0].name).toBe("History 9B");
  });

  test("dedupes overlapping anchors for the same class card", () => {
    const html = `
      <a aria-label="Same Class" href="./u/0/c/DUP1"></a>
      <a href="./u/0/c/DUP1">photo link</a>
      <a aria-label="Other" href="./u/0/c/DIF2"></a>`;
    const cards = parseClassCards(html);
    expect(cards.map((c) => c.id)).toEqual(["DUP1", "DIF2"]);
  });

  test("ignores non-class hrefs and returns empty for garbage HTML", () => {
    expect(parseClassCards(`<a href="./u/0/a/work-1">not a class</a>`)).toHaveLength(0);
    expect(parseClassCards(`<a href="https://mail.google.com/">mail</a>`)).toHaveLength(0);
    expect(parseClassCards("not html at all")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Assignment links (classwork page)
// ---------------------------------------------------------------------------

test.describe("parseAssignmentLinks", () => {
  test("extracts deduped assignment details links", () => {
    const html = `
      <li><a href="./u/0/c/CLS1/a/ITEM1/details">Worksheet</a></li>
      <li><a href="./u/0/c/CLS1/a/ITEM2">Reading</a></li>
      <li><a href="./u/0/c/CLS1/a/ITEM1/details">Worksheet (duplicate)</a></li>`;
    const links = parseAssignmentLinks(html);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ itemId: "ITEM1", href: "/u/0/c/CLS1/a/ITEM1/details" });
    expect(links[1].itemId).toBe("ITEM2");
  });

  test("ignores stream posts (/p/) and other-class links", () => {
    const html = `
      <a href="./u/0/c/CLS1/p/POST9">announcement</a>
      <a href="./u/0/c/CLS1/w/all">classwork tab</a>`;
    expect(parseAssignmentLinks(html)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Structural contract counters
// ---------------------------------------------------------------------------

test.describe("attachment/button counters", () => {
  test("counts drive attachment cards on details pages", () => {
    const html = `
      <div class="KlRXdf" data-drive-id="file-1"><a href="x">pdf</a></div>
      <div class="KlRXdf" data-drive-id="file-2"><a href="x">doc</a></div>`;
    expect(countDriveAttachments(html)).toBe(2);
    expect(countDriveAttachments("<div>none</div>")).toBe(0);
  });

  test("counts submission attachment cards (.WkZsyc contract)", () => {
    const html = `<div class="WkZsyc" data-submission-attachment-id="s1"></div>
      <div class="WkZsyc" data-submission-attachment-id="s2"></div>`;
    expect(countSubmissionAttachmentCards(html)).toBe(2);
  });

  test("counts CQD-injected buttons", () => {
    const html = `
      <button class="cqd-download-btn" data-cqd-sw="true">Download</button>
      <button class="cqd-download-btn">Download</button>
      <button class="cqd-download-all-btn">Download all</button>`;
    expect(countCqdDownloadButtons(html)).toBe(2);
    expect(countCqdDownloadAllButtons(html)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Role detection — the teacher/student split the suites depend on
// ---------------------------------------------------------------------------

test.describe("detectRole", () => {
  const shell = (inner: string) => `
    <div class="tabs">
      <a aria-label="Stream" href="./u/0/c/CLS1"></a>
      <a aria-label="Classwork" href="./u/0/c/CLS1/w/all"></a>
    </div>${inner}`;

  test("teacher: English announce compose box", () => {
    const d = detectRole(shell(`<div aria-label="Announce something to your class" role="textbox"></div>`));
    expect(d.role).toBe("teacher");
    expect(d.evidence[0]).toContain("stream compose box");
  });

  test("teacher: Arabic announce compose box", () => {
    const d = detectRole(shell(`<div aria-label="أعلن شيئًا لصفك"></div>`));
    expect(d.role).toBe("teacher");
  });

  test("teacher: classwork create button (en + ar)", () => {
    expect(detectRole(shell(`<div role="button" aria-label="Create"></div>`)).role).toBe("teacher");
    expect(detectRole(shell(`<div role="button" aria-label="إنشاء"></div>`)).role).toBe("teacher");
  });

  test("student: valid class shell with zero teacher signals", () => {
    const d = detectRole(shell(`<article data-stream-item-id="post-1"><p>Read chapter 4</p></article>`));
    expect(d.role).toBe("student");
    expect(d.evidence[0]).toContain("no teacher-only signals");
  });

  test("unknown: no class shell (interstitial, drift, wrong page)", () => {
    const d = detectRole(`<html><body>Sign in with Google</body></html>`);
    expect(d.role).toBe("unknown");
    expect(d.evidence[0]).toContain("no class shell");
  });
});

test.describe("hasClassShell", () => {
  test("recognizes the tab/stream contracts", () => {
    expect(hasClassShell(`<a aria-label="Stream" href="/u/0/c/1"></a>`)).toBe(true);
    expect(hasClassShell(`<a href="/u/0/c/1/w/all">Classwork</a>`)).toBe(true);
    expect(hasClassShell(`<div data-stream-item-id="x"></div>`)).toBe(true);
    expect(hasClassShell(`<a href="/u/0/c/1/p/abc">post</a>`)).toBe(true);
    expect(hasClassShell("<p>nothing here</p>")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// URL classification (signed-in probing)
// ---------------------------------------------------------------------------

test.describe("url helpers", () => {
  test("authuserFromUrl extracts the /u/N/ index", () => {
    expect(authuserFromUrl("https://classroom.google.com/u/1/h")).toBe(1);
    expect(authuserFromUrl("https://classroom.google.com/u/0/c/abc")).toBe(0);
    expect(authuserFromUrl("https://classroom.google.com/h")).toBeNull();
  });

  test("sign-in redirects and classroom URLs are told apart", () => {
    expect(isSignInRedirect("https://accounts.google.com/v3/signin/identifier?x=y")).toBe(true);
    expect(isSignInRedirect("https://accounts.google.com/ServiceLogin?continue=classroom")).toBe(true);
    expect(isSignInRedirect("https://classroom.google.com/u/0/h")).toBe(false);
    expect(isClassroomUrl("https://classroom.google.com/u/0/h")).toBe(true);
    expect(isClassroomUrl("https://accounts.google.com/v3/signin")).toBe(false);
  });

  test("the signed-out marketing landing is classified as signed-out", () => {
    // Verified live 2026-09-19: signed-out /u/0/h bounces to the marketing page.
    expect(isSignedOutLanding("https://edu.google.com/intl/en-US/workspace-for-education/products/classroom/")).toBe(true);
    expect(isSignedOutLanding("https://accounts.google.com/v3/signin")).toBe(true);
    expect(isSignedOutLanding("https://classroom.google.com/u/0/h")).toBe(false);
  });

  test("parseAccountEmail reads the account avatar aria-label", () => {
    expect(parseAccountEmail("Google Account: Adham Haitham (me@gmail.com)")).toBe("me@gmail.com");
    expect(parseAccountEmail("no email here")).toBeNull();
    expect(parseAccountEmail(null)).toBeNull();
  });
});
