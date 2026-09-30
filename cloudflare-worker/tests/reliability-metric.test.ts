import { describe, expect, it } from "vitest";
import { computeReliability } from "../src/reliability";

// ============================================================================
// RELIABILITY METRIC (bead 0h4d.1.10). Pure compute over the DO counters:
// first-attempt = "0" retries / terminals; eventual = all successes /
// terminals; cancels excluded; empty input → null rates (never a fake 100%).
// ============================================================================

describe("computeReliability (0h4d.1.10)", () => {
  it("computes first-attempt and eventual rates from the counters", () => {
    const m = computeReliability({
      totalSuccess: 995,
      totalFail: 5,
      successByRetries: { "0": 990, "1": 4, "2": 1 },
    });
    // terminals = 1000; first-attempt = 990 → 99; eventual = 995 → 99.5
    expect(m.firstAttemptRate).toBe(99);
    expect(m.eventualRate).toBe(99.5);
    expect(m.samples).toBe(1000);
    expect(m.window).toBe("lifetime");
  });

  it("treats missing retry buckets as zero first-attempt successes", () => {
    const m = computeReliability({ totalSuccess: 10, totalFail: 0, successByRetries: {} });
    expect(m.firstAttemptRate).toBe(0);
    expect(m.eventualRate).toBe(100);
  });

  it("returns null rates on an empty window (never 100 on zero samples)", () => {
    const m = computeReliability({});
    expect(m.firstAttemptRate).toBeNull();
    expect(m.eventualRate).toBeNull();
    expect(m.samples).toBe(0);
  });

  it("excludes cancelled downloads (not part of the input contract)", () => {
    const m = computeReliability({ totalSuccess: 3, totalFail: 1 });
    expect(m.samples).toBe(4);
    expect(m.eventualRate).toBe(75);
  });

  it("buckets past the policy cap count as eventual successes", () => {
    const m = computeReliability({
      totalSuccess: 10,
      totalFail: 0,
      successByRetries: { "0": 6, "1": 2, "2": 1, "3+": 1 },
    });
    // eventual = all 10 successes regardless of bucket
    expect(m.eventualRate).toBe(100);
    expect(m.firstAttemptRate).toBe(60);
  });

  it("sorts byBrowser by samples and caps the list at 8", () => {
    const byBrowser: Record<string, number> = {};
    for (let i = 0; i < 12; i++) byBrowser[`browser-${i}`] = 100 - i;
    const m = computeReliability({ totalSuccess: 1, totalFail: 0 }, { byBrowser });
    expect(m.byBrowser).toHaveLength(8);
    expect(m.byBrowser[0].browser).toBe("browser-0");
    expect(m.byBrowser[0].samples).toBe(100);
  });
});
