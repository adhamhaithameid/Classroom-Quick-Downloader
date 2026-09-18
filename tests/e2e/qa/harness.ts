// filepath: tests/e2e/qa/harness.ts
/**
 * ============================================================================
 * QA HARNESS — context launching, evidence collection, artifact writing
 * ============================================================================
 *
 * Shared by every qa-XX journey. Owns:
 * - launching the BUILT extension in Chromium (MV3) or Firefox (MV2),
 * - the evidence collector (screenshots with stable names, console capture
 *   under the documented policy, download evidence),
 * - writing per-check result.json artifacts under qa-artifacts/<run-id>/.
 *
 * Failure classification lives at the journey call sites — the harness only
 * carries the declared class into the artifact.
 */

import fs from "node:fs";
import path from "node:path";
import {
  chromium,
  firefox,
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Scenario } from "../../simulator/scenario";
import { startSimulatorProxy } from "../../simulator/proxy";
import type { AssertionResult, QaBrowser, QaCheckResult, QaStatus } from "./qa-types";

const REPO_ROOT = path.resolve(__dirname, "../../..");
export const CHROMIUM_EXTENSION_PATH = path.join(REPO_ROOT, "extension/.output/chrome-mv3");
export const FIREFOX_PROFILE_DIR = path.join(REPO_ROOT, "tests/e2e/.firefox-profile");
export const ARTIFACTS_ROOT = path.join(REPO_ROOT, "qa-artifacts");

// ---------------------------------------------------------------------------
// Product selectors — the ONE place QA journeys read product classes from.
// A deliberate product-side rename must change this file; qa-01 then fails
// until the journey is updated, which is the regression-detection contract.
// ---------------------------------------------------------------------------

export const SELECTORS = {
  downloadButton: "button.cqd-download-btn",
  downloadAllButton: "button.cqd-download-all-btn",
  injectedMarker: '[data-cqd-injected="true"]',
  attachmentContainerStream: ".luto0c",
  attachmentContainerDetails: ".KlRXdf",
  attachmentContainerSubmissions: ".WkZsyc",
  commentBadge: ".cqd-comment-badge",
  editedBadge: ".cqd-edited-badge",
  bothOverlay: ".cqd-overlay-container",
  bothBadge: ".cqd-both-badge",
  v2Flag: ".cqd-v2-flag",
  postCard: "article.n4xnA.JUr7jb[data-stream-item-id]",
  countChip: ".qCWAqb .huI6Cb",
  commentShellCount: ".comment-shell .comment-count",
} as const;

/** CQD behaved incorrectly. Fix CQD, not the test. */
export class ProductFailure extends Error {}
/** The simulator/test implementation is broken. */
export class HarnessFailure extends Error {}

/** The one Playwright-run-scoped run id (shared by all checks in a run). */
let RUN_ID: string | null = null;
export function currentRunId(): string {
  if (!RUN_ID) RUN_ID = newRunId();
  return RUN_ID;
}

/**
 * Set when the extension host is unavailable in this browser project (Firefox
 * signing limitation). runCheck skips every check with this reason; beforeAll
 * hooks consult session.extensionAvailable to bail before touching UI.
 */
let EXTENSION_UNAVAILABLE_REASON: string | null = null;

/** Skip the current test when the extension host is unavailable (Firefox). */
export function skipWhenExtensionUnavailable(): void {
  if (EXTENSION_UNAVAILABLE_REASON) test.skip(true, EXTENSION_UNAVAILABLE_REASON);
}

/**
 * Map a Playwright project name to the QA browser it drives. qa-firefox and
 * its signed sibling qa-firefox-signed drive Firefox; everything else is
 * Chromium.
 */
export function projectBrowser(projectName: string): QaBrowser {
  return projectName.startsWith("qa-firefox") ? "firefox" : "chromium";
}

/**
 * Run one QA check: body executes against a live page; every assertion goes
 * through the check collector; the result artifact is always written; the
 * re-thrown error makes the Playwright test itself reflect the outcome.
 */
export async function runCheck(
  testInfo: { project: { name: string } },
  page: Page,
  consoleCapture: ConsoleCapture,
  checkId: string,
  runbookReference: string,
  body: (check: QaCheck) => Promise<void>,
): Promise<void> {
  const browser: QaBrowser = projectBrowser(testInfo.project.name);
  skipWhenExtensionUnavailable();
  const check = new QaCheck(
    { browser, checkId, runbookReference, runId: currentRunId() },
    page,
    consoleCapture,
  );
  let skipSignal = false;
  try {
    await body(check);
  } catch (error) {
    if ((error as Error).message?.startsWith("SKIPPED: ")) {
      skipSignal = true;
    } else {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof ProductFailure) {
        check.fail("PRODUCT", message);
      } else if (error instanceof HarnessFailure) {
        check.fail("HARNESS", message);
      } else {
        check.fail("HARNESS", `unexpected harness error: ${message}`);
      }
    }
  }
  if (skipSignal) check.status = "skipped";
  const result = await check.write();
  if (result.status === "failed") {
    expect(result.status, `[${result.checkId}] ${result.failureClass}: ${result.error ?? "see result.json"}`).toBe("passed");
  }
  if (result.status === "skipped") {
    test.skip();
  }
}

// ---------------------------------------------------------------------------
// Context launching — one persistent context per spec file, like core-flow.
//
// The context is pointed at the simulator's local MITM proxy (started here
// per context), which is the ONLY network surface in a QA run: classroom /
// drive / docs are served deterministically and everything else dies. The
// proxy exists because Playwright route interception cannot feed Chromium's
// download manager — real downloads must flow through a real socket.
// ---------------------------------------------------------------------------

export interface QaSession {
  context: BrowserContext;
  servedDownloads: () => { url: string; filename: string }[];
  /** False when the extension host never came up (Firefox ENVIRONMENT limit). */
  extensionAvailable: boolean;
  close: () => Promise<void>;
}

export async function launchQaContext(
  browser: QaBrowser,
  scenario: Scenario,
  opts: { skipIfExtensionUnavailable?: boolean } = {},
): Promise<QaSession> {
  const sim = await startSimulatorProxy(scenario);

  const context =
    browser === "chromium"
      ? await chromium.launchPersistentContext("", {
          // New headless (channel 'chromium') supports extensions; the bundled
          // old-headless build does not.
          channel: "chromium",
          headless: true,
          acceptDownloads: true,
          ignoreHTTPSErrors: true,
          proxy: { server: sim.url },
          args: [
            `--disable-extensions-except=${CHROMIUM_EXTENSION_PATH}`,
            `--load-extension=${CHROMIUM_EXTENSION_PATH}`,
            "--disable-blink-features=AutomationControlled",
            "--no-first-run",
            "--disable-default-apps",
            // The download manager verifies certificates outside Playwright's
            // ignoreHTTPSErrors reach; the simulator's test-only CA must be
            // accepted there or chrome.downloads fails with a cert error.
            "--ignore-certificate-errors",
          ],
        })
      : await firefox.launchPersistentContext(FIREFOX_PROFILE_DIR, {
          headless: true,
          acceptDownloads: true,
          ignoreHTTPSErrors: true,
          proxy: { server: sim.url },
          firefoxUserPrefs: {
            "xpinstall.signatures.required": false,
            "extensions.autoDisableScopes": 0,
            "extensions.enabledScopes": 15,
          },
        });

  // Firefox ENVIRONMENT limitation (verified by probe, 2026-09-13): the xpi is
  // present in the profile before launch, and Playwright's bundled Firefox
  // build DELETES it within seconds of startup — it ignores
  // xpinstall.signatures.required=false, rejects the unsigned add-on and
  // removes the file, so no background page ever exists. Extension journeys
  // therefore cannot run there; runCheck skips them with this evidence instead
  // of failing. Chromium journeys must still fail hard (e.g. the
  // .cqd-download-btn rename detection criterion), so the probe never skips.
  //
  // Signed mode (S11 T3): with QA_SIGNED_XPI set, global-setup installed an
  // AMO-signed xpi, which Firefox accepts — the skip downgrade does not
  // apply. A missing background page then fails hard downstream
  // (getExtensionBase), which is the correct signal for a signed build.
  let extensionAvailable = true;
  const signedXpiMode = Boolean(process.env.QA_SIGNED_XPI);
  if (browser === "firefox" && !signedXpiMode && opts.skipIfExtensionUnavailable !== false) {
    let pages = context.backgroundPages();
    if (pages.length === 0) {
      await context
        .waitForEvent("backgroundpage", { timeout: 5_000 })
        .catch(() => undefined);
      pages = context.backgroundPages();
    }
    if (pages.length === 0) {
      extensionAvailable = false;
      EXTENSION_UNAVAILABLE_REASON =
        "ENVIRONMENT: Playwright's bundled Firefox deletes the unsigned sideloaded xpi at startup (signing pref ignored) — no extension background page; see RUNBOOK firefox section";
    }
  }

  return {
    context,
    extensionAvailable,
    servedDownloads: () => sim.servedDownloads,
    close: async () => {
      // A group left mid-run keeps Chromium's download manager retrying, which
      // can stall a graceful close — force-kill the browser and bound every
      // step so a wedged socket can never hang the test run.
      const graceful = context.close().then(() => "closed").catch(() => "closed");
      const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 10_000));
      const outcome = await Promise.race([graceful, timeout]);
      if (outcome === "timeout") {
        try {
          context.browser()?.process()?.kill("SIGKILL");
        } catch {
          /* firefox has no process handle; the OS reaps it at runner exit */
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      await sim.close();
    },
  };
}

/**
 * Base URL of the built extension (chrome-extension://<id> or
 * moz-extension://<uuid>) — needed to open the popup page.
 */
export async function getExtensionBase(context: BrowserContext, browser: QaBrowser): Promise<string> {
  if (browser === "chromium") {
    let workers = context.serviceWorkers();
    if (workers.length === 0) {
      await context.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => undefined);
      workers = context.serviceWorkers();
    }
    if (workers.length === 0) throw new Error("ENVIRONMENT: extension service worker not found");
    const url = workers[0].url();
    return url.substring(0, url.indexOf("/", "chrome-extension://".length));
  }
  // Firefox MV2: background page carries the moz-extension UUID.
  let pages = context.backgroundPages();
  if (pages.length === 0) {
    await context.waitForEvent("backgroundpage", { timeout: 15_000 }).catch(() => undefined);
    pages = context.backgroundPages();
  }
  if (pages.length === 0) throw new Error("ENVIRONMENT: extension background page not found");
  const url = pages[0].url();
  return url.substring(0, url.indexOf("/", "moz-extension://".length));
}

/** Run a function inside the extension's background context (SW or bg page). */
export async function withExtensionBackground<T>(
  context: BrowserContext,
  browser: QaBrowser,
  fn: (target: { evaluate: (fn: () => unknown) => Promise<unknown> }) => Promise<T>,
): Promise<T> {
  let target: { evaluate: (fn: () => unknown) => Promise<unknown> };
  if (browser === "chromium") {
    let workers = context.serviceWorkers();
    if (workers.length === 0) {
      await context.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => undefined);
      workers = context.serviceWorkers();
    }
    if (!workers[0]) throw new Error("ENVIRONMENT: extension service worker not found");
    target = workers[0];
  } else {
    let pages = context.backgroundPages();
    if (pages.length === 0) {
      await context.waitForEvent("backgroundpage", { timeout: 15_000 }).catch(() => undefined);
      pages = context.backgroundPages();
    }
    if (!pages[0]) {
      // Firefox MV2: the background script exists, but Playwright does not
      // expose extension background pages on Firefox at all — this helper is
      // a Chromium-only seam. The extension itself is proven by the
      // content-script journeys (qa-01/02/05), so classify as HARNESS, not
      // ENVIRONMENT.
      throw new Error(
        "SKIPPED: HARNESS: Playwright does not expose extension background pages on Firefox (MV2); background-seam checks are Chromium-only — content-script journeys cover the extension",
      );
    }
    target = pages[0];
  }
  return fn(target);
}

// ---------------------------------------------------------------------------
// Console capture under the documented policy
// ---------------------------------------------------------------------------

export interface ConsoleCapture {
  /** Severe extension-origin problems — these fail the check. */
  severe: string[];
  /** Everything else, recorded for the artifact but never failing. */
  recorded: string[];
}

export function captureConsole(page: Page): ConsoleCapture {
  const capture: ConsoleCapture = { severe: [], recorded: [] };
  page.on("pageerror", (error) => {
    capture.severe.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      // Extension code logs with the [CQD prefix; a severe extension error is
      // exactly what a human tester would notice. Simulator/browser noise is
      // recorded only.
      const text = message.text();
      if (text.includes("[CQD") || text.includes("cqd")) {
        capture.severe.push(`console.error: ${text}`);
      } else {
        capture.recorded.push(`console.error: ${text}`);
      }
    } else if (message.type() === "warning") {
      capture.recorded.push(`console.warn: ${message.text()}`);
    }
  });
  return capture;
}

// ---------------------------------------------------------------------------
// Evidence collector
// ---------------------------------------------------------------------------

export interface CheckContext {
  browser: QaBrowser;
  checkId: string;
  runbookReference: string;
  /** Run id — create once per suite with newRunId(). */
  runId: string;
}

export class QaCheck {
  readonly context: CheckContext;
  private readonly startedAt = Date.now();
  private readonly screenshots: string[] = [];
  private readonly downloads: QaCheckResult["downloads"] = [];
  private readonly assertions: AssertionResult[] = [];
  private readonly page: Page;
  private readonly consoleCapture: ConsoleCapture;
  private step = 0;
  status: QaStatus = "passed";
  failureClass?: QaCheckResult["failureClass"];
  error?: string;

  constructor(context: CheckContext, page: Page, consoleCapture: ConsoleCapture) {
    this.context = context;
    this.page = page;
    this.consoleCapture = consoleCapture;
  }

  get dir(): string {
    return path.join(ARTIFACTS_ROOT, this.context.runId, this.context.browser, "checks", this.context.checkId);
  }

  async screenshot(name: string): Promise<string> {
    this.step += 1;
    const fileName = `${String(this.step).padStart(2, "0")}-${name}.png`;
    const outDir = path.join(this.dir, "screenshots");
    fs.mkdirSync(outDir, { recursive: true });
    const abs = path.join(outDir, fileName);
    await this.page.screenshot({ path: abs, fullPage: true });
    const rel = path.relative(ARTIFACTS_ROOT, abs);
    this.screenshots.push(rel);
    return rel;
  }

  assert(description: string, passed: boolean, details?: string): void {
    this.assertions.push({ description, passed, details });
    if (!passed && this.status === "passed") {
      this.status = "failed";
    }
  }

  expect(description: string, actual: unknown, expected: unknown): void {
    const passed = actual === expected;
    this.assert(description, passed, `actual: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
  }

  addDownload(evidence: QaCheckResult["downloads"][number]): void {
    this.downloads.push(evidence);
  }

  fail(failureClass: QaCheckResult["failureClass"], message: string): void {
    this.status = "failed";
    this.failureClass = failureClass;
    this.error = message;
  }

  skip(reason: string): void {
    this.status = "skipped";
    this.error = reason;
    throw new Error(`SKIPPED: ${reason}`);
  }

  /** Apply the console policy: severe extension-origin problems fail the check. */
  applyConsolePolicy(): void {
    if (this.status === "passed" && this.consoleCapture.severe.length > 0) {
      this.status = "failed";
      this.failureClass = "PRODUCT";
      this.error = `severe extension console errors: ${this.consoleCapture.severe.join(" | ")}`;
    }
  }

  async write(): Promise<QaCheckResult> {
    this.applyConsolePolicy();
    const result: QaCheckResult = {
      checkId: this.context.checkId,
      runbookReference: this.context.runbookReference,
      browser: this.context.browser,
      status: this.status,
      failureClass: this.status === "failed" ? this.failureClass ?? "PRODUCT" : undefined,
      durationMs: Date.now() - this.startedAt,
      screenshots: this.screenshots,
      consoleErrors: [...this.consoleCapture.severe, ...this.consoleCapture.recorded],
      downloads: this.downloads,
      assertions: this.assertions,
      error: this.error,
      runId: this.context.runId,
    };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(path.join(this.dir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  }
}

/** Run-id: sortable, filesystem-safe. One per full QA run. */
export function newRunId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

export function getRunId(suiteRunId?: string): string {
  return suiteRunId ?? newRunId();
}

// ---------------------------------------------------------------------------
// Service-worker probe: record the background download machine's
// chrome.downloads calls + onChanged transitions where they actually run.
// ---------------------------------------------------------------------------

export interface SwProbe {
  downloads: string[];
}

export async function instrumentSw(
  context: BrowserContext,
  swUrlMatch: string,
): Promise<() => Promise<SwProbe>> {
  let sw = context.serviceWorkers().find((w) => w.url().includes(swUrlMatch));
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 15_000 }).catch(() => undefined);
  if (!sw) {
    // Firefox MV2 runs no extension service worker and Playwright does not
    // expose its background page — Chromium-only seam, HARNESS classification.
    throw new Error(
      "SKIPPED: HARNESS: no extension service worker — Playwright does not expose Firefox MV2 background contexts; background-seam probes are Chromium-only — content-script journeys cover the extension",
    );
  }
  await sw.evaluate(() => {
    const w = self as unknown as {
      __cqdProbe: { downloads: string[] };
      chrome: {
        downloads: {
          download: (opts: unknown, cb?: (id?: number) => void) => void;
          onChanged: { addListener: (fn: (delta: { id: number; state?: { current: string } }) => void) => void };
        };
        runtime: { lastError?: { message?: string } };
      };
    };
    w.__cqdProbe = { downloads: [] };
    const api = w.chrome.downloads;
    const orig = api.download.bind(api);
    api.download = (opts: unknown, cb?: (id?: number) => void) => {
      w.__cqdProbe.downloads.push(`start ${JSON.stringify(opts).slice(0, 140)}`);
      return orig(opts, (id?: number) => {
        w.__cqdProbe.downloads.push(`callback id=${id} err=${w.chrome.runtime.lastError?.message ?? "none"}`);
        cb?.(id);
      });
    };
    api.onChanged.addListener((delta) => {
      w.__cqdProbe.downloads.push(`onChanged id=${delta.id} state=${delta.state ? delta.state.current : "?"}`);
    });
  });
  return () => sw!.evaluate(() => (self as unknown as { __cqdProbe: SwProbe }).__cqdProbe);
}
