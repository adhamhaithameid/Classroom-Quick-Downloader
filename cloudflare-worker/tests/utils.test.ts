
import { describe, it, expect } from "vitest";
import { safeCompare } from "../src/utils";

describe("safeCompare", () => {
  it("should return true for identical strings", async () => {
    expect(await safeCompare("hello", "hello")).toBe(true);
    expect(await safeCompare("password123", "password123")).toBe(true);
    expect(await safeCompare("", "")).toBe(true);
  });

  it("should return false for different strings", async () => {
    expect(await safeCompare("hello", "world")).toBe(false);
    expect(await safeCompare("password123", "password124")).toBe(false);
    expect(await safeCompare("pass", "password")).toBe(false);
  });

  it("should return false when one input is null or undefined", async () => {
    expect(await safeCompare("hello", null)).toBe(false);
    expect(await safeCompare("hello", undefined)).toBe(false);
    // @ts-expect-error - Testing invalid input
    expect(await safeCompare(null, "hello")).toBe(false);
    // @ts-expect-error - Testing invalid input
    expect(await safeCompare(undefined, "hello")).toBe(false);
  });

  it("should return true when both inputs are null or undefined (matching)", async () => {
    // @ts-expect-error - Testing invalid input
    expect(await safeCompare(null, null)).toBe(true);
    // @ts-expect-error - Testing invalid input
    expect(await safeCompare(undefined, undefined)).toBe(true);
  });

  it("should return false when inputs are null and undefined", async () => {
      // In JS `null == undefined` is true, but `null === undefined` is false.
      // My implementation uses `a === b` for non-strings.
      // @ts-expect-error - Testing invalid input
      expect(await safeCompare(null, undefined)).toBe(false);
      // @ts-expect-error - Testing invalid input
      expect(await safeCompare(undefined, null)).toBe(false);
  });
});
