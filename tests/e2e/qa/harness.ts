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
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { AssertionResult, QaBrowser, QaCheckResult, QaStatus } from "./qa-types";

const REPO_ROOT = path.resolve(__dirname, "../../..");
export const CHROMIUM_EXTENSION_PATH = path.join(REPO_ROOT, "extension/.output/chrome-mv3");
export const FIREFOX_PROFILE_DIR = path.join(REPO_ROOT, "tests/e2e/.firefox-profile");
export const ARTIFACTS_ROOT = path.join(REPO_ROOT, "qa-artifacts");

// ---------------------------------------------------------------------------
// Context launching — one persistent context per spec file, like core-flow.
// ---------------------------------------------------------------------------

export async function launchQaChromium(): Promise<BrowserContext> {
  return chromium.launchPersistentContext("", {
    headless: false,
    acceptDownloads: true,
    args: [
      `--disable-extensions-except=${CHROMIUM_EXTENSION_PATH}`,
      `--load-extension=${CHROMIUM_EXTENSION_PATH}`,
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--disable-default-apps",
    ],
  });
}

/**
 * Firefox loads the MV2 build from a pre-prepared profile (global-setup zips
 * the build into <profile>/extensions/<gecko-id>.xpi and writes the prefs
 * that allow unsigned installation). Chromium's --load-extension flag does
 * not exist in Firefox — this profile route is the supported loading path.
 */
export async function launchQaFirefox(): Promise<BrowserContext> {
  if (!fs.existsSync(path.join(FIREFOX_PROFILE_DIR, "extensions"))) {
    throw new Error(
      "ENVIRONMENT: Firefox extension profile not prepared. Run the global setup (pnpm test:qa:firefox triggers it).",
    );
  }
  return firefox.launchPersistentContext(FIREFOX_PROFILE_DIR, {
    headless: false,
    acceptDownloads: true,
    firefoxUserPrefs: {
      "xpinstall.signatures.required": false,
      "extensions.autoDisableScopes": 0,
      "extensions.enabledScopes": 15,
    },
  });
}

export async function launchQaContext(browser: QaBrowser): Promise<BrowserContext> {
  return browser === "chromium" ? launchQaChromium() : launchQaFirefox();
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
