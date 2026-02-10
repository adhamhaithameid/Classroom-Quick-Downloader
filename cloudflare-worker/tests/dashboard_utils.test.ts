import { describe, it, expect } from "vitest";
import { quotaToFlag } from "../src/dashboard/utils";
import type { QuotaDescriptor } from "../src/types";

// Helper to create a partial QuotaDescriptor
function makeQuota(requestsToday: number): QuotaDescriptor {
  return {
    requestsToday,
    quotaLevel: "dummy",
    modeLabel: "dummy",
    remoteEnabled: true,
    batchSizeSuggestion: 50,
  };
}

describe("quotaToFlag", () => {
  it("returns unknown flag when quota is undefined", () => {
    expect(quotaToFlag(undefined)).toEqual({
      label: "unknown",
      className: "flag-unknown",
      description: "No info.",
    });
  });

  it("returns 'easy' for requestsToday <= 20,000", () => {
    expect(quotaToFlag(makeQuota(0))).toEqual({
      label: "easy",
      className: "flag-easy",
      description: "Way below limits.",
    });
    expect(quotaToFlag(makeQuota(20_000))).toEqual({
      label: "easy",
      className: "flag-easy",
      description: "Way below limits.",
    });
  });

  it("returns 'normal' for 20,000 < requestsToday <= 50,000", () => {
    expect(quotaToFlag(makeQuota(20_001))).toEqual({
      label: "normal",
      className: "flag-normal",
      description: "Comfortable usage.",
    });
    expect(quotaToFlag(makeQuota(50_000))).toEqual({
      label: "normal",
      className: "flag-normal",
      description: "Comfortable usage.",
    });
  });

  it("returns 'hard' for 50,000 < requestsToday <= 80,000", () => {
    expect(quotaToFlag(makeQuota(50_001))).toEqual({
      label: "hard",
      className: "flag-hard",
      description: "High traffic.",
    });
    expect(quotaToFlag(makeQuota(80_000))).toEqual({
      label: "hard",
      className: "flag-hard",
      description: "High traffic.",
    });
  });

  it("returns 'critical' for requestsToday > 80,000", () => {
    expect(quotaToFlag(makeQuota(80_001))).toEqual({
      label: "critical",
      className: "flag-fuck",
      description: "At limits.",
    });
    expect(quotaToFlag(makeQuota(100_000))).toEqual({
      label: "critical",
      className: "flag-fuck",
      description: "At limits.",
    });
  });
});
