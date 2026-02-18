import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  todayUtcDate,
  getCurrentHourStart,
  getCurrentHourEnd,
  maskIpAddress,
  json,
} from "../src/downloads_do/helpers";

describe("Downloads Durable Object Helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("todayUtcDate", () => {
    it("returns the current date in UTC format (YYYY-MM-DD)", () => {
      // Set time to 2023-10-05T12:00:00Z
      vi.setSystemTime(new Date("2023-10-05T12:00:00Z"));
      expect(todayUtcDate()).toBe("2023-10-05");
    });

    it("handles date rollover correctly in UTC", () => {
      // Set time to 2023-10-05T23:59:59Z
      vi.setSystemTime(new Date("2023-10-05T23:59:59Z"));
      expect(todayUtcDate()).toBe("2023-10-05");

      // Advance to next day
      vi.setSystemTime(new Date("2023-10-06T00:00:01Z"));
      expect(todayUtcDate()).toBe("2023-10-06");
    });
  });

  describe("getCurrentHourStart", () => {
    it("returns the start of the current hour in ISO format", () => {
      // Set time to 2023-10-05T12:34:56.789Z
      vi.setSystemTime(new Date("2023-10-05T12:34:56.789Z"));
      const start = getCurrentHourStart();
      expect(start).toBe("2023-10-05T12:00:00.000Z");
    });
  });

  describe("getCurrentHourEnd", () => {
    it("returns the end of the current hour in ISO format", () => {
      // Set time to 2023-10-05T12:34:56.789Z
      vi.setSystemTime(new Date("2023-10-05T12:34:56.789Z"));
      const end = getCurrentHourEnd();
      // Expect 59 minutes, 59 seconds, 999 ms
      expect(end).toBe("2023-10-05T12:59:59.999Z");
    });
  });

  describe("maskIpAddress", () => {
    it("masks IPv4 addresses correctly", () => {
      expect(maskIpAddress("192.168.1.1")).toBe("192.168.*.*");
      expect(maskIpAddress("10.0.0.5")).toBe("10.0.*.*");
    });

    it("masks IPv6 addresses correctly (keeps first segment)", () => {
      expect(maskIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe("2001:*");
      expect(maskIpAddress("fe80::1ff:fe23:4567:890a")).toBe("fe80:*");
    });

    it("handles invalid/unknown formats gracefully", () => {
      expect(maskIpAddress("unknown")).toBe("unknown:*");
      expect(maskIpAddress("")).toBe(":*");
    });
  });

  describe("json", () => {
    it("creates a Response with application/json header", async () => {
      const data = { foo: "bar" };
      const response = json(data);

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();

      const body = await response.json();
      expect(body).toEqual(data);
    });

    it("allows custom headers", () => {
      const response = json({}, { headers: { "X-Custom": "value" } });
      expect(response.headers.get("X-Custom")).toBe("value");
    });

    it("allows overriding default headers", () => {
      const response = json({}, { headers: { "Content-Type": "application/problem+json" } });
      expect(response.headers.get("Content-Type")).toBe("application/problem+json");
    });
  });
});
