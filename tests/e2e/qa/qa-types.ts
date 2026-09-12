// filepath: tests/e2e/qa/qa-types.ts
/**
 * ============================================================================
 * QA TYPES — the contracts between QA journeys, the collector, and the report
 * ============================================================================
 *
 * From docs/superpowers/specs/2026-09-12-manual-qa-replay-design.md. The
 * report generator consumes these artifacts WITHOUT Playwright.
 */

export type QaStatus = "passed" | "failed" | "skipped";

/**
 * Why a check failed:
 * - PRODUCT: CQD itself behaved incorrectly.
 * - HARNESS: the simulator/test implementation is broken.
 * - ENVIRONMENT: the browser/runtime prevented the check.
 */
export type FailureClass = "PRODUCT" | "HARNESS" | "ENVIRONMENT";

export type QaBrowser = "chromium" | "firefox";

export interface AssertionResult {
  description: string;
  passed: boolean;
  details?: string;
}

export interface DownloadEvidence {
  filename: string;
  expectedFilename?: string;
  size: number;
  contentValid: boolean;
}

export interface QaCheckResult {
  checkId: string;
  runbookReference: string;
  browser: QaBrowser;
  status: QaStatus;
  failureClass?: FailureClass;
  durationMs: number;
  screenshots: string[];
  consoleErrors: string[];
  downloads: DownloadEvidence[];
  assertions: AssertionResult[];
  error?: string;
  runId?: string;
  scenario?: Record<string, unknown>;
}

/** The console policy (spec): which captured messages fail a check. */
export interface ConsolePolicy {
  /** Uncaught page errors always fail — a human sees these immediately. */
  failOnPageErrors: true;
  /** console.error from extension-origin code fails the check. */
  failOnExtensionErrors: true;
  /** console.error/warn from simulator pages or the browser: record only. */
  recordOnlyNonExtension: true;
}

export const RUN_ID_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/;
