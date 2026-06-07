import { describe, it, expect } from "vitest";
import { isValidIpv4 } from "../src/ip_utils";

describe("isValidIpv4", () => {
  it("should return true for valid IPv4 addresses", () => {
    expect(isValidIpv4("192.168.1.1")).toBe(true);
    expect(isValidIpv4("0.0.0.0")).toBe(true);
    expect(isValidIpv4("255.255.255.255")).toBe(true);
    expect(isValidIpv4("10.0.0.1")).toBe(true);
    expect(isValidIpv4("127.0.0.1")).toBe(true);
  });

  it("should return false for IPs with incorrect number of octets", () => {
    expect(isValidIpv4("192.168.1")).toBe(false);
    expect(isValidIpv4("192.168.1.1.1")).toBe(false);
    expect(isValidIpv4("192")).toBe(false);
    expect(isValidIpv4("")).toBe(false);
  });

  it("should return false for IPs with non-numeric characters", () => {
    expect(isValidIpv4("192.168.1.a")).toBe(false);
    expect(isValidIpv4("192.168.1. ")).toBe(false);
    expect(isValidIpv4("192.168.1.-1")).toBe(false);
    expect(isValidIpv4("192.168.1.1a")).toBe(false);
  });

  it("should return false for IPs with empty octets", () => {
    expect(isValidIpv4("192.168..1")).toBe(false);
    expect(isValidIpv4(".168.1.1")).toBe(false);
    expect(isValidIpv4("192.168.1.")).toBe(false);
  });

  it("should return false for IPs with out-of-bounds octets", () => {
    expect(isValidIpv4("256.0.0.0")).toBe(false);
    expect(isValidIpv4("192.168.1.256")).toBe(false);
    expect(isValidIpv4("192.168.256.1")).toBe(false);
    expect(isValidIpv4("192.256.1.1")).toBe(false);
    expect(isValidIpv4("999.1.1.1")).toBe(false);
  });

  it("should return false for IPs with leading zeros", () => {
    expect(isValidIpv4("192.168.01.1")).toBe(false);
    expect(isValidIpv4("192.168.1.00")).toBe(false);
    expect(isValidIpv4("01.0.0.0")).toBe(false);
    expect(isValidIpv4("192.0168.1.1")).toBe(false);
  });
});
