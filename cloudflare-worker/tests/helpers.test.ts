import { describe, it, expect } from "vitest";
import { maskIpAddress } from "../src/downloads_do/helpers";

describe("maskIpAddress", () => {
  it("masks standard IPv4 addresses", () => {
    // Should keep first two octets
    expect(maskIpAddress("192.168.1.1")).toBe("192.168.*.*");
    expect(maskIpAddress("10.0.0.1")).toBe("10.0.*.*");
    expect(maskIpAddress("8.8.8.8")).toBe("8.8.*.*");
  });

  it("masks standard IPv6 addresses", () => {
    // Should keep first segment
    expect(maskIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe("2001:*");
    expect(maskIpAddress("fe80::1ff:fe23:4567:890a")).toBe("fe80:*");
    expect(maskIpAddress("::1")).toBe(":*"); // starts with empty string if split by :
  });

  it("handles malformed or incomplete IPv4 addresses", () => {
    // Logic falls back to "other" handling (split by :)
    expect(maskIpAddress("1.2.3")).toBe("1.2.3:*");
    expect(maskIpAddress("1.2")).toBe("1.2:*");
    expect(maskIpAddress("1")).toBe("1:*");
  });

  it("handles empty strings", () => {
    expect(maskIpAddress("")).toBe(":*");
  });

  it("handles non-IP strings", () => {
    expect(maskIpAddress("invalid-ip")).toBe("invalid-ip:*");
    // "not.an.ip.address" has 4 parts when split by '.', so it's treated as IPv4
    expect(maskIpAddress("not.an.ip.address")).toBe("not.an.*.*");
  });
});
