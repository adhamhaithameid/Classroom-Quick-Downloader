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
  const browser: QaBrowser = testInfo.project.name === "qa-firefox" ? "firefox" : "chromium";
  const check = new QaCheck(
    { browser, checkId, runbookReference, runId: currentRunId() },
    page,
    consoleCapture,
  );
  try {
    await body(check);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof ProductFailure) {
      check.fail("PRODUCT", message);
    } else if (error instanceof HarnessFailure) {
      check.fail("HARNESS", message);
    } else {
      check.fail("HARNESS", `unexpected harness error: ${message}`);
    }
  }
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
  close: () => Promise<void>;
}

export async function launchQaContext(
  browser: QaBrowser,
  scenario: Scenario,
): Promise<QaSession> {
  const sim = await startSimulatorProxy(scenario);

  const context =
    browser === "chromium"
      ? await chromium.launchPersistentContext("", {
          headless: false,
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
          headless: false,
          acceptDownloads: true,
          ignoreHTTPSErrors: true,
          proxy: { server: sim.url },
          firefoxUserPrefs: {
            "xpinstall.signatures.required": false,
            "extensions.autoDisableScopes": 0,
            "extensions.enabledScopes": 15,
          },
        });

  return {
    context,
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
