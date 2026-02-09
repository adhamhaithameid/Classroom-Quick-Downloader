import { describe, it, expect } from "vitest";
import { aggregateEvents } from "../src/aggregation";
import { StoredEvent } from "../src/types";

describe("aggregateEvents", () => {
  it("should aggregate empty events correctly", () => {
    const { summary, timeBuckets } = aggregateEvents([]);
    expect(summary.totals.totalEvents).toBe(0);
    expect(timeBuckets.length).toBe(0);
  });

  it("should aggregate single event correctly", () => {
    const now = new Date("2023-10-01T10:00:00Z").getTime();
    const event: StoredEvent = {
      status: "success",
      file_type: "Image",
      browser: "Chrome",
      os: "Windows",
      ext_version: "1.0.0",
      duration_ms: 100,
      bypass_used: false,
      language: "en-US",
      timestamp: now,
      country: "US",
    };

    const { summary, timeBuckets } = aggregateEvents([event]);

    expect(summary.totals.totalEvents).toBe(1);
    expect(summary.totals.totalSuccess).toBe(1);
    expect(summary.totals.totalFail).toBe(0);
    expect(summary.browsers["chrome"]).toBe(1);
    expect(summary.countries["us"]).toBe(1);

    expect(timeBuckets.length).toBe(1);
    expect(timeBuckets[0].bucketStart).toBe("2023-10-01T10:00:00Z");
    expect(timeBuckets[0].totals.totalEvents).toBe(1);
  });

  it("should group events by hour", () => {
    const t1 = new Date("2023-10-01T10:15:00Z").getTime();
    const t2 = new Date("2023-10-01T10:45:00Z").getTime();
    const t3 = new Date("2023-10-01T11:05:00Z").getTime();

    const events: StoredEvent[] = [
      { status: "success", file_type: "jpg", browser: "chrome", os: "win", ext_version: "1", duration_ms: 0, bypass_used: false, language: "en", timestamp: t1, country: "us" },
      { status: "fail", file_type: "png", browser: "firefox", os: "mac", ext_version: "1", duration_ms: 0, bypass_used: false, language: "en", timestamp: t2, country: "uk", error_type: "network" },
      { status: "success", file_type: "gif", browser: "safari", os: "ios", ext_version: "1", duration_ms: 0, bypass_used: false, language: "fr", timestamp: t3, country: "fr" },
    ];

    const { summary, timeBuckets } = aggregateEvents(events);

    expect(summary.totals.totalEvents).toBe(3);
    expect(summary.totals.totalSuccess).toBe(2);
    expect(summary.totals.totalFail).toBe(1);

    expect(timeBuckets.length).toBe(2);

    // Bucket 1: 10:00
    expect(timeBuckets[0].bucketStart).toBe("2023-10-01T10:00:00Z");
    expect(timeBuckets[0].totals.totalEvents).toBe(2);
    expect(timeBuckets[0].totals.totalSuccess).toBe(1);
    expect(timeBuckets[0].totals.totalFail).toBe(1);

    // Bucket 2: 11:00
    expect(timeBuckets[1].bucketStart).toBe("2023-10-01T11:00:00Z");
    expect(timeBuckets[1].totals.totalEvents).toBe(1);
    expect(timeBuckets[1].totals.totalSuccess).toBe(1);

    // Verify error reasons
    expect(summary.errorReasons["network"]).toBe(1);
    expect(timeBuckets[0].counters.byErrorType["network"]).toBe(1);
  });

  it("should handle mixed case normalization", () => {
    const events: StoredEvent[] = [
      { status: "success", file_type: "JPG", browser: "Chrome", os: "Windows", ext_version: "1", duration_ms: 0, bypass_used: false, language: "EN", timestamp: Date.now(), country: "US" },
      { status: "success", file_type: "jpg", browser: "chrome", os: "windows", ext_version: "1", duration_ms: 0, bypass_used: false, language: "en", timestamp: Date.now(), country: "us" },
    ];

    const { summary } = aggregateEvents(events);

    expect(summary.totals.totalEvents).toBe(2);
    expect(summary.browsers["chrome"]).toBe(2);
    expect(Object.keys(summary.browsers).length).toBe(1);
    expect(summary.countries["us"]).toBe(2);
  });

  it("should calculate top keys correctly", () => {
     const events: StoredEvent[] = [
      { status: "success", file_type: "jpg", browser: "chrome", os: "win", ext_version: "1", duration_ms: 0, bypass_used: false, language: "en", timestamp: Date.now(), country: "us" },
      { status: "success", file_type: "jpg", browser: "chrome", os: "win", ext_version: "1", duration_ms: 0, bypass_used: false, language: "en", timestamp: Date.now(), country: "us" },
      { status: "success", file_type: "png", browser: "firefox", os: "mac", ext_version: "1", duration_ms: 0, bypass_used: false, language: "en", timestamp: Date.now(), country: "uk" },
    ];

    const { summary } = aggregateEvents(events);

    expect(summary.topBrowser).toBe("chrome");
    expect(summary.topCountry).toBe("us");
  });
});
