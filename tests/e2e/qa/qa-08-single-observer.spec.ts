// filepath: tests/e2e/qa/qa-08-single-observer.spec.ts
/**
 * ============================================================================
 * QA-08 (single-observer) — ONE MutationObserver per page (Engine V4 S10)
 * ============================================================================
 *
 * Engine V4 S10 gives every page exactly ONE real platform MutationObserver:
 * the DomPort multiplexer singleton (title watcher, orchestrator dom scan,
 * content-ready transient, and any legacy-mode subscribers all share it).
 *
 * The built extension exposes that singleton's live state as an additive
 * debug global in the content-script (isolated) world:
 *
 *   window.__cqdDomPortInfo = {
 *     subscriptionCount(), observerCreatedCount(), disposed()
 *   }
 *
 * Content scripts run in an ISOLATED world, so Playwright's main-world
 * page.evaluate cannot see the extension's observer or this probe. The
 * journey therefore reads __cqdDomPortInfo over CDP Runtime.evaluate inside
 * the extension's isolated execution context (contexts are captured while
 * the page loads). Chromium-only; qa-firefox skips via the standard
 * extension-unavailable path.
 *
 * A main-world MutationObserver counting subclass is injected BEFORE page
 * load as isolation evidence: apart from Playwright's own injected-script
 * baseline (exactly one observer for global-listener tracking), the page
 * itself must construct none — the ONE real observer lives in the extension
 * world, where only the DomPort adapter may build it.
 */
import { test, expect, type BrowserContext, type Page, type CDPSession } from "@playwright/test";
import {
  launchQaContext,
  captureConsole,
  runCheck,
  currentRunId,
  HarnessFailure,
  projectBrowser,
} from "./harness";
import {
  createScenario,
  streamPath,
  drive,
  docs,
} from "../../simulator/scenario";

const STREAM = streamPath();
const RUNBOOK_REF = "ENGINE V4 S10 single-observer gate: one DomPort, one platform MutationObserver per page";

interface DomPortProbe {
  subs: number;
  created: number;
  disposed: boolean;
}

function scenario() {
  return createScenario({
    locale: "en",
    dir: "ltr",
    theme: "light",
    initialPath: STREAM,
    routes: [
      {
        path: STREAM,
        kind: "stream",
        posts: [
          {
            id: "obs-post-1",
            body: "Single observer journey post.",
            attachments: [
              drive("obs-drive-1", "worksheet.pdf"),
              docs("obs-docs-1", "syllabus.docx"),
            ],
          },
        ],
      },
    ],
  });
}

test.describe("qa-08 single-observer", () => {
  let context: BrowserContext;
  let page: Page;
  let capture: ReturnType<typeof captureConsole>;
  let closeQa: () => Promise<void>;

  /** CDP handle + every execution context seen since Runtime.enable. */
  let cdp: CDPSession;
  const executionContexts = new Map<
    number,
    { id: number; auxData?: { type?: string } }
  >();

  /**
   * Attach CDP Runtime BEFORE navigation so the extension's isolated world
   * context is captured when the content scripts inject (document_idle).
   */
  async function captureIsolatedWorlds(): Promise<void> {
    cdp = await context.newCDPSession(page);
    cdp.on("Runtime.executionContextCreated", (payload) => {
      const c = (payload as unknown as { context: { id: number; auxData?: { type?: string } } })
        .context;
      executionContexts.set(c.id, c);
    });
    await cdp.send("Runtime.enable");
  }

  /**
   * Read __cqdDomPortInfo from whichever captured execution context hosts
   * the extension's content scripts. Main-world contexts answer null and
   * are skipped harmlessly; destroyed contexts are tolerated.
   */
  async function readDomPortProbe(): Promise<DomPortProbe | null> {
    for (const c of executionContexts.values()) {
      try {
        const res = (await cdp.send("Runtime.evaluate", {
          expression:
            "(() => { const i = window.__cqdDomPortInfo; return i ? { subs: i.subscriptionCount(), created: i.observerCreatedCount(), disposed: i.disposed() } : null; })()",
          returnByValue: true,
          // Evaluate IN the captured context — without this the call runs in
          // the page's default (main) world, which never sees the probe.
          contextId: c.id,
        })) as unknown as { result?: { value?: DomPortProbe | null } };
        if (res.result?.value) return res.result.value;
      } catch {
        /* context torn down mid-run — try the next one */
      }
    }
    return null;
  }

  /** Evidence for a probe miss: which execution contexts were even seen. */
  function contextSummary(): string {
    return (
      [...executionContexts.values()]
        .map((c) => `${c.id}:${c.auxData?.type ?? "?"}:${c.origin}`)
        .join(", ") || "none captured"
    );
  }

  test.beforeAll(async ({}, testInfo) => {
    const browser = projectBrowser(testInfo.project.name);
    if (browser !== "chromium") {
      // The probe reads the extension's isolated world over CDP
      // Runtime.evaluate — a Chromium-only mechanism. On Firefox the check
      // cannot run without faking it; classify honestly and skip.
      test.skip(true, "HARNESS: extension-world probe uses CDP — Chromium-only; Firefox has no CDP");
      return;
    }
    const session = await launchQaContext(browser, scenario());
    context = session.context;
    closeQa = session.close;
    // Firefox cannot host the extension in Playwright's build; runCheck
    // records the ENVIRONMENT skip. Chromium must fail hard, never skip.
    if (!session.extensionAvailable) return;
    page = await context.newPage();
    capture = captureConsole(page);
    // Main-world observer counter, installed before ANY page script: the
    // page itself must construct zero MutationObservers — the single real
    // one belongs to the extension's isolated world.
    await page.addInitScript(() => {
      const w = window as unknown as { __mainWorldMoCount?: number };
      w.__mainWorldMoCount = 0;
      const Original = window.MutationObserver;
      class CountingMutationObserver extends Original {
        constructor(...args: ConstructorParameters<typeof Original>) {
          super(...args);
          w.__mainWorldMoCount = (w.__mainWorldMoCount ?? 0) + 1;
        }
      }
      window.MutationObserver = CountingMutationObserver;
    });
    await captureIsolatedWorlds();
    await page.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
    // A product download button proves the default-mode stack ran (V1 scan
    // stack on the legacy default — the shipped DEFAULT_MODE after the S10
    // acceptance rollback; 'v2' renders .cqd-v2-btn instead). The DomPort
    // gate asserted below is mode-independent: every mode multiplexes over
    // the same port singleton. Then let the page settle so scan debounces
    // unwound.
    await page.waitForSelector("button.cqd-download-btn", { timeout: 20_000 });
    await page.waitForTimeout(3_000);
  });

  test.afterAll(async () => {
    await closeQa();
  });

  test("one page, one platform MutationObserver, live port subscriptions", async () => {
    await runCheck(test.info(), page, capture, "qa-08-single-observer", RUNBOOK_REF, async (check) => {
      const probe = await readDomPortProbe();
      if (!probe) {
        throw new HarnessFailure(
          `extension-world __cqdDomPortInfo not found in any execution context (contexts seen: ${contextSummary()}) — the DomPort qa probe is missing from the built bundle`,
        );
      }

      // The shared port is alive and serving the page's watchers (title
      // fallback + orchestrator dom at minimum).
      check.assert(
        "port holds live subscriptions after settle (title + orchestrator dom)",
        probe.subs >= 1,
        `subscriptionCount: ${probe.subs}`,
      );

      // The core gate: exactly ONE platform MutationObserver was ever
      // constructed for this page — title watcher, orchestrator, content
      // transient all multiplex over it.
      check.expect("exactly ONE MutationObserver constructed for the page", probe.created, 1);

      check.expect("page port not disposed after settle", probe.disposed, false);

      // Isolation evidence: the main world builds no product observer of its
      // own — the ONE observer is the extension's, in the isolated world.
      // (A small environmental baseline exists: Playwright's own injected
      // script builds one MutationObserver for global-listener tracking, so
      // the honest bound is "no more than that".)
      const mainWorldCount = await page.evaluate(
        () => (window as unknown as { __mainWorldMoCount?: number }).__mainWorldMoCount ?? -1,
      );
      check.assert(
        "main world constructs no product MutationObserver (only Playwright's injected-script baseline)",
        mainWorldCount >= 0 && mainWorldCount <= 1,
        `main-world MutationObserver constructions: ${mainWorldCount} (1 = Playwright InjectedScript baseline)`,
      );

      await check.screenshot("single-observer-settled");
      check.expect("run id recorded", !!currentRunId(), true);
    });
  });
});
