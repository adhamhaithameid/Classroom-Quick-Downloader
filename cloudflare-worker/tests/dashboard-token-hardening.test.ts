// filepath: cloudflare-worker/tests/dashboard-token-hardening.test.ts
import { describe, expect, it } from "vitest";
import { verifySessionToken, __tokenTestInternals } from "../src/index";
import { renderTableRows } from "../src/dashboard/utils";

// Review 2026-11-03 hardening: HKDF-derived scope-separated signing keys,
// strict fingerprint binding on the 15-minute danger credential, and
// server-side escaping in the dashboard table rows.

const create = __tokenTestInternals.createSessionTokenWithBinding;
const UA = "hardening-agent";

describe("dashboard token hardening", () => {
  it("danger tokens do not verify under the session scope and vice versa", async () => {
    // Production always creates danger tokens strictly fingerprint-bound
    // (createDangerStepUpToken) — mirror that here.
    const danger = await create("pw", "1.2.3.4", UA, "strict", 900_000, "danger");
    expect(await verifySessionToken(danger, "pw", "1.2.3.4", UA, "off", {}, "danger")).toBe(true);
    expect(await verifySessionToken(danger, "pw", "1.2.3.4", UA, "off", {}, "session")).toBe(false);

    const session = await create("pw", "1.2.3.4", UA, "off");
    expect(await verifySessionToken(session, "pw", "1.2.3.4", UA, "off", {}, "session")).toBe(true);
    expect(await verifySessionToken(session, "pw", "1.2.3.4", UA, "off", {}, "danger")).toBe(false);
  });

  it("danger tokens are strictly fingerprint-bound", async () => {
    const danger = await create("pw", "1.2.3.4", UA, "strict", 900_000, "danger");
    expect(await verifySessionToken(danger, "pw", "1.2.3.4", UA, "strict", {}, "danger")).toBe(true);
    // Different IP (outside the /24) and UA: strict reject…
    expect(await verifySessionToken(danger, "pw", "9.9.9.9", "other-ua", "strict", {}, "danger")).toBe(false);
    // …and a relaxed verify mode must not weaken the danger cookie either.
    expect(await verifySessionToken(danger, "pw", "9.9.9.9", "other-ua", "optional", {}, "danger")).toBe(false);
  });

  it("derived keys follow the password: old tokens die on rotation", async () => {
    const token = await create("old-password", "1.2.3.4", UA, "off");
    expect(await verifySessionToken(token, "old-password", "1.2.3.4", UA, "off")).toBe(true);
    expect(await verifySessionToken(token, "new-password", "1.2.3.4", UA, "off")).toBe(false);
  });

  it("escapes keys in server-rendered dashboard table rows", () => {
    const html = renderTableRows({ "<script>alert(1)</script>": 5 });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
