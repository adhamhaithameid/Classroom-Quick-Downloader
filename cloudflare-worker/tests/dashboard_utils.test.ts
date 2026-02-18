
import { describe, it, expect } from "vitest";
import { quotaToStateTag, quotaToFlag, escapeHtml, renderTableRows } from "../src/dashboard/utils";
import type { QuotaDescriptor } from "../src/types";

function makeQuota(requestsToday: number): QuotaDescriptor {
  return {
    requestsToday,
    quotaLevel: "BELOW_LIMITS",
    modeLabel: "chill",
    remoteEnabled: true,
    batchSizeSuggestion: 50,
  };
}

describe("quotaToStateTag", () => {
  it("handles undefined quota", () => {
    expect(quotaToStateTag(undefined)).toEqual({
      label: "unknown",
      className: "state-unknown",
      description: "No quota info.",
    });
  });

  it("handles sleeping state (<= 1,000)", () => {
    const expected = { label: "sleeping", className: "state-sleeping", description: "Very low traffic." };
    expect(quotaToStateTag(makeQuota(0))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(1000))).toEqual(expected);
  });

  it("handles super chill state (<= 5,000)", () => {
    const expected = { label: "super chill", className: "state-super-chill", description: "Barely touching Worker." };
    expect(quotaToStateTag(makeQuota(1001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(5000))).toEqual(expected);
  });

  it("handles chill state (<= 10,000)", () => {
    const expected = { label: "chill", className: "state-chill", description: "Plenty of headroom." };
    expect(quotaToStateTag(makeQuota(5001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(10000))).toEqual(expected);
  });

  it("handles easy state (<= 20,000)", () => {
    const expected = { label: "easy", className: "state-easy", description: "Well below limits." };
    expect(quotaToStateTag(makeQuota(10001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(20000))).toEqual(expected);
  });

  it("handles kinda easy state (<= 30,000)", () => {
    const expected = { label: "kinda easy", className: "state-kinda-easy", description: "Load is fine." };
    expect(quotaToStateTag(makeQuota(20001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(30000))).toEqual(expected);
  });

  it("handles normal state (<= 40,000)", () => {
    const expected = { label: "normal", className: "state-normal", description: "Normal traffic." };
    expect(quotaToStateTag(makeQuota(30001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(40000))).toEqual(expected);
  });

  it("handles slightly busy state (<= 50,000)", () => {
    const expected = { label: "slightly busy", className: "state-slightly-busy", description: "Warming up." };
    expect(quotaToStateTag(makeQuota(40001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(50000))).toEqual(expected);
  });

  it("handles kinda busy state (<= 60,000)", () => {
    const expected = { label: "kinda busy", className: "state-kinda-busy", description: "Closer to quota." };
    expect(quotaToStateTag(makeQuota(50001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(60000))).toEqual(expected);
  });

  it("handles busy state (<= 70,000)", () => {
    const expected = { label: "busy", className: "state-busy", description: "Hard-normal zone." };
    expect(quotaToStateTag(makeQuota(60001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(70000))).toEqual(expected);
  });

  it("handles very busy state (<= 80,000)", () => {
    const expected = { label: "very busy", className: "state-very-busy", description: "Protecting quota." };
    expect(quotaToStateTag(makeQuota(70001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(80000))).toEqual(expected);
  });

  it("handles super busy state (<= 90,000)", () => {
    const expected = { label: "super busy", className: "state-super-busy", description: "Approaching limits." };
    expect(quotaToStateTag(makeQuota(80001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(90000))).toEqual(expected);
  });

  it("handles emergency state (<= 95,000)", () => {
    const expected = { label: "emergency", className: "state-emergency", description: "Emergency mode." };
    expect(quotaToStateTag(makeQuota(90001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(95000))).toEqual(expected);
  });

  it("handles critical state (<= 99,000)", () => {
    const expected = { label: "critical", className: "state-critical", description: "At the limit." };
    expect(quotaToStateTag(makeQuota(95001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(99000))).toEqual(expected);
  });

  it("handles cut power state (> 99,000)", () => {
    const expected = { label: "cut power", className: "state-cut-power", description: "Remote analytics OFF." };
    expect(quotaToStateTag(makeQuota(99001))).toEqual(expected);
    expect(quotaToStateTag(makeQuota(100000))).toEqual(expected);
  });
});

describe("quotaToFlag", () => {
  it("handles undefined quota", () => {
    expect(quotaToFlag(undefined)).toEqual({
      label: "unknown",
      className: "flag-unknown",
      description: "No info.",
    });
  });

  it("handles easy flag (<= 20,000)", () => {
    const expected = { label: "easy", className: "flag-easy", description: "Way below limits." };
    expect(quotaToFlag(makeQuota(0))).toEqual(expected);
    expect(quotaToFlag(makeQuota(20000))).toEqual(expected);
  });

  it("handles normal flag (<= 50,000)", () => {
    const expected = { label: "normal", className: "flag-normal", description: "Comfortable usage." };
    expect(quotaToFlag(makeQuota(20001))).toEqual(expected);
    expect(quotaToFlag(makeQuota(50000))).toEqual(expected);
  });

  it("handles hard flag (<= 80,000)", () => {
    const expected = { label: "hard", className: "flag-hard", description: "High traffic." };
    expect(quotaToFlag(makeQuota(50001))).toEqual(expected);
    expect(quotaToFlag(makeQuota(80000))).toEqual(expected);
  });

  it("handles critical flag (> 80,000)", () => {
    const expected = { label: "critical", className: "flag-critical", description: "At limits." };
    expect(quotaToFlag(makeQuota(80001))).toEqual(expected);
    expect(quotaToFlag(makeQuota(100000))).toEqual(expected);
  });
});

describe("renderTableRows escaping", () => {
  it("escapes html-sensitive characters", () => {
    const value = `<tag attr="x">&'</tag>`;
    expect(escapeHtml(value)).toBe("&lt;tag attr=&quot;x&quot;&gt;&amp;&#039;&lt;/tag&gt;");
  });

  it("escapes object keys while rendering rows", () => {
    const html = renderTableRows({
      "<script>alert(1)</script>": 2,
      safe: 1,
    });

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("<td>2</td>");
  });
});
