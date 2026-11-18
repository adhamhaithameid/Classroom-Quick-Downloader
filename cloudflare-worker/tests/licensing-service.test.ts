import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeEffectiveStatus,
  ensureLicensingSchema,
  hashLicenseKey,
  issueLicense,
  activateLicense,
  processLicenseWebhook,
  resetLicensingSchemaCacheForTests,
  revokeLicense,
  signEntitlement,
  validateLicense,
  verifyEntitlement,
  LICENSE_GRACE_PERIOD_MS,
  MAX_ACTIVATIONS_PER_LICENSE,
  type LicensingD1,
} from "../src/licensing/service";
import {
  clearLicenseProvidersForTests,
  registerLicenseProviderForTests,
} from "../src/licensing/provider";
import type { Env } from "../src/types";
import {
  TEST_ENTITLEMENT_SIGNING_KEY,
  TEST_INSTALL_ID,
  TEST_LICENSE_KEY,
  TEST_LICENSE_KEY_SECOND,
  TEST_LICENSE_PLAN,
  createFakeLicenseProvider,
  makeLicenseFakeD1,
} from "./helpers/license-fake";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DO_SHARED_SECRET: "do-shared-secret",
    ENTITLEMENT_SIGNING_KEY: TEST_ENTITLEMENT_SIGNING_KEY,
    LICENSE_WEBHOOK_SECRET: "license-webhook-secret",
    LICENSE_PROVIDER: "fake",
    ...overrides,
  } as unknown as Env;
}

function freshHarness() {
  resetLicensingSchemaCacheForTests();
  const fakeDb = makeLicenseFakeD1();
  const fakeProvider = createFakeLicenseProvider();
  registerLicenseProviderForTests("fake", fakeProvider.provider);
  return { fakeDb, fakeProvider };
}

beforeEach(() => {
  resetLicensingSchemaCacheForTests();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  clearLicenseProvidersForTests();
});

describe("grace-window math", () => {
  const now = 1_800_000_000_000;
  const day = 24 * 60 * 60 * 1000;

  it("treats a license inside its expiry as active", () => {
    expect(computeEffectiveStatus("active", now + day, now)).toBe("active");
  });

  it("treats a perpetual license (expiresAt null) as active", () => {
    expect(computeEffectiveStatus("active", null, now)).toBe("active");
  });

  it("treats a future expiresAt as active", () => {
    expect(computeEffectiveStatus("active", now + 365 * day, now)).toBe("active");
  });

  it("treats expired-but-within-grace as grace (still valid)", () => {
    const justExpired = now - 1000;
    expect(computeEffectiveStatus("active", justExpired, now)).toBe("grace");
    const lastGraceMs = now - LICENSE_GRACE_PERIOD_MS + 1000;
    expect(computeEffectiveStatus("active", lastGraceMs, now)).toBe("grace");
  });

  it("treats expired-past-grace as expired (invalid)", () => {
    const pastGrace = now - LICENSE_GRACE_PERIOD_MS - 1000;
    expect(computeEffectiveStatus("active", pastGrace, now)).toBe("expired");
    expect(computeEffectiveStatus("active", pastGrace, now + day)).toBe("expired");
  });

  it("treats revoked and refunded rows as invalid immediately", () => {
    expect(computeEffectiveStatus("revoked", now + day, now)).toBe("invalid");
    expect(computeEffectiveStatus("refunded", null, now)).toBe("invalid");
  });
});

describe("entitlement signing", () => {
  it("round-trips a payload and keeps the contract field order", async () => {
    const payload = {
      license_ref: "ref-1",
      plan: TEST_LICENSE_PLAN,
      expiresAt: 123,
      graceUntil: 456,
      issuedAt: 789,
    };
    const signed = await signEntitlement(TEST_ENTITLEMENT_SIGNING_KEY, payload);
    const [payloadB64, sigB64] = signed.entitlement.split(".");
    expect(payloadB64).toBeTruthy();
    expect(sigB64).toBeTruthy();
    const decoded = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    expect(Object.keys(decoded)).toEqual([
      "license_ref",
      "plan",
      "expiresAt",
      "graceUntil",
      "issuedAt",
    ]);
    const verified = await verifyEntitlement(TEST_ENTITLEMENT_SIGNING_KEY, signed.entitlement);
    expect(verified).toEqual(payload);
  });

  it("rejects a tampered payload and a wrong key", async () => {
    const payload = {
      license_ref: "ref-1",
      plan: TEST_LICENSE_PLAN,
      expiresAt: null,
      graceUntil: null,
      issuedAt: 1,
    };
    const signed = await signEntitlement(TEST_ENTITLEMENT_SIGNING_KEY, payload);
    const [payloadB64, sigB64] = signed.entitlement.split(".");

    const tamperedSig = (sigB64[0] === "A" ? "B" : "A") + sigB64.slice(1);
    expect(await verifyEntitlement(TEST_ENTITLEMENT_SIGNING_KEY, `${payloadB64}.${tamperedSig}`)).toBeNull();
    expect(await verifyEntitlement("other-key", signed.entitlement)).toBeNull();
    expect(await verifyEntitlement(TEST_ENTITLEMENT_SIGNING_KEY, "garbage")).toBeNull();
  });
});

describe("key hashing", () => {
  it("hashes a normalized key to 64 hex chars without leaking the raw key", async () => {
    const hash = await hashLicenseKey(` ${TEST_LICENSE_KEY} `);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(TEST_LICENSE_KEY);
    expect(hash).toBe(await hashLicenseKey(TEST_LICENSE_KEY));
  });

  it("refuses malformed keys (null, never a throw)", async () => {
    expect(await hashLicenseKey("short")).toBeNull();
    expect(await hashLicenseKey("has spaces in it")).toBeNull();
    expect(await hashLicenseKey("")).toBeNull();
  });
});

describe("licensing schema (D1 migrations on a fresh database)", () => {
  it("applies all three CREATE TABLE statements exactly once on a fresh DB", async () => {
    const { fakeDb } = freshHarness();
    const result = await ensureLicensingSchema(fakeDb.db as LicensingD1);
    expect(result.ok).toBe(true);
    expect(fakeDb.schemaStatements).toHaveLength(3);
    const joined = fakeDb.schemaStatements.join("\n");
    expect(joined).toContain("CREATE TABLE IF NOT EXISTS licenses");
    expect(joined).toContain("CREATE TABLE IF NOT EXISTS activations");
    expect(joined).toContain("CREATE TABLE IF NOT EXISTS license_events");
    expect(joined).toContain("key_hash TEXT NOT NULL UNIQUE");
    expect(joined).toContain("PRIMARY KEY (license_id, install_id)");
    expect(joined).toContain("payload_digest TEXT NOT NULL UNIQUE");
    // Second ensure is a cached no-op.
    await ensureLicensingSchema(fakeDb.db as LicensingD1);
    expect(fakeDb.schemaStatements).toHaveLength(3);
  });

  it("keeps service writes working after a fresh-DB schema apply", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    fakeProvider.seedLicense(TEST_LICENSE_KEY);
    const env = makeEnv();
    const issued = await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
    });
    expect(issued.ok).toBe(true);
    const validated = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(validated.ok).toBe(true);
    expect(fakeDb.licenses).toHaveLength(1);
  });
});

describe("license service flows (fake provider drives the same code path)", () => {
  it("issues, validates, and returns a signed entitlement that never contains the raw key", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    fakeProvider.seedLicense(TEST_LICENSE_KEY);
    const env = makeEnv();

    const issued = await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
    });
    expect(issued.ok).toBe(true);
    expect(issued.code).toBe("license_issued");
    expect(issued.record?.id).toBeTruthy();

    const validated = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      installId: TEST_INSTALL_ID,
    });
    expect(validated.ok).toBe(true);
    expect(validated.status).toBe("active");

    const decoded = await verifyEntitlement(TEST_ENTITLEMENT_SIGNING_KEY, validated.entitlement ?? "");
    expect(decoded?.license_ref).toBe(issued.record?.id);
    expect(decoded?.plan).toBe(TEST_LICENSE_PLAN);
    expect(decoded?.graceUntil).toBeNull();

    // Raw key material must not appear in any persisted or returned surface.
    const dbDump = JSON.stringify({
      licenses: fakeDb.licenses,
      activations: fakeDb.activations,
      licenseEvents: fakeDb.licenseEvents,
    });
    expect(dbDump).not.toContain(TEST_LICENSE_KEY);
    expect(JSON.stringify(validated)).not.toContain(TEST_LICENSE_KEY);
  });

  it("rejects an unknown key without registering anything", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const env = makeEnv();
    const outcome = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("license_invalid");
    expect(fakeDb.licenses).toHaveLength(0);
    expect(fakeProvider.validateCalls).toContain(TEST_LICENSE_KEY);
  });

  it("self-registers an unknown key when the provider vouches for it", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    fakeProvider.seedLicense(TEST_LICENSE_KEY);
    const env = makeEnv();
    const outcome = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(outcome.ok).toBe(true);
    expect(fakeDb.licenses).toHaveLength(1);
    expect(fakeDb.licenses[0].provider).toBe("fake");
  });

  it("propagates revocation to validate", async () => {
    const { fakeDb } = freshHarness();
    const env = makeEnv();
    const issued = await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
    });
    const revoked = await revokeLicense(env, fakeDb.db as LicensingD1, {
      licenseRef: issued.record?.id ?? "",
    });
    expect(revoked.ok).toBe(true);

    const validated = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(validated.ok).toBe(false);
    expect(validated.code).toBe("license_invalid");
    expect(validated.status).toBe("invalid");
  });

  it("serves expired-but-within-grace validations with a grace status", async () => {
    const { fakeDb } = freshHarness();
    const env = makeEnv();
    const withinGrace = Date.now() - LICENSE_GRACE_PERIOD_MS / 2;
    await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
      expiresAt: withinGrace,
    });
    const outcome = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.status).toBe("grace");
    const decoded = await verifyEntitlement(TEST_ENTITLEMENT_SIGNING_KEY, outcome.entitlement ?? "");
    expect(decoded?.expiresAt).toBe(withinGrace);
    expect(decoded?.graceUntil).toBe(withinGrace + LICENSE_GRACE_PERIOD_MS);
  });

  it("fails expired-past-grace validations until revalidation", async () => {
    const { fakeDb } = freshHarness();
    const env = makeEnv();
    const pastGrace = Date.now() - LICENSE_GRACE_PERIOD_MS - 1000;
    await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
      expiresAt: pastGrace,
    });
    const outcome = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("license_expired");
  });

  it("caps activations per license and keeps re-activation idempotent", async () => {
    const { fakeDb } = freshHarness();
    const env = makeEnv();
    await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
    });

    for (let i = 0; i < MAX_ACTIVATIONS_PER_LICENSE; i += 1) {
      const outcome = await activateLicense(env, fakeDb.db as LicensingD1, {
        licenseKey: TEST_LICENSE_KEY,
        installId: `${TEST_INSTALL_ID}-${i}`,
      });
      expect(outcome.ok).toBe(true);
    }
    expect(fakeDb.activations).toHaveLength(MAX_ACTIVATIONS_PER_LICENSE);

    const overCap = await activateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      installId: `${TEST_INSTALL_ID}-over`,
    });
    expect(overCap.ok).toBe(false);
    expect(overCap.code).toBe("activation_limit_reached");

    // Re-activating an existing install stays inside the cap.
    const repeat = await activateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      installId: `${TEST_INSTALL_ID}-0`,
    });
    expect(repeat.ok).toBe(true);
    expect(fakeDb.activations).toHaveLength(MAX_ACTIVATIONS_PER_LICENSE);
  });

  it("refuses malformed keys and install ids with format codes", async () => {
    const { fakeDb } = freshHarness();
    const env = makeEnv();
    const badKey = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: "bad key with spaces",
    });
    expect(badKey).toMatchObject({ ok: false, code: "license_key_format_invalid" });

    await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
    });
    const badInstall = await activateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      installId: "short",
    });
    expect(badInstall).toMatchObject({ ok: false, code: "install_id_format_invalid" });
  });

  it("returns signing_key_unconfigured when the entitlement key is missing", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    fakeProvider.seedLicense(TEST_LICENSE_KEY);
    const env = makeEnv({ ENTITLEMENT_SIGNING_KEY: undefined });
    await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
    });
    const outcome = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("signing_key_unconfigured");
  });
});

describe("webhook processing (fake provider, idempotency)", () => {
  function webhookBody(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      eventName: "order_created",
      eventId: "evt-1",
      licenseKey: TEST_LICENSE_KEY,
      ...overrides,
    });
  }

  it("registers a license from order_created and dedupes replays", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const headers = new Headers({ "X-Test-Signature": "valid" });

    const first = await processLicenseWebhook(
      makeEnv(),
      fakeDb.db as LicensingD1,
      fakeProvider.provider,
      webhookBody(),
      headers,
    );
    expect(first).toMatchObject({ ok: true, code: "webhook_handled", httpStatus: 200 });
    expect(fakeDb.licenses).toHaveLength(1);

    const replay = await processLicenseWebhook(
      makeEnv(),
      fakeDb.db as LicensingD1,
      fakeProvider.provider,
      webhookBody(),
      headers,
    );
    expect(replay).toMatchObject({ ok: true, code: "webhook_duplicate", httpStatus: 200 });
    expect(fakeDb.licenses).toHaveLength(1);
    expect(fakeDb.licenseEvents).toHaveLength(1);
  });

  it("rejects a bad signature with 401 and records nothing", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const headers = new Headers({ "X-Test-Signature": "invalid" });
    const outcome = await processLicenseWebhook(
      makeEnv(),
      fakeDb.db as LicensingD1,
      fakeProvider.provider,
      webhookBody(),
      headers,
    );
    expect(outcome).toMatchObject({ ok: false, code: "webhook_signature_invalid", httpStatus: 401 });
    expect(fakeDb.licenseEvents).toHaveLength(0);
    expect(fakeDb.licenses).toHaveLength(0);
  });

  it("maps order_refunded to the refunded status and validate then fails", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const headers = new Headers({ "X-Test-Signature": "valid" });
    const env = makeEnv();
    await processLicenseWebhook(
      env,
      fakeDb.db as LicensingD1,
      fakeProvider.provider,
      webhookBody(),
      headers,
    );

    const refund = await processLicenseWebhook(
      env,
      fakeDb.db as LicensingD1,
      fakeProvider.provider,
      webhookBody({ eventName: "order_refunded", eventId: "evt-2" }),
      headers,
    );
    expect(refund.ok).toBe(true);
    expect(fakeDb.licenses[0].status).toBe("refunded");

    const validated = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(validated.ok).toBe(false);
    expect(validated.status).toBe("invalid");
  });

  it("updates expiry from subscription events and keeps grace math authoritative", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const headers = new Headers({ "X-Test-Signature": "valid" });
    const env = makeEnv();
    await processLicenseWebhook(
      env,
      fakeDb.db as LicensingD1,
      fakeProvider.provider,
      webhookBody(),
      headers,
    );

    const futureExpiry = Date.now() + 90 * 24 * 60 * 60 * 1000;
    const updated = await processLicenseWebhook(
      env,
      fakeDb.db as LicensingD1,
      fakeProvider.provider,
      webhookBody({ eventName: "subscription_updated", eventId: "evt-3", expiresAt: futureExpiry }),
      headers,
    );
    expect(updated.ok).toBe(true);
    expect(fakeDb.licenses[0].expires_at).toBe(futureExpiry);

    const validated = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(validated.ok).toBe(true);
    expect(validated.status).toBe("active");
  });

  it("keeps webhook payloads free of raw key material", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const headers = new Headers({ "X-Test-Signature": "valid" });
    await processLicenseWebhook(
      makeEnv(),
      fakeDb.db as LicensingD1,
      fakeProvider.provider,
      webhookBody(),
      headers,
    );
    const dump = JSON.stringify({ events: fakeDb.licenseEvents, licenses: fakeDb.licenses });
    expect(dump).not.toContain(TEST_LICENSE_KEY);
  });

  it("records a custom provider name per row while the fake still serves the path", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const env = makeEnv();
    await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY_SECOND,
      plan: TEST_LICENSE_PLAN,
      provider: "paddle-like",
    });
    expect(fakeDb.licenses[0].provider).toBe("paddle-like");
    // The fake's issue hook ran through the same service path (interface swap).
    expect(fakeProvider.issuedPlans).toContain(TEST_LICENSE_PLAN);
  });
});

// ---------------------------------------------------------------------------
// Review fix round 1 (findings 1-4 + activation-cap minor)
// ---------------------------------------------------------------------------

describe("review fix round 1", () => {
  const webhookHeaders = () => new Headers({ "X-Test-Signature": "valid" });

  function fakeWebhookBody(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      eventName: "order_created",
      eventId: "evt-fix-1",
      licenseKey: TEST_LICENSE_KEY,
      ...overrides,
    });
  }

  it("finding 1: provider reporting inactive fails validate with NO signed entitlement", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const env = makeEnv();
    await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
    });
    // Deactivate on the provider side after the local row exists.
    fakeProvider.seedLicense(TEST_LICENSE_KEY, { status: "inactive" });

    const outcome = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe("license_inactive");
    expect(outcome.status).toBe("invalid");
    expect(outcome.entitlement).toBeUndefined();
    const decoded = outcome.entitlement
      ? await verifyEntitlement(TEST_ENTITLEMENT_SIGNING_KEY, outcome.entitlement)
      : null;
    expect(decoded).toBeNull();

    // Activation is refused too.
    const activated = await activateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      installId: TEST_INSTALL_ID,
    });
    expect(activated.ok).toBe(false);
    expect(activated.code).toBe("license_inactive");

    // Reactivation on the provider side heals the row (not persisted as revoked).
    fakeProvider.seedLicense(TEST_LICENSE_KEY, { status: "active" });
    const healed = await validateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
    });
    expect(healed.ok).toBe(true);
    expect(healed.status).toBe("active");
  });

  it("finding 2: a webhook delivery that throws mid-processing is retried, not deduped", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const db = fakeDb.db as LicensingD1;
    const body = fakeWebhookBody();
    const env = makeEnv();

    // First delivery dies inside processing (license INSERT fails).
    fakeDb.failNextMatch("INSERT INTO licenses", 1);
    const first = await processLicenseWebhook(env, db, fakeProvider.provider, body, webhookHeaders());
    expect(first).toMatchObject({ ok: false, code: "webhook_processing_failed", httpStatus: 500 });
    // No dedupe digest was persisted by the failed delivery.
    expect(fakeDb.licenseEvents).toHaveLength(0);
    expect(fakeDb.licenses).toHaveLength(0);

    // Provider retry is processed (not told "duplicate").
    const retry = await processLicenseWebhook(env, db, fakeProvider.provider, body, webhookHeaders());
    expect(retry).toMatchObject({ ok: true, code: "webhook_handled", httpStatus: 200 });
    expect(fakeDb.licenses).toHaveLength(1);
    expect(fakeDb.licenseEvents).toHaveLength(1);

    // Only a third identical delivery is a true replay.
    const replay = await processLicenseWebhook(env, db, fakeProvider.provider, body, webhookHeaders());
    expect(replay).toMatchObject({ ok: true, code: "webhook_duplicate", httpStatus: 200 });
    expect(fakeDb.licenses).toHaveLength(1);
  });

  it("finding 3: distinct payloads with the same provider event id are both processed", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const db = fakeDb.db as LicensingD1;
    const env = makeEnv();
    const headers = webhookHeaders();

    await processLicenseWebhook(
      env,
      db,
      fakeProvider.provider,
      fakeWebhookBody({ licenseKey: TEST_LICENSE_KEY }),
      headers,
    );

    // Same event name + same subscription id, different content: the first
    // subscription_updated must NOT be swallowed as a duplicate.
    const secondExpiry = Date.now() + 20 * 24 * 60 * 60 * 1000;
    const firstUpdate = fakeWebhookBody({
      eventName: "subscription_updated",
      eventId: "sub-collision",
      resourceKind: "subscription",
      providerResourceId: "sub-777",
      expiresAt: Date.now() + 10 * 24 * 60 * 60 * 1000,
    });
    const secondUpdate = fakeWebhookBody({
      eventName: "subscription_updated",
      eventId: "sub-collision",
      resourceKind: "subscription",
      providerResourceId: "sub-777",
      expiresAt: secondExpiry,
    });
    const one = await processLicenseWebhook(env, db, fakeProvider.provider, firstUpdate, headers);
    const two = await processLicenseWebhook(env, db, fakeProvider.provider, secondUpdate, headers);
    expect(one).toMatchObject({ ok: true, code: "webhook_handled" });
    expect(two).toMatchObject({ ok: true, code: "webhook_handled" });

    // The second payload's expiry won: no event was dropped.
    expect(fakeDb.licenses[0].expires_at).toBe(secondExpiry);
    // An identical resend of the second payload is a true replay.
    const replay = await processLicenseWebhook(env, db, fakeProvider.provider, secondUpdate, headers);
    expect(replay).toMatchObject({ ok: true, code: "webhook_duplicate" });
  });

  it("finding 4: a subscription event reaches a self-registered row and binds its id", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const db = fakeDb.db as LicensingD1;
    const env = makeEnv();

    // Self-registration: unknown key, provider vouches -> row with the
    // license-key id in provider_resource_id and no subscription binding.
    fakeProvider.seedLicense(TEST_LICENSE_KEY);
    const resolved = await validateLicense(env, db, { licenseKey: TEST_LICENSE_KEY });
    expect(resolved.ok).toBe(true);
    expect(fakeDb.licenses[0].provider_resource_id).toContain("fake-resource");
    expect(fakeDb.licenses[0].provider_subscription_id).toBeNull();

    // Subscription event carrying the license key reaches the row and
    // backfills the subscription namespace.
    const futureExpiry = Date.now() + 60 * 24 * 60 * 60 * 1000;
    const bound = await processLicenseWebhook(
      env,
      db,
      fakeProvider.provider,
      fakeWebhookBody({
        eventName: "subscription_updated",
        eventId: "sub-bind-1",
        resourceKind: "subscription",
        providerResourceId: "sub-self-1",
        expiresAt: futureExpiry,
      }),
      webhookHeaders(),
    );
    expect(bound).toMatchObject({ ok: true, code: "webhook_handled" });
    expect(fakeDb.licenses[0].provider_subscription_id).toBe("sub-self-1");
    expect(fakeDb.licenses[0].expires_at).toBe(futureExpiry);

    // A later subscription event WITHOUT the key still reaches the row via
    // the bound subscription id.
    const renewal = Date.now() + 120 * 24 * 60 * 60 * 1000;
    const reached = await processLicenseWebhook(
      env,
      db,
      fakeProvider.provider,
      fakeWebhookBody({
        eventName: "subscription_updated",
        eventId: "sub-bind-2",
        resourceKind: "subscription",
        providerResourceId: "sub-self-1",
        expiresAt: renewal,
      }),
      webhookHeaders(),
    );
    expect(reached).toMatchObject({ ok: true, code: "webhook_handled" });
    expect(fakeDb.licenses[0].expires_at).toBe(renewal);
  });

  it("finding 4: a refund without a license key reaches its webhook-registered row by order id", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const db = fakeDb.db as LicensingD1;
    const env = makeEnv();
    const headers = webhookHeaders();

    // Webhook-registered row: provider_resource_id = order id.
    await processLicenseWebhook(
      env,
      db,
      fakeProvider.provider,
      fakeWebhookBody({ eventId: "order-42", orderId: "order-42" }),
      headers,
    );
    expect(fakeDb.licenses[0].provider_resource_id).toBe("order-42");

    const refunded = await processLicenseWebhook(
      env,
      db,
      fakeProvider.provider,
      fakeWebhookBody({
        eventName: "order_refunded",
        eventId: "order-42",
        resourceKind: "order",
        providerResourceId: "order-42",
        licenseKey: undefined,
      }),
      headers,
    );
    expect(refunded).toMatchObject({ ok: true, code: "webhook_handled" });
    expect(fakeDb.licenses[0].status).toBe("refunded");

    const validated = await validateLicense(env, db, { licenseKey: TEST_LICENSE_KEY });
    expect(validated.ok).toBe(false);
    expect(validated.status).toBe("invalid");
  });

  it("minor: the activation cap is enforced by the conditional insert, not a pre-count", async () => {
    const { fakeDb } = freshHarness();
    const env = makeEnv();
    await issueLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      plan: TEST_LICENSE_PLAN,
    });

    for (let i = 0; i < MAX_ACTIVATIONS_PER_LICENSE; i += 1) {
      const outcome = await activateLicense(env, fakeDb.db as LicensingD1, {
        licenseKey: TEST_LICENSE_KEY,
        installId: `${TEST_INSTALL_ID}-cap-${i}`,
      });
      expect(outcome.ok).toBe(true);
    }
    const overCap = await activateLicense(env, fakeDb.db as LicensingD1, {
      licenseKey: TEST_LICENSE_KEY,
      installId: `${TEST_INSTALL_ID}-cap-over`,
    });
    expect(overCap).toMatchObject({ ok: false, code: "activation_limit_reached" });
    expect(fakeDb.activations).toHaveLength(MAX_ACTIVATIONS_PER_LICENSE);
  });
  // wt5f.2: refunded/revoked are terminal — subscription events must not
  // resurrect them.
  it("wt5f: subscription events never resurrect a refunded or revoked row", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const db = fakeDb.db as LicensingD1;
    const env = makeEnv();
    const headers = webhookHeaders();

    await processLicenseWebhook(
      env, db, fakeProvider.provider,
      fakeWebhookBody({ eventId: "order-rf", orderId: "order-rf" }),
      headers,
    );
    await processLicenseWebhook(
      env, db, fakeProvider.provider,
      fakeWebhookBody({
        eventName: "order_refunded", eventId: "order-rf",
        resourceKind: "order", providerResourceId: "order-rf",
        licenseKey: undefined,
      }),
      headers,
    );
    expect(fakeDb.licenses[0].status).toBe("refunded");

    const resurrect = await processLicenseWebhook(
      env, db, fakeProvider.provider,
      fakeWebhookBody({
        eventName: "subscription_resumed", eventId: "sub-rf",
        resourceKind: "subscription", providerResourceId: "sub-rf",
      }),
      headers,
    );
    expect(resurrect).toMatchObject({ ok: true, code: "webhook_handled" });
    expect(fakeDb.licenses[0].status).toBe("refunded");

    // Admin revoke: same terminal rule.
    await processLicenseWebhook(
      env, db, fakeProvider.provider,
      fakeWebhookBody({ eventId: "order-rv", orderId: "order-rv2" }),
      headers,
    );
    const issued = await issueLicense(env, db, {
      licenseKey: TEST_LICENSE_KEY, plan: TEST_LICENSE_PLAN,
    });
    expect(issued.ok).toBe(true);
    const revoked = await revokeLicense(env, db, { licenseRef: issued.record!.id });
    expect(revoked.ok).toBe(true);

    const resumed = await processLicenseWebhook(
      env, db, fakeProvider.provider,
      fakeWebhookBody({
        eventName: "subscription_created", eventId: "sub-rv",
        resourceKind: "subscription", providerResourceId: "sub-rv",
      }),
      headers,
    );
    expect(resumed).toMatchObject({ ok: true, code: "webhook_handled" });
    expect(fakeDb.licenses.find((l) => l.id === issued.record!.id)?.status).toBe("revoked");
  });

  // wt5f.5: a subscription event that carries NO license key reaches the row
  // through the bound subscription id (findLicenseByProviderSubscription).
  it("wt5f: a key-less subscription event reaches its row via the subscription binding", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const db = fakeDb.db as LicensingD1;
    const env = makeEnv();
    const headers = webhookHeaders();

    fakeProvider.seedLicense(TEST_LICENSE_KEY);
    const first = await validateLicense(env, db, { licenseKey: TEST_LICENSE_KEY });
    expect(first.ok).toBe(true);

    // Bind the subscription namespace with a key-carrying event.
    await processLicenseWebhook(
      env, db, fakeProvider.provider,
      fakeWebhookBody({
        eventName: "subscription_updated", eventId: "sub-bind",
        resourceKind: "subscription", providerResourceId: "sub-kb",
      }),
      headers,
    );
    expect(fakeDb.licenses[0].provider_subscription_id).toBe("sub-kb");

    // Key-less renewal: the row is found by subscription id alone.
    const renewal = Date.now() + 90 * 24 * 60 * 60 * 1000;
    const reached = await processLicenseWebhook(
      env, db, fakeProvider.provider,
      fakeWebhookBody({
        eventName: "subscription_updated", eventId: "sub-kb-2",
        resourceKind: "subscription", providerResourceId: "sub-kb",
        expiresAt: renewal, licenseKey: undefined,
      }),
      headers,
    );
    expect(reached).toMatchObject({ ok: true, code: "webhook_handled" });
    expect(fakeDb.licenses[0].expires_at).toBe(renewal);
  });

  // wt5f.4: the known-row provider refresh is TTL-cached, so global
  // validate fan-out cannot hammer the provider.
  it("wt5f: repeated validates within the TTL hit the provider once", async () => {
    const { fakeDb, fakeProvider } = freshHarness();
    const db = fakeDb.db as LicensingD1;
    const env = makeEnv();

    fakeProvider.seedLicense(TEST_LICENSE_KEY);
    // Call 1: unknown row -> the provider-bind path (deliberately uncached:
    // first-use binding must be fresh).
    await validateLicense(env, db, { licenseKey: TEST_LICENSE_KEY });
    expect(fakeProvider.validateCalls).toHaveLength(1);

    // Call 2: known row -> refresh populates the cache.
    await validateLicense(env, db, { licenseKey: TEST_LICENSE_KEY });
    expect(fakeProvider.validateCalls).toHaveLength(2);

    // Call 3: inside the TTL -> served from the cache.
    await validateLicense(env, db, { licenseKey: TEST_LICENSE_KEY });
    expect(fakeProvider.validateCalls).toHaveLength(2);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 6 * 60 * 1000); // past the 5-minute TTL
    await validateLicense(env, db, { licenseKey: TEST_LICENSE_KEY });
    expect(fakeProvider.validateCalls).toHaveLength(3);
    vi.useRealTimers();
  });
});
