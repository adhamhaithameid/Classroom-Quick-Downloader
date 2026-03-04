import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  isLocalEnvironment,
} from "../src/index";

const tokenCases = Array.from({ length: 260 }, (_, idx) => {
  const ip = idx % 2 === 0
    ? `10.20.${Math.floor(idx / 2) % 255}.${idx % 255}`
    : `2001:db8:${(idx % 16).toString(16)}::${(idx % 255).toString(16)}`;
  const userAgent = `CQD-Test-UA/${idx}`;
  return { ip, userAgent };
});

const malformedTokenCases = Array.from({ length: 260 }, (_, idx) => {
  const variants = [
    "",
    "not-a-token",
    ".",
    "..",
    "abc.def.ghi",
    `broken-${idx}`,
    `payload.${"x".repeat((idx % 24) + 1)}`,
  ];
  return variants[idx % variants.length];
});

const hostCases = Array.from({ length: 260 }, (_, idx) => {
  if (idx % 4 === 0) return { host: "localhost", expected: true };
  if (idx % 4 === 1) return { host: `127.0.0.${(idx % 200) + 1}`, expected: true };
  if (idx % 4 === 2) return { host: `[::1]`, expected: true };
  return { host: `prod-${idx}.example.com`, expected: false };
});

describe("session token massive matrix", () => {
  it.each(tokenCases)("round-trips token verification #%#", async ({ ip, userAgent }) => {
    const token = await createSessionToken("secret", ip);

    expect(await verifySessionToken(token, "secret", ip, userAgent, "off")).toBe(true);
    expect(await verifySessionToken(token, "secret", ip, userAgent, "optional")).toBe(true);
    expect(await verifySessionToken(token, "secret", ip, userAgent, "strict")).toBe(false);
    expect(await verifySessionToken(token, "wrong-secret", ip, userAgent, "off")).toBe(false);
  });

  it.each(malformedTokenCases)("rejects malformed tokens #%#", async (token) => {
    expect(await verifySessionToken(token, "secret", "1.2.3.4")).toBe(false);
  });

  it.each(hostCases)("detects local environment hosts #%#", ({ host, expected }) => {
    expect(isLocalEnvironment(host)).toBe(expected);
  });
});
