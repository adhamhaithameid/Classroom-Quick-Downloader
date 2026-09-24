// filepath: tests/e2e/live/live-harness.ts
/**
 * ============================================================================
 * LIVE HARNESS — real-browser context on the signed-in dedicated profile
 * ============================================================================
 *
 * Shared by every live-*.spec.ts. Owns:
 * - the LIVE_CLASSROOM=1 gate + actionable skip reasons,
 * - launching a PERSISTENT context on the dedicated profile
 *   (tests/e2e/.live-profile, gitignored) with the built extension loaded,
 * - signed-in probing per authuser (u/0, u/1 — teacher/student accounts),
 * - the service-worker download probe that verifies REAL files land on disk
 *   (chrome.downloads.search: filename + totalBytes + mime),
 * - evidence artifacts under qa-artifacts/live/<run-id>/.
 *
 * The profile is created ONCE by `pnpm test:live:login` (a headed browser the
 * human signs into with their real Google accounts). Every later run reuses
 * those cookies — Google's login flow itself is never automated.
 *
 * SAFETY: the live specs interact read-only with Classroom (navigation,
 * DOM inspection, downloads of files the signed-in account already sees).
 * They never create, submit, grade, or delete anything.
 */

import fs from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { isClassroomUrl, isSignedOutLanding } from "./parse";

const REPO_ROOT = path.resolve(__dirname, "../../..");
export const EXTENSION_PATH = path.join(REPO_ROOT, "extension/.output/chrome-mv3");
export const PROFILE_DIR = path.join(REPO_ROOT, "tests/e2e/.live-profile");
export const LIVE_ARTIFACTS_ROOT = path.join(REPO_ROOT, "qa-artifacts/live");

/** classroom.google.com base for a given authuser. */
export function classroomHomeUrl(authuser: number): string {
  return `https://classroom.google.com/u/${authuser}/h`;
}

/** Absolute URL for a normalized /u/N/... path from parse.ts. */
export function absoluteClassroomUrl(authuserPath: string): string {
  return `https://classroom.google.com${authuserPath}`;
}

/**
 * Parse the target authuser list (LIVE_AUTHUSERS, default "0,1" — most
 * maintainers keep the teacher and student accounts side by side).
 */
export function liveAuthusers(): number[] {
  return (process.env.LIVE_AUTHUSERS ?? "0,1")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

/**
 * The skip gate. Returns null when the live suite may run, otherwise the
 * actionable reason (rendered by test.skip so the operator knows exactly
 * what to do next).
 */
export function liveGateReason(): string | null {
  if (process.env.LIVE_CLASSROOM !== "1") {
    return "live suite is gated: set LIVE_CLASSROOM=1 (see docs/LIVE_CLASSROOM_TESTING.md)";
  }
  if (!fs.existsSync(PROFILE_DIR)) {
    return `no live profile at ${path.relative(REPO_ROOT, PROFILE_DIR)} — run \`pnpm test:live:login\` once and sign in with your Google account(s)`;
  }
  return null;
}

/**
 * Launch the persistent live context: the dedicated signed-in profile with
 * the built extension loaded. Headless by default (new headless supports
 * extensions); E2E_HEADED=1 shows a real window — the fallback if Google's
 * heuristics ever object. LIVE_CHANNEL overrides the browser build
 * (e.g. LIVE_CHANNEL=chrome for installed Google Chrome).
 */
export async function launchLiveContext(runId: string): Promise<BrowserContext> {
  const downloadsDir = path.join(LIVE_ARTIFACTS_ROOT, runId, "downloads");
  fs.mkdirSync(downloadsDir, { recursive: true });
  return chromium.launchPersistentContext(PROFILE_DIR, {
    channel: process.env.LIVE_CHANNEL ?? "chromium",
    headless: process.env.E2E_HEADED !== "1",
    acceptDownloads: true,
    downloadsPath: downloadsDir,
    timeout: 120_000,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
      // A reused profile may have crashed once; the restore bubble would
      // otherwise sit over the page and eat the first click.
      "--hide-crash-restore-bubble",
      "--disable-session-crashed-bubble",
    ],
  });
}

// ---------------------------------------------------------------------------
// Signed-in probing
// ---------------------------------------------------------------------------

export interface LiveAccountProbe {
  authuser: number;
  signedIn: boolean;
  finalUrl: string;
  /** Best-effort account email (avatar aria-label), null when not readable. */
  email: string | null;
}

/**
 * Probe one authuser: navigate to its Classroom home and classify where the
 * browser settled. A signed-in session stays on classroom.google.com; a
 * missing session bounces to accounts.google.com (sign-in or account chooser).
 */
export async function probeSignedIn(page: Page, authuser: number): Promise<LiveAccountProbe> {
  const target = classroomHomeUrl(authuser);
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Google SPA-redirects after the initial response; poll the URL until it
  // settles on either host (bounded, no magic single sleep).
  let finalUrl = page.url();
  for (let i = 0; i < 10; i += 1) {
    finalUrl = page.url();
    // Signed-out lands on accounts.google.com (sign-in/chooser) or the
    // edu.google.com marketing page — both settle quickly, stop early.
    if (isSignedOutLanding(finalUrl)) break;
    if (isClassroomUrl(finalUrl) && /\/u\/\d+/.test(finalUrl)) break;
    await page.waitForTimeout(1_500);
  }
  await page.waitForTimeout(3_000); // let the SPA shell render before reading it
  finalUrl = page.url();
  const signedIn = isClassroomUrl(finalUrl) && !isSignedOutLanding(finalUrl);
  let email: string | null = null;
  if (signedIn) {
    email = await page
      .evaluate(() => {
        const el = document.querySelector<HTMLElement>(
          "a[aria-label*='Google Account'], div[aria-label*='Google Account'], img[aria-label*='@']",
        );
        return el?.getAttribute("aria-label");
      })
      .then((label) => {
        const m = label ? /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(label) : null;
        return m ? m[1] : null;
      })
      .catch(() => null);
  }
  return { authuser, signedIn, finalUrl, email };
}

// ---------------------------------------------------------------------------
// Real-download verification — service-worker probe
// ---------------------------------------------------------------------------

export interface LiveDownloadEvent {
  phase: "start" | "state" | "lookup";
  url?: string;
  id?: number;
  state?: string;
  filename?: string;
  totalBytes?: number;
  mime?: string;
  existsOnDisk?: boolean;
}

export interface LiveDownloadProbe {
  events: LiveDownloadEvent[];
}

type SwHandle = { evaluate: (fn: () => unknown) => Promise<unknown> };

/**
 * Instrument the extension's MV3 service worker where CQD actually calls
 * chrome.downloads: record download() starts, onChanged state transitions,
 * and — on completion — a downloads.search lookup that yields the REAL file
 * path, size, and mime. This is the strongest evidence a live download test
 * can produce: the file exists on disk with bytes in it.
 */
export async function instrumentLiveDownloads(
  context: BrowserContext,
): Promise<() => Promise<LiveDownloadProbe>> {
  let sw = context.serviceWorkers().find((w) => w.url().includes("background"));
  if (!sw) {
    sw = await context.waitForEvent("serviceworker", { timeout: 20_000 }).catch(() => undefined);
  }
  if (!sw) throw new Error("ENVIRONMENT: extension service worker not found in live context");

  await sw.evaluate(() => {
    const w = self as unknown as {
      __cqdLiveProbe: { events: unknown[] };
      chrome: {
        downloads: {
          download: (opts: unknown, cb?: (id?: number) => void) => void;
          search: (query: unknown, cb: (results: unknown[]) => void) => void;
          onChanged: { addListener: (fn: (delta: { id: number; state?: { current: string } }) => void) => void };
        };
        runtime: { lastError?: { message?: string } };
      };
    };
    w.__cqdLiveProbe = { events: [] };
    const api = w.chrome.downloads;
    const record = (event: unknown) => {
      w.__cqdLiveProbe.events.push(event);
    };
    const orig = api.download.bind(api);
    api.download = (opts: unknown, cb?: (id?: number) => void) => {
      record({ phase: "start", url: String((opts as { url?: string })?.url ?? "").slice(0, 200) });
      return orig(opts, (id?: number) => {
        record({ phase: "start", id, state: `callback err=${w.chrome.runtime.lastError?.message ?? "none"}` });
        cb?.(id);
      });
    };
    api.onChanged.addListener((delta) => {
      record({ phase: "state", id: delta.id, state: delta.state?.current });
      if (delta.state?.current === "complete") {
        api.search({ id: delta.id }, (results) => {
          const r = results[0] as { filename?: string; totalBytes?: number; mime?: string } | undefined;
          if (r) {
            record({
              phase: "lookup",
              id: delta.id,
              filename: r.filename,
              totalBytes: r.totalBytes,
              mime: r.mime,
            });
          }
        });
      }
    });
  });

  const swHandle = sw as SwHandle;
  return async (): Promise<LiveDownloadProbe> => {
    const probe = (await swHandle.evaluate(() =>
      (self as unknown as { __cqdLiveProbe: LiveDownloadProbe }).__cqdLiveProbe,
    )) as LiveDownloadProbe;
    // existsOnDisk is verified runner-side: the browser is local, so the
    // filename reported by downloads.search is readable from the test process.
    for (const event of probe.events) {
      if (event.phase === "lookup" && event.filename) {
        try {
          event.existsOnDisk = fs.existsSync(event.filename) && fs.statSync(event.filename).size > 0;
        } catch {
          event.existsOnDisk = false;
        }
      }
    }
    return probe;
  };
}

/** Completed, verified downloads (lookup events whose file really exists). */
export function verifiedDownloads(probe: LiveDownloadProbe): LiveDownloadEvent[] {
  return probe.events.filter((e) => e.phase === "lookup" && e.existsOnDisk === true);
}

/** Wait until at least `count` verified downloads exist, else throw. */
export async function waitForVerifiedDownloads(
  getProbe: () => Promise<LiveDownloadProbe>,
  count: number,
  timeoutMs = 45_000,
): Promise<LiveDownloadEvent[]> {
  const deadline = Date.now() + timeoutMs;
  let latest: LiveDownloadProbe = { events: [] };
  while (Date.now() < deadline) {
    latest = await getProbe();
    if (verifiedDownloads(latest).length >= count) return verifiedDownloads(latest);
    await new Promise((r) => setTimeout(r, 1_500));
  }
  throw new Error(
    `expected ${count} verified download(s) within ${timeoutMs}ms, got ${verifiedDownloads(latest).length}; events: ${JSON.stringify(latest.events)}`,
  );
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

/** One stable run id per Playwright process (all specs share it). */
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
export function liveRunId(): string {
  return RUN_ID;
}

/**
 * Join an artifact path under `root` with a hard boundary: the resolved
 * target must stay inside the root (the segments are test-internal names,
 * but the boundary makes the artifact writer safe regardless).
 */
function artifactFileUnder(root: string, segments: string[]): string {
  const target = path.resolve(root, ...segments);
  const boundary = path.resolve(root) + path.sep;
  if (!target.startsWith(boundary)) {
    throw new Error(`artifact path escaped artifacts root: ${target}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return target;
}

export function liveArtifactDir(check: string): string {
  const dir = artifactFileUnder(LIVE_ARTIFACTS_ROOT, [RUN_ID, check]);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function liveArtifact(check: string, name: string, data: unknown): Promise<string> {
  const file = artifactFileUnder(liveArtifactDir(check), [path.basename(name)]);
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

export async function liveScreenshot(page: Page, check: string, name: string): Promise<string> {
  const file = artifactFileUnder(liveArtifactDir(check), [`${path.basename(name)}.png`]);
  await page.screenshot({ path: file, fullPage: true }).catch(() => undefined);
  return file;
}

// ---------------------------------------------------------------------------
// Live navigation helpers (bounded waits for the production SPA)
// ---------------------------------------------------------------------------

/**
 * Navigate to a classroom.google.com URL and wait for the SPA to settle.
 * Production Classroom renders progressively with obfuscated classes; a
 * bounded settle wait plus caller-side structural assertions is the most
 * drift-tolerant approach.
 */
export async function gotoLive(page: Page, url: string, settleMs = 6_000): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(settleMs);
}

/** Read the current DOM as a string for the pure parsers. */
export async function pageHtml(page: Page): Promise<string> {
  return page.evaluate(() => document.documentElement.outerHTML);
}
