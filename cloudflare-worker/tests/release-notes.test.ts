import { describe, it, expect } from "vitest";
import { sanitizeReleaseEntries } from "../src/release-notes";

describe("sanitizeReleaseEntries", () => {
  it("returns empty array for empty input", () => {
    expect(sanitizeReleaseEntries([])).toEqual([]);
  });

  it("filters out invalid entries (null, undefined, non-objects)", () => {
    const entries = [
      null,
      undefined,
      "string",
      123,
      true,
      [], // array is an object, but handled internally (coerced defaults)
      { version: "1.0.0" }
    ];
    const sanitized = sanitizeReleaseEntries(entries);
    expect(sanitized.length).toBe(2);
    // [] becomes an empty object effectively
    expect(sanitized[0].version).toBe("Unknown");
    expect(sanitized[1].version).toBe("1.0.0");
  });

  it("applies fallbacks for missing or invalid fields", () => {
    const entries = [{}];
    const sanitized = sanitizeReleaseEntries(entries);
    expect(sanitized).toEqual([{
      id: "Unknown-0",
      version: "Unknown",
      date: new Date(0).toISOString(),
      changes: []
    }]);
  });

  it("trims strings and uses provided valid values", () => {
    const entries = [{
      id: "  my-id  ",
      version: "  2.0.0  ",
      date: "2024-01-01T00:00:00.000Z",
      changes: ["  change 1  ", "change 2", "  "]
    }];
    const sanitized = sanitizeReleaseEntries(entries);
    expect(sanitized).toEqual([{
      id: "my-id",
      version: "2.0.0",
      date: "2024-01-01T00:00:00.000Z",
      changes: ["change 1", "change 2"]
    }]);
  });

  it("sorts entries descending by date", () => {
    const entries = [
      { id: "1", date: "2023-01-01T00:00:00.000Z" },
      { id: "2", date: "2025-01-01T00:00:00.000Z" },
      { id: "3", date: "2024-01-01T00:00:00.000Z" },
      { id: "4" } // Missing date -> 1970
    ];
    const sanitized = sanitizeReleaseEntries(entries);
    expect(sanitized.map(e => e.id)).toEqual(["2", "3", "1", "4"]);
  });

  it("coerces invalid dates to epoch", () => {
    const entries = [
      { date: "not-a-date" },
      { date: "   " }
    ];
    const sanitized = sanitizeReleaseEntries(entries);
    expect(sanitized[0].date).toBe(new Date(0).toISOString());
    expect(sanitized[1].date).toBe(new Date(0).toISOString());
  });

  it("handles changes arrays correctly", () => {
    const entries = [{
      changes: [
        null,
        "valid",
        123,
        "   ",
        "another valid"
      ]
    }];
    const sanitized = sanitizeReleaseEntries(entries);
    expect(sanitized[0].changes).toEqual(["valid", "another valid"]);
  });

  it("slices changes to a maximum of 32 entries", () => {
    const manyChanges = Array.from({ length: 40 }, (_, i) => `change ${i}`);
    const entries = [{ changes: manyChanges }];
    const sanitized = sanitizeReleaseEntries(entries);
    expect(sanitized[0].changes.length).toBe(32);
    expect(sanitized[0].changes[31]).toBe("change 31");
  });
});
