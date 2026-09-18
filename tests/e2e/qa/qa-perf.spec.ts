// filepath: tests/e2e/qa/qa-perf.spec.ts
/**
 * ============================================================================
 * QA-PERF (fast-pass budget) — handleMutations p95 < 6ms (Engine V4 S11, G5)
 * ============================================================================
 *
 * The §9.6 fast-pass budget says mutation handling must stay under 6ms p95.
 * Until S11 the 'handleMutations' label existed in the PerformanceMonitor but
 * nothing recorded it — the headline metric was never MEASURED. Now
 * EngineV2.handleMutations times every real batch it handles, and the built
 * extension exposes the live histogram as an additive debug global in the
 * content-script (isolated) world:
 *
 *   window.__cqdPerfSnapshot() = { handleMutations: { count, p50, p95, ... } }
 *
 * Content scripts run in an ISOLATED world, so Playwright's main-world
 * page.evaluate cannot see the probe. The journey therefore reads it over
 * CDP Runtime.evaluate inside the extension's isolated execution context
 * (contexts are captured while the page loads) — the same pattern as
 * qa-08's __cqdDomPortInfo read.
 *
 * Journey: load a stream scenario, settle, then drive a REAL mutation burst
 * — 50 post cards injected one-by-one (each append is its own observer
 * batch, so each one is a real full-rescan fast pass) plus simulator churn
 * noise per round. Then read the engine's own histogram and assert
 * p95 < 6 (ms) with samples >= 20. The assertion is honest: no retries, no
 * averaging — if p95 >= 6 the check FAILS, and that failure is a finding.
 *
 * Chromium-only; qa-firefox skips via the standard extension-unavailable path.
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
const RUNBOOK_REF =
  "Engine V4 S11 G5 budget gate: handleMutations p95 < 6ms (budget-controller CPU_BUDGETS.FAST_PASS_TARGET) measured under a live mutation burst";

/** Shape of the engine's TimingPercentiles, as returned by the probe. */
interface PerfProbe {
  handleMutations: {
    count: number;
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  } | null;
}

/** Burst shape: 10 rounds × 5 individually-appended cards = 50 fast passes. */
const BURST_ROUNDS = 10;
const CARDS_PER_ROUND = 5;
const CARD_GAP_MS = 40;
const ROUND_GAP_MS = 200;

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
            id: "perf-post-1",
            body: "Perf budget journey post one.",
            attachments: [
              drive("perf-drive-1", "worksheet.pdf"),
              docs("perf-docs-1", "syllabus.docx"),
            ],
          },
          {
            id: "perf-post-2",
            body: "Perf budget journey post two.",
            attachments: [drive("perf-drive-2", "reading.pdf")],
          },
        ],
      },
    ],
  });
}

test.describe("qa-perf fast-pass budget", () => {
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
   * Read __cqdPerfSnapshot() from whichever captured execution context hosts
   * the extension's content scripts. Main-world contexts answer null and are
   * skipped harmlessly; destroyed contexts are tolerated.
   */
  async function readPerfProbe(): Promise<PerfProbe | null> {
    for (const c of executionContexts.values()) {
      try {
        const res = (await cdp.send("Runtime.evaluate", {
          expression:
            "(() => { const s = window.__cqdPerfSnapshot; return s ? s() : null; })()",
          returnByValue: true,
          // Evaluate IN the captured context — without this the call runs in
          // the page's default (main) world, which never sees the probe.
          contextId: c.id,
        })) as unknown as { result?: { value?: PerfProbe | null } };
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
    await captureIsolatedWorlds();
    await page.goto(`https://classroom.google.com${STREAM}`, { waitUntil: "domcontentloaded" });
    // The shipped default mode ('v2') renders product download buttons —
    // their presence proves the engine stack is live and receiving observer
    // batches. Then let the page settle so the initial scan debounces unwind.
    await page.waitForSelector("button.cqd-download-btn", { timeout: 20_000 });
    await page.waitForTimeout(3_000);
  });

  test.afterAll(async () => {
    await closeQa();
  });

  test("handleMutations p95 stays under the 6ms budget under a mutation burst", async () => {
    await runCheck(test.info(), page, capture, "qa-perf-budget", RUNBOOK_REF, async (check) => {
      // ---- Drive the burst (main world — plain DOM, no probe needed) ----
      await page.evaluate(
        async ({ rounds, cardsPerRound, cardGapMs, roundGapMs }) => {
          const host = document.getElementById("page") ?? document.body;
          const churn = (window as unknown as {
            __cqdSimChurn?: (times: number) => void;
          }).__cqdSimChurn;
          for (let round = 0; round < rounds; round++) {
            for (let j = 0; j < cardsPerRound; j++) {
              // One card per observer batch: every append is a REAL relevant
              // mutation → the engine pays a full-rescan fast pass for it.
              const card = document.createElement("article");
              card.setAttribute("data-stream-item-id", `perf-burst-${round}-${j}`);
              const anchor = document.createElement("a");
              anchor.setAttribute("data-drive-id", `perf-burst-drive-${round}-${j}`);
              anchor.href = `https://drive.google.com/file/d/perfBurstDrive${round}${j}Placeholder0000/view`;
              anchor.textContent = `burst-${round}-${j}.pdf`;
              card.appendChild(anchor);
              host.appendChild(card);
              await new Promise((r) => setTimeout(r, cardGapMs));
            }
            // Irrelevant-node noise: exercises the cheap relevance-scan path.
            churn?.(12);
            await new Promise((r) => setTimeout(r, roundGapMs));
          }
        },
        { rounds: BURST_ROUNDS, cardsPerRound: CARDS_PER_ROUND, cardGapMs: CARD_GAP_MS, roundGapMs: ROUND_GAP_MS },
      );

      // Let the last batches drain through the observer → engine.
      await page.waitForTimeout(500);

      // ---- Read the engine's OWN histogram (extension world via CDP) ----
      const probe = await readPerfProbe();
      if (!probe) {
        throw new HarnessFailure(
          `extension-world __cqdPerfSnapshot not found in any execution context (contexts seen: ${contextSummary()}) — the S11 perf probe is missing from the built bundle`,
        );
      }
      if (!probe.handleMutations) {
        throw new HarnessFailure(
          "__cqdPerfSnapshot returned but handleMutations histogram is null — EngineV2.handleMutations recorded no timings (instrumentation missing)",
        );
      }
      const mut = probe.handleMutations;

      // ---- The budget gate (honest: no retries, no averaging) ----
      check.assert(
        "sample count >= 20 (burst actually measured, not a flicker)",
        mut.count >= 20,
        `count: ${mut.count}`,
      );

      check.assert(
        "handleMutations p95 < 6ms fast-pass budget",
        mut.p95 < 6,
        `p95: ${mut.p95.toFixed(3)}ms (count=${mut.count}, p50=${mut.p50.toFixed(3)}ms, mean=${mut.mean.toFixed(3)}ms, max=${mut.max.toFixed(3)}ms)`,
      );

      await check.screenshot("perf-burst-settled");
      check.expect("run id recorded", !!currentRunId(), true);
    });
  });
});
