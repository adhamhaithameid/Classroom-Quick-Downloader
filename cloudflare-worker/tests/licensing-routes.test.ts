import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { DownloadsDurable } from "../src/downloads_do";
import {
  clearLicenseProvidersForTests,
  registerLicenseProviderForTests,
} from "../src/licensing/provider";
import {
  issueLicense,
  resetLicensingSchemaCacheForTests,
  verifyEntitlement,
  type LicensingD1,
} from "../src/licensing/service";
import type { Env } from "../src/types";
import {
  TEST_ENTITLEMENT_SIGNING_KEY,
  TEST_INSTALL_ID,
  TEST_LICENSE_KEY,
  TEST_LICENSE_PLAN,
  TEST_LICENSE_WEBHOOK_SECRET,
  createFakeLicenseProvider,
  makeLicenseFakeD1,
} from "./helpers/license-fake";

const WORKER_URL = "https://worker.example.com";

// Real DO instance so /license/rate-check exercises the actual shared
// per-IP limiter machinery (same pattern as website-rate-limits.test.ts).
function makeRealDo(): DownloadsDurable {
  const state = {
    storage: {
      get: async () => undefined,
      put: async () => undefined,
      delete: async () => undefined,
      deleteAll: async () => undefined,
      deleteAlarm: async () => undefined,
      setAlarm: async () => undefined,
      getAlarm: async () => null,
    },
  } as unknown as DurableObjectState;
  const doEnv = {
    DO_SHARED_SECRET: "do-shared-secret",
    DASHBOARD_PASSWORD: "dashboard-secret",
    DANGER_PASSWORD: "danger-secret",
  } as unknown as Env;
  const instance = new DownloadsDurable(state, doEnv);
  return instance;
}

function makeEnv(fakeDbDb: LicensingD1, overrides: Partial<Env> = {}): Env {
  const realDo = makeRealDo();
  const namespace = {
    idFromName: (_name: string) => "downloads-id",
    get: (_id: string) => ({ fetch: (req: Request) => realDo.fetch(req) }),
  };
  return {
    DOWNLOADS_DO: namespace as unknown as DurableObjectNamespace,
    SITE_CACHE_DB: fakeDbDb,
    DO_SHARED_SECRET: "do-shared-secret",
    DASHBOARD_PASSWORD: "dashboard-secret",
    DANGER_PASSWORD: "danger-secret",
    ENTITLEMENT_SIGNING_KEY: TEST_ENTITLEMENT_SIGNING_KEY,
    LICENSE_WEBHOOK_SECRET: TEST_LICENSE_WEBHOOK_SECRET,
    LICENSE_PROVIDER: "fake",
    MAX_BATCH_EVENTS: "10000",
    ...overrides,
  } as unknown as Env;
}

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** Webhook posts: the raw body travels verbatim; the signature covers it. */
function postRaw(path: string, rawBody: string, headers: Record<string, string> = {}): Request {
  return new Request(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: rawBody,
  });
}

async function seedLicense(db: LicensingD1): Promise<string> {
  const outcome = await issueLicense(
    { ENTITLEMENT_SIGNING_KEY: TEST_ENTITLEMENT_SIGNING_KEY } as unknown as Env,
    db,
    { licenseKey: TEST_LICENSE_KEY, plan: TEST_LICENSE_PLAN },
  );
  expect(outcome.ok).toBe(true);
  return outcome.record?.id ?? "";
}

let consoleSpies: Array<ReturnType<typeof vi.spyOn>> = [];

beforeEach(() => {
  resetLicensingSchemaCacheForTests();
  consoleSpies = [
    vi.spyOn(console, "log").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
    vi.spyOn(console, "error").mockImplementation(() => {}),
  ];
});

afterEach(() => {
  clearLicenseProvidersForTests();
  for (const spy of consoleSpies) spy.mockRestore();
});

describe("public license routes", () => {
  it("validates a seeded license and returns an HMAC-verifiable entitlement", async () => {
    const fakeDb = makeLicenseFakeD1();
    const fakeProvider = createFakeLicenseProvider();
    registerLicenseProviderForTests("fake", fakeProvider.provider);
    const licenseRef = await seedLicense(fakeDb.db as LicensingD1);
    const env = makeEnv(fakeDb.db as LicensingD1);

    const res = await worker.fetch(
      post("/license/validate", { licenseKey: TEST_LICENSE_KEY, installId: TEST_INSTALL_ID }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; status: string; entitlement: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("active");

    const payload = await verifyEntitlement(TEST_ENTITLEMENT_SIGNING_KEY, body.entitlement);
    expect(payload?.license_ref).toBe(licenseRef);
    expect(payload?.plan).toBe(TEST_LICENSE_PLAN);

    // Public CORS: validate is a browser-facing endpoint.
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("activates an install and returns the signed entitlement", async () => {
    const fakeDb = makeLicenseFakeD1();
    const fakeProvider = createFakeLicenseProvider();
    registerLicenseProviderForTests("fake", fakeProvider.provider);
    await seedLicense(fakeDb.db as LicensingD1);
    const env = makeEnv(fakeDb.db as LicensingD1);

    const res = await worker.fetch(
      post("/license/activate", { licenseKey: TEST_LICENSE_KEY, installId: TEST_INSTALL_ID }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(fakeDb.activations).toHaveLength(1);
    expect(fakeDb.activations[0].install_id).toBe(TEST_INSTALL_ID);

    // Repeat activation is idempotent.
    const repeat = await worker.fetch(
      post("/license/activate", { licenseKey: TEST_LICENSE_KEY, installId: TEST_INSTALL_ID }),
      env,
      {} as ExecutionContext,
    );
    expect(repeat.status).toBe(200);
    expect(fakeDb.activations).toHaveLength(1);
  });

  it("returns 400 for a missing install id on activate and 405 on GET", async () => {
    const fakeDb = makeLicenseFakeD1();
    registerLicenseProviderForTests("fake", createFakeLicenseProvider().provider);
    const env = makeEnv(fakeDb.db as LicensingD1);

    const noInstall = await worker.fetch(
      post("/license/activate", { licenseKey: TEST_LICENSE_KEY }),
      env,
      {} as ExecutionContext,
    );
    expect(noInstall.status).toBe(400);
    const body = (await noInstall.json()) as { error: string };
    expect(body.error).toBe("install_id_required");

    const getRes = await worker.fetch(
      new Request(`${WORKER_URL}/license/validate`),
      env,
      {} as ExecutionContext,
    );
    expect(getRes.status).toBe(405);
  });

  it("rejects an unknown license key with 403 and no registration", async () => {
    const fakeDb = makeLicenseFakeD1();
    const fakeProvider = createFakeLicenseProvider();
    registerLicenseProviderForTests("fake", fakeProvider.provider);
    const env = makeEnv(fakeDb.db as LicensingD1);

    const res = await worker.fetch(
      post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("license_invalid");
  });

  it("fails closed with 503 when the D1 binding is absent", async () => {
    const fakeDb = makeLicenseFakeD1();
    registerLicenseProviderForTests("fake", createFakeLicenseProvider().provider);
    const env = makeEnv(fakeDb.db as LicensingD1, { SITE_CACHE_DB: undefined });

    const res = await worker.fetch(
      post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("storage_unavailable");
  });

  it("fails closed with 503 when the entitlement signing key is missing", async () => {
    const fakeDb = makeLicenseFakeD1();
    registerLicenseProviderForTests("fake", createFakeLicenseProvider().provider);
    await seedLicense(fakeDb.db as LicensingD1);
    const env = makeEnv(fakeDb.db as LicensingD1, { ENTITLEMENT_SIGNING_KEY: undefined });

    const res = await worker.fetch(
      post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("signing_key_unconfigured");
  });

  it("trips the DO rate limiter after the validate allowance", async () => {
    const fakeDb = makeLicenseFakeD1();
    registerLicenseProviderForTests("fake", createFakeLicenseProvider().provider);
    const env = makeEnv(fakeDb.db as LicensingD1);

    let lastStatus = 0;
    for (let i = 0; i < 10; i += 1) {
      const res = await worker.fetch(
        post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
        env,
        {} as ExecutionContext,
      );
      lastStatus = res.status;
      expect(res.status).toBe(403); // unknown key, but the limiter still counted
    }
    expect(lastStatus).toBe(403);

    const blocked = await worker.fetch(
      post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
      env,
      {} as ExecutionContext,
    );
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { error: string; retryAfterSec: number };
    expect(body.error).toBe("rate_limited");
    expect(body.retryAfterSec).toBeGreaterThan(0);
    expect(body.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("keeps validate and activate rate buckets independent", async () => {
    const fakeDb = makeLicenseFakeD1();
    registerLicenseProviderForTests("fake", createFakeLicenseProvider().provider);
    await seedLicense(fakeDb.db as LicensingD1);
    const env = makeEnv(fakeDb.db as LicensingD1);

    // Burn the validate allowance.
    for (let i = 0; i < 10; i += 1) {
      await worker.fetch(
        post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
        env,
        {} as ExecutionContext,
      );
    }
    // Activate still has its own allowance.
    const activated = await worker.fetch(
      post("/license/activate", { licenseKey: TEST_LICENSE_KEY, installId: TEST_INSTALL_ID }),
      env,
      {} as ExecutionContext,
    );
    expect(activated.status).toBe(200);
  });

  it("wt5f: trips the DO rate limiter after the activate allowance", async () => {
    const fakeDb = makeLicenseFakeD1();
    registerLicenseProviderForTests("fake", createFakeLicenseProvider().provider);
    await seedLicense(fakeDb.db as LicensingD1);
    const env = makeEnv(fakeDb.db as LicensingD1);

    let lastStatus = 0;
    for (let i = 0; i < 5; i += 1) {
      const res = await worker.fetch(
        post("/license/activate", { licenseKey: TEST_LICENSE_KEY, installId: `${TEST_INSTALL_ID}-rl-${i}` }),
        env,
        {} as ExecutionContext,
      );
      lastStatus = res.status;
      expect(res.status).toBe(200);
    }
    expect(lastStatus).toBe(200);

    const blocked = await worker.fetch(
      post("/license/activate", { licenseKey: TEST_LICENSE_KEY, installId: `${TEST_INSTALL_ID}-rl-over` }),
      env,
      {} as ExecutionContext,
    );
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { error: string };
    expect(body.error).toBe("rate_limited");
  });

  it("never emits the raw license key in responses or logs", async () => {
    const fakeDb = makeLicenseFakeD1();
    const fakeProvider = createFakeLicenseProvider();
    registerLicenseProviderForTests("fake", fakeProvider.provider);
    await seedLicense(fakeDb.db as LicensingD1);
    const env = makeEnv(fakeDb.db as LicensingD1);

    const responses: string[] = [];
    const validateRes = await worker.fetch(
      post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
      env,
      {} as ExecutionContext,
    );
    responses.push(JSON.stringify(await validateRes.clone().json()));

    const unknownRes = await worker.fetch(
      post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
      env,
      {} as ExecutionContext,
    );
    responses.push(`${unknownRes.status}:${await unknownRes.text()}`);

    const activateRes = await worker.fetch(
      post("/license/activate", { licenseKey: TEST_LICENSE_KEY, installId: TEST_INSTALL_ID }),
      env,
      {} as ExecutionContext,
    );
    responses.push(JSON.stringify(await activateRes.json()));

    const badFormat = await worker.fetch(
      post("/license/validate", { licenseKey: "bad key" }),
      env,
      {} as ExecutionContext,
    );
    responses.push(`${badFormat.status}:${await badFormat.text()}`);

    for (const text of responses) {
      expect(text).not.toContain(TEST_LICENSE_KEY);
    }
    // Log spies: no console surface may carry the raw key either.
    for (const spy of consoleSpies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(TEST_LICENSE_KEY);
      }
    }
  });
});

describe("admin license routes", () => {
  it("requires the shared auth context", async () => {
    const fakeDb = makeLicenseFakeD1();
    const env = makeEnv(fakeDb.db as LicensingD1);

    const res = await worker.fetch(
      post("/admin/licenses/issue", { licenseKey: TEST_LICENSE_KEY, plan: TEST_LICENSE_PLAN }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unauthorized");
  });

  it("issues via X-Admin-Secret without returning raw key material", async () => {
    const fakeDb = makeLicenseFakeD1();
    const env = makeEnv(fakeDb.db as LicensingD1);

    const res = await worker.fetch(
      post(
        "/admin/licenses/issue",
        { licenseKey: TEST_LICENSE_KEY, plan: TEST_LICENSE_PLAN },
        { "X-Admin-Secret": "do-shared-secret" },
      ),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      code: string;
      license: { id: string; plan: string; status: string };
    };
    expect(body.ok).toBe(true);
    expect(body.license.id).toBeTruthy();
    expect(body.license.status).toBe("active");
    expect(JSON.stringify(body)).not.toContain(TEST_LICENSE_KEY);
  });

  it("lists licenses without key hashes", async () => {
    const fakeDb = makeLicenseFakeD1();
    const env = makeEnv(fakeDb.db as LicensingD1);
    await seedLicense(fakeDb.db as LicensingD1);

    const res = await worker.fetch(
      new Request(`${WORKER_URL}/admin/licenses/list`, {
        headers: { "X-Admin-Secret": "do-shared-secret" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; licenses: Array<Record<string, unknown>> };
    expect(body.ok).toBe(true);
    expect(body.licenses).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("key_hash");
    expect(JSON.stringify(body)).not.toContain(TEST_LICENSE_KEY);
  });

  it("revokes by license ref and the next validate then fails with 403", async () => {
    const fakeDb = makeLicenseFakeD1();
    const fakeProvider = createFakeLicenseProvider();
    registerLicenseProviderForTests("fake", fakeProvider.provider);
    const licenseRef = await seedLicense(fakeDb.db as LicensingD1);
    const env = makeEnv(fakeDb.db as LicensingD1);

    const res = await worker.fetch(
      post("/admin/licenses/revoke", { licenseRef }, { "X-Admin-Secret": "do-shared-secret" }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; license: { status: string } };
    expect(body.license.status).toBe("revoked");

    const validated = await worker.fetch(
      post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
      env,
      {} as ExecutionContext,
    );
    expect(validated.status).toBe(403);
    const validatedBody = (await validated.json()) as { error: string; licenseStatus: string };
    expect(validatedBody.error).toBe("license_invalid");
    expect(validatedBody.licenseStatus).toBe("invalid");
  });

  it("returns 404 for revoking an unknown license ref", async () => {
    const fakeDb = makeLicenseFakeD1();
    const env = makeEnv(fakeDb.db as LicensingD1);
    const res = await worker.fetch(
      post(
        "/admin/licenses/revoke",
        { licenseRef: "no-such-license" },
        { "X-Admin-Secret": "do-shared-secret" },
      ),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(404);
  });
});

describe("webhook route (real Lemon Squeezy signature verification)", () => {
  async function lsSignature(rawBody: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(TEST_LICENSE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function lsWebhookBody(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      meta: { event_name: "order_created" },
      data: {
        id: "order-1",
        attributes: { license_key: TEST_LICENSE_KEY, product_name: "CQD Pro" },
        ...overrides,
      },
    });
  }

  function makeLsEnv(fakeDbDb: LicensingD1): Env {
    return makeEnv(fakeDbDb, { LICENSE_PROVIDER: "lemonsqueezy" });
  }

  it("accepts a validly signed webhook and registers the license", async () => {
    const fakeDb = makeLicenseFakeD1();
    const env = makeLsEnv(fakeDb.db as LicensingD1);
    const rawBody = lsWebhookBody();
    const signature = await lsSignature(rawBody);

    const res = await worker.fetch(
      postRaw("/license/webhook", rawBody, { "X-Signature": signature }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; code: string };
    expect(body.code).toBe("webhook_handled");
    expect(fakeDb.licenses).toHaveLength(1);
  });

  it("rejects a tampered body with 401", async () => {
    const fakeDb = makeLicenseFakeD1();
    const env = makeLsEnv(fakeDb.db as LicensingD1);
    const signature = await lsSignature(lsWebhookBody());
    const tampered = lsWebhookBody({ id: "order-999" });

    const res = await worker.fetch(
      postRaw("/license/webhook", tampered, { "X-Signature": signature }),
      env,
      {} as ExecutionContext,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok: boolean; code: string };
    expect(body.code).toBe("webhook_signature_invalid");
    expect(fakeDb.licenses).toHaveLength(0);
  });

  it("treats a replayed webhook as an idempotent duplicate", async () => {
    const fakeDb = makeLicenseFakeD1();
    const env = makeLsEnv(fakeDb.db as LicensingD1);
    const rawBody = lsWebhookBody();
    const signature = await lsSignature(rawBody);
    const headers = { "X-Signature": signature };

    const first = await worker.fetch(postRaw("/license/webhook", rawBody, headers), env, {} as ExecutionContext);
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { code: string };
    expect(firstBody.code).toBe("webhook_handled");

    const replay = await worker.fetch(postRaw("/license/webhook", rawBody, headers), env, {} as ExecutionContext);
    expect(replay.status).toBe(200);
    const replayBody = (await replay.json()) as { code: string };
    expect(replayBody.code).toBe("webhook_duplicate");
    expect(fakeDb.licenses).toHaveLength(1);
    expect(fakeDb.licenseEvents).toHaveLength(1);
  });

  it("maps a signed order_refunded webhook to a validate-rejecting refund", async () => {
    const fakeDb = makeLicenseFakeD1();
    const env = makeLsEnv(fakeDb.db as LicensingD1);

    // Register the license through its own order_created webhook first, so
    // the row carries provider_resource_id "order-1" for the refund target.
    const createdBody = lsWebhookBody();
    const createdSig = await lsSignature(createdBody);
    const created = await worker.fetch(
      postRaw("/license/webhook", createdBody, { "X-Signature": createdSig }),
      env,
      {} as ExecutionContext,
    );
    expect(created.status).toBe(200);

    const refundBody = JSON.stringify({
      meta: { event_name: "order_refunded" },
      data: { id: "order-1", attributes: { status: "refunded" } },
    });
    const refundSig = await lsSignature(refundBody);
    const refund = await worker.fetch(
      postRaw("/license/webhook", refundBody, { "X-Signature": refundSig }),
      env,
      {} as ExecutionContext,
    );
    expect(refund.status).toBe(200);
    expect(fakeDb.licenses[0].status).toBe("refunded");

    const validated = await worker.fetch(
      post("/license/validate", { licenseKey: TEST_LICENSE_KEY }),
      env,
      {} as ExecutionContext,
    );
    expect(validated.status).toBe(403);
    const validatedBody = (await validated.json()) as { licenseStatus: string };
    expect(validatedBody.licenseStatus).toBe("invalid");
  });
});
