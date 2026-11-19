/**
 * ============================================================================
 * QA - v3-base engineBase flag ON: API-truth file union over the V2 UI
 * ============================================================================
 *
 * Pins the 2026-11-18 v3-base design (docs/audit/2026-11-18-v3-base-design.md)
 * end to end in a real Chromium. No real Google call, no real token: the
 * Classroom API is stubbed with a context route intercept and the background
 * chrome.identity.getAuthToken is stubbed to a fixed string.
 *
 * (a) flag ON + API returns an API-only file: (a1) V2 buttons render, no error
 *     UI; (a2) Download All counts the union (2 DOM + 1 API-only = 3), phase 2
 *     commit 9ad86b5f. (a2) is test.fail(): NEEDS-DECISION, see the report.
 * (b) flag ON + API returns 401: the DOM result is unchanged (count 2) and
 *     no alert, toast or error banner appears.
 * (c) flag OFF: the post DOM is structurally identical whether the API
 *     answers with a file or with 401 (baseline captured in the same run).
 *
 * FLAG SEAM (documented, test wiring only): engineBase is module state with
 * no runtime setter wired to storage (see src/engines/engine-base.ts), so the
 * only seam in a real browser is a TEST-ONLY BUILD. beforeAll stages a copy of
 * extension/ into os.tmpdir(), flips the default line to 'v3' in the COPY
 * (flag-on build) or leaves it (flag-off build), flips
 * NON_CHROME_TOKEN_SOURCE_WIRED to true in both copies (Chromium for Testing
 * is not the Google Chrome brand), and adds a stub oauth2.web_client_id to the
 * copy's manifest so isApiConfigured() is true.
 * The repo source and extension/.output are never modified. If a runtime
 * setter is ever added, replace stageBuild with an init script.
 * ============================================================================
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { test, chromium, type BrowserContext, type Page } from "@playwright/test";
import { captureConsole, projectBrowser, runCheck, SELECTORS } from "./harness";
import { createScenario, drive, COURSE_ID } from "../../simulator/scenario";
import { startSimulatorProxy, type SimulatorProxy } from "../../simulator/proxy";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const EXTENSION_DIR = path.join(REPO_ROOT, "extension");
/** Per-run scratch root for the two test-only builds (never inside the repo). */
const BUILD_ROOT = path.join(os.tmpdir(), `cqd-v3base-e2e-${process.pid}`);
const builds: { on: string; off: string } = { on: "", off: "" };

// ---------------------------------------------------------------------------
// Scenario — a stream-shaped page (V2-canonicalizable drive anchors, exactly
// one tracked post for the reconciler's single-post gate) served AT a
// submission-tail URL, so resolveClassroomApiRouteContext resolves a
// non-null studentSubmissionId and the engine treats the view as
// student-work. The simulator keys routes by path, so the same URL serves
// the stream DOM contracts CQD's V2 layer scans.
// ---------------------------------------------------------------------------

const ASSIGNMENT_ID = "assign-v3base";
const SUBMISSION_ID = "sub-stu-77";
const PAGE_PATH = `/u/0/c/${COURSE_ID}/a/${ASSIGNMENT_ID}/submissions/${SUBMISSION_ID}`;
const DOM_FILE_A = "dom-file-aaa";
const DOM_FILE_B = "dom-file-bbb";
const API_FILE_ID = "api-file-999";
const API_FILE_NAME = "api-only-syllabus.pdf";

function scenario() {
  return createScenario({
    locale: "en",
    dir: "ltr",
    theme: "light",
    initialPath: PAGE_PATH,
    routes: [
      {
        path: PAGE_PATH,
        kind: "stream",
        posts: [
          {
            id: SUBMISSION_ID,
            body: "Assignment with attachments.",
            attachments: [drive(DOM_FILE_A, "homework-a.pdf"), drive(DOM_FILE_B, "homework-b.pdf")],
          },
        ],
      },
    ],
  });
}

function apiOkBody(): string {
  return JSON.stringify({
    studentSubmissions: [
      {
        id: SUBMISSION_ID,
        userId: "stu-1",
        state: "TURNED_IN",
        assignmentSubmission: {
          attachments: [{ driveFile: { id: API_FILE_ID, title: API_FILE_NAME } }],
        },
      },
    ],
  });
}

async function stubClassroomApi(
  context: BrowserContext,
  mode: "ok" | "unauthorized",
): Promise<void> {
  await context.unroute("**/classroom.googleapis.com/**");
  await context.route("**/classroom.googleapis.com/**", (route) => {
    if (mode === "unauthorized") {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: 401, message: "Unauthorized" } }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: apiOkBody() });
  });
}

/** Pre-seed mode 'v3' and stub the background token source before any page loads. */
async function primeBackground(context: BrowserContext): Promise<void> {
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  }
  await worker.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const c = (self as unknown as { chrome: any }).chrome;
        c.storage.local.set({ cqdV2Mode: "v3" }, () => resolve());
        if (c.identity?.getAuthToken) {
          c.identity.getAuthToken = (_opts: unknown, cb: (r: { token: string }) => void) =>
            cb({ token: "qa-stub-token" });
        }
      }),
  );
}

async function openPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`https://classroom.google.com${PAGE_PATH}`, { waitUntil: "domcontentloaded" });
  // First load warms the profile; re-prime mode + token stub, then reload so
  // the content script bootstraps into the intended state.
  await page.waitForSelector(SELECTORS.downloadButton, { timeout: 45_000 });
  await primeBackground(context);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(SELECTORS.downloadButton, { timeout: 45_000 });
  // Settle window: lets the async refresh and reconcile chain land.
  await page.waitForTimeout(3_000);
  return page;
}

async function allLabel(page: Page): Promise<string> {
  return (await page.locator(SELECTORS.downloadAllButton).first().getAttribute("aria-label")) ?? "";
}

/** Count of file-bearing V2 download buttons (data-cqd-file-id is V2's render seam). */
async function v2ButtonCount(page: Page): Promise<number> {
  return page.locator(`${SELECTORS.downloadButton}[data-cqd-file-id]`).count();
}

async function errorUiCounts(page: Page): Promise<string> {
  return JSON.stringify(
    await page.evaluate(() => ({
      allError: document.querySelectorAll(".cqd-all-error").length,
      alerts: document.querySelectorAll("[role='alert']").length,
      toasts: document.querySelectorAll("[class*='cqd-toast']").length,
    })),
  );
}

async function postHtml(page: Page): Promise<string> {
  return page.evaluate(() => {
    const row = document.querySelector("[data-stream-item-id]");
    return row ? row.outerHTML : "<missing-post>";
  });
}

function normalize(html: string): string {
  return html.replace(/chrome-extension:\/\/[a-p]{32}\//g, "chrome-extension://ID/");
}

/**
 * Structural profile for the flag-OFF comparison. Raw post HTML accumulates a
 * nondeterministic number of DUPLICATE hidden buttons (observer re-render
 * churn), so raw byte equality is run noise. The profile is strict where it is
 * deterministic: the button-free skeleton must match byte for byte and the
 * deduplicated set of rendered buttons must match exactly.
 */
function structuralProfile(html: string): string {
  const normalized = normalize(html);
  const buttons = [...normalized.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((m) => m[0]);
  const skeleton = normalized.replace(/<button\b[\s\S]*?<\/button>/g, "<button/>\n");
  return JSON.stringify({ skeleton, buttons: [...new Set(buttons)].sort() });
}

// ---------------------------------------------------------------------------
// Test-only builds (see FLAG SEAM in the header)
// ---------------------------------------------------------------------------

const BUILD_ENV = {
  ...process.env,
  PATH: `${process.env.HOME}/.local/bin:${process.env.PATH ?? ""}`,
};

function buildVariant(name: "on" | "off"): string {
  const dir = path.join(BUILD_ROOT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const entry of ["src", "entrypoints", "_locales", "assets", "tools", "package.json", "tsconfig.json", "wxt.config.ts"]) {
    const from = path.join(EXTENSION_DIR, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dir, entry), { recursive: true, force: true });
  }
  fs.symlinkSync(path.join(EXTENSION_DIR, "node_modules"), path.join(dir, "node_modules"), "dir");
  const patch = (rel: string, from: string, to: string) => {
    const file = path.join(dir, rel);
    const source = fs.readFileSync(file, "utf8");
    const patched = source.replace(from, to);
    if (patched === source) throw new Error(`harness: line not found in ${rel}: ${from}`);
    fs.writeFileSync(file, patched);
  };
  if (name === "on") {
    patch("src/engines/engine-base.ts", "let engineBase: EngineBase = 'v2';", "let engineBase: EngineBase = 'v3';");
  }
  // Both variants open the non-Chrome token gate (Chromium for Testing is not
  // the Google Chrome brand), so ONLY the engineBase flag differs.
  patch(
    "src/engines/v3/api/config.ts",
    "export const NON_CHROME_TOKEN_SOURCE_WIRED = false;",
    "export const NON_CHROME_TOKEN_SOURCE_WIRED = true;",
  );
  execSync("pnpm exec wxt build", { cwd: dir, env: BUILD_ENV, stdio: "pipe", timeout: 300_000 });
  const out = path.join(dir, ".output/chrome-mv3");
  // ADR-0010 owner prerequisite, stubbed: the web client id makes
  // isApiConfigured() true. Both variants get it so ONLY the flag differs.
  const manifestPath = path.join(out, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.oauth2 = {
    ...(manifest.oauth2 as Record<string, unknown> | undefined),
    web_client_id: "qa-stub-web-client-id.apps.googleusercontent.com",
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return out;
}

async function launchWithExtension(extensionPath: string): Promise<{
  context: BrowserContext;
  proxy: SimulatorProxy;
  close: () => Promise<void>;
}> {
  const sim = await startSimulatorProxy(scenario());
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    proxy: { server: sim.url },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
      "--ignore-certificate-errors",
    ],
  });
  return {
    context,
    proxy: sim,
    close: async () => {
      await context.close().catch(() => {});
      await sim.close();
    },
  };
}

async function withSession<T>(
  extensionPath: string,
  api: "ok" | "unauthorized",
  fn: (page: Page, context: BrowserContext) => Promise<T>,
): Promise<T> {
  const session = await launchWithExtension(extensionPath);
  try {
    await primeBackground(session.context);
    await stubClassroomApi(session.context, api);
    const page = await openPage(session.context);
    return await fn(page, session.context);
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// Journeys
// ---------------------------------------------------------------------------

test.describe("v3-base flag-on", () => {
  test.skip(projectBrowser("") === "firefox", "chromium-only journey");

  test.beforeAll(async () => {
    test.setTimeout(600_000);
    builds.on = buildVariant("on");
    builds.off = buildVariant("off");
  });

  test.afterAll(() => {
    fs.rmSync(BUILD_ROOT, { recursive: true, force: true });
  });

  test("(a1) flag ON + API-only file: V2 buttons render for the DOM files, no error UI", async ({}, testInfo) => {
    test.setTimeout(240_000);
    await withSession(builds.on, "ok", async (page) => {
      const capture = captureConsole(page);
      await runCheck(testInfo, page, capture, "v3-flag-a1", "BRIEF chat7 Part B (a)", async (check) => {
        check.expect("two DOM drive attachments render V2 buttons", await v2ButtonCount(page), 2);
        await page.waitForSelector(SELECTORS.downloadAllButton, { timeout: 30_000 });
        const flat = await errorUiCounts(page);
        check.assert("no error banner, alert role, or toast", flat === JSON.stringify({ allError: 0, alerts: 0, toasts: 0 }), flat);
        await check.screenshot("flag-on-api-ok");
      });
    });
  });

  // NEEDS-DECISION (product): with the flag ON and the API returning an
  // API-only file, the engine reaches 'snapshot ready' with 1 tracked post and
  // the API file in the snapshot, but the visible Download All label stays at
  // the DOM count (2). The V2 count sync (syncDownloadAllCount) selects by
  // [data-cqd-injected][data-cqd-file-id], and the rendered buttons in this
  // view carry no data-cqd-injected attribute, so the label is never rewritten.
  // test.fail() pins the gap: when the product is fixed this test starts
  // passing, Playwright reports it as an unexpected pass, and the marker must
  // be removed. See docs/session-logs/2026-11-19-e2e-flag-on.md.
  test("(a2) flag ON + API-only file: Download All label counts the union (3)", async ({}, testInfo) => {
    test.fail(true, "NEEDS-DECISION: visible Download All label is not rewritten in the student-work view (no data-cqd-injected on the button)");
    test.setTimeout(240_000);
    await withSession(builds.on, "ok", async (page) => {
      const capture = captureConsole(page);
      await runCheck(testInfo, page, capture, "v3-flag-a2", "BRIEF chat7 Part B (a)", async (check) => {
        await page.waitForSelector(SELECTORS.downloadAllButton, { timeout: 30_000 });
        // The union lands asynchronously (token relay, API fetch, reconcile): poll.
        await page
          .waitForFunction(
            (sel) => /\b3\b/.test(document.querySelector(sel)?.getAttribute("aria-label") ?? ""),
            SELECTORS.downloadAllButton,
            { timeout: 20_000 },
          )
          .catch(() => {});
        const label = await allLabel(page);
        check.assert("Download All label counts the union: 3 files", /\b3\b/.test(label), label);
        await check.screenshot("flag-on-union");
      });
    });
  });

  test("(b) flag ON + API 401: DOM result unchanged, no error UI", async ({}, testInfo) => {
    test.setTimeout(240_000);
    await withSession(builds.on, "unauthorized", async (page) => {
      const capture = captureConsole(page);
      await runCheck(testInfo, page, capture, "v3-flag-b", "BRIEF chat7 Part B (b)", async (check) => {
        check.expect("DOM drive attachments still render V2 buttons", await v2ButtonCount(page), 2);
        check.expect("exactly one Download All button", await page.locator(SELECTORS.downloadAllButton).count(), 1);
        const label = await allLabel(page);
        check.assert("Download All stays at the DOM count: 2 files", /\b2\b/.test(label) && !/\b3\b/.test(label), label);
        const flat = await errorUiCounts(page);
        check.assert("no error banner, alert role, or toast", flat === JSON.stringify({ allError: 0, alerts: 0, toasts: 0 }), flat);
        await check.screenshot("flag-on-401");
      });
    });
  });

  test("(c) flag OFF: DOM is the same with the API answering or failing; no union", async ({}, testInfo) => {
    test.setTimeout(300_000);
    // Baseline and variant come from the same flag-OFF build in the same run.
    const baseline = await withSession(builds.off, "unauthorized", async (page) => ({
      html: await postHtml(page),
      label: await allLabel(page),
    }));
    await withSession(builds.off, "ok", async (page) => {
      const capture = captureConsole(page);
      await runCheck(testInfo, page, capture, "v3-flag-c", "BRIEF chat7 Part B (c)", async (check) => {
        const html = await postHtml(page);
        const label = await allLabel(page);
        check.assert("flag OFF: Download All label shows no union count", !/\b3\b/.test(label), label);
        check.expect("flag OFF: Download All label equals the baseline", label, baseline.label);
        await testInfo.attach("flag-off-baseline-profile.json", { body: structuralProfile(baseline.html), contentType: "application/json" });
        await testInfo.attach("flag-off-variant-profile.json", { body: structuralProfile(html), contentType: "application/json" });
        check.expect(
          "flag OFF: post DOM structure equals the baseline (see structuralProfile)",
          structuralProfile(html),
          structuralProfile(baseline.html),
        );
        await check.screenshot("flag-off");
      });
    });
  });
});
