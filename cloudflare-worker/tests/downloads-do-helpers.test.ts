import { describe, expect, it } from "vitest";
import { json } from "../src/downloads_do/helpers";

describe("downloads_do helpers json", () => {
  it("does not add wildcard CORS by default", async () => {
    const res = json({ ok: true });
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("preserves explicit headers from caller", async () => {
    const res = json(
      { ok: true },
      { headers: { "Content-Type": "application/json; charset=utf-8", "X-Test": "1" } },
    );
    expect(res.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("X-Test")).toBe("1");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
