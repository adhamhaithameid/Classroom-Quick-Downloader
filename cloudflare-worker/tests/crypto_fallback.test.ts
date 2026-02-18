
import { describe, it, expect, vi, afterEach } from "vitest";
import { timingSafeStringEqual as indexTimingSafe } from "../src/index";
import { timingSafeStringEqual as doTimingSafe } from "../src/downloads_do";

describe("Crypto Fallback Coverage", () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  describe("Index Implementation", () => {
    it("falls back to manual loop when crypto.subtle is undefined", async () => {
      // Mock crypto to be undefined or missing subtle
      Object.defineProperty(globalThis, "crypto", {
        value: { ...originalCrypto, subtle: undefined },
        writable: true,
      });

      expect(await indexTimingSafe("a", "a")).toBe(true);
      expect(await indexTimingSafe("a", "b")).toBe(false);
      expect(await indexTimingSafe("abc", "abc")).toBe(true);
      expect(await indexTimingSafe("abc", "abd")).toBe(false);
      expect(await indexTimingSafe("a", "ab")).toBe(false); // Length mismatch
    });

    it("falls back to manual loop when timingSafeEqual is undefined but digest exists", async () => {
      // Mock crypto.subtle with digest but NO timingSafeEqual
      const mockSubtle = {
        digest: async (_algo: string, data: Uint8Array) => {
          // simple identity hash for testing logic flow
          return data.buffer;
        },
        // timingSafeEqual is deliberately undefined
      };

      Object.defineProperty(globalThis, "crypto", {
        value: { ...originalCrypto, subtle: mockSubtle },
        writable: true,
      });

      expect(await indexTimingSafe("a", "a")).toBe(true);
      expect(await indexTimingSafe("a", "b")).toBe(false);
    });
  });

  describe("DownloadsDO Implementation", () => {
    it("falls back to manual loop when crypto.subtle is undefined", async () => {
      Object.defineProperty(globalThis, "crypto", {
        value: { ...originalCrypto, subtle: undefined },
        writable: true,
      });

      expect(await doTimingSafe("secret", "secret")).toBe(true);
      expect(await doTimingSafe("secret", "wrong")).toBe(false);
      expect(await doTimingSafe("short", "loooong")).toBe(false);
    });

    it("falls back to manual loop when timingSafeEqual is undefined but digest exists", async () => {
      const mockSubtle = {
        digest: async (_algo: string, data: Uint8Array) => {
          return data.buffer;
        },
      };

      Object.defineProperty(globalThis, "crypto", {
        value: { ...originalCrypto, subtle: mockSubtle },
        writable: true,
      });

      expect(await doTimingSafe("admin", "admin")).toBe(true);
      expect(await doTimingSafe("admin", "guest")).toBe(false);
    });
  });
});
