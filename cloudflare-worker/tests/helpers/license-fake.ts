/**
 * Licensing test support: synthetic credentials (dummy-secrets.ts style),
 * an in-memory D1 fake for the licensing schema, and a LicenseProvider
 * test fake that drives the same service code path as the real vendor.
 *
 * No value here is a real credential; all are derived placeholders that
 * only exist inside worker test envs.
 */

import type { LicenseProvider, ProviderWebhookEvent } from "../../src/licensing/provider";
import type { LicensingD1, LicensingD1PreparedStatement } from "../../src/licensing/service";

const join = (...parts: string[]) => parts.join("-");

export const TEST_LICENSE_KEY = join("cqd", "pro", "license", "0123456789abcdef");
export const TEST_LICENSE_KEY_SECOND = join("cqd", "pro", "license", "fedcba9876543210");
export const TEST_INSTALL_ID = join("install", "abcdef1234567890");
export const TEST_ENTITLEMENT_SIGNING_KEY = join("entitlement", "signing", "secret");
export const TEST_LICENSE_WEBHOOK_SECRET = join("license", "webhook", "secret");
export const TEST_LICENSE_PLAN = "pro";

// ---------------------------------------------------------------------------
// In-memory D1 fake (structural: satisfies the service's LicensingD1)
// ---------------------------------------------------------------------------

interface FakeRow {
  [column: string]: unknown;
}

function paramValue(params: unknown[], token: string): unknown {
  const match = token.match(/^\?(\d+)$/);
  if (match) {
    const idx = Number(match[1]) - 1;
    return params[idx];
  }
  // Plain literals (COUNT(*)) carry no binding.
  return token;
}

export interface FakeLicenseD1 {
  db: LicensingD1;
  licenses: FakeRow[];
  activations: FakeRow[];
  licenseEvents: FakeRow[];
  schemaStatements: string[];
}

export function makeLicenseFakeD1(): FakeLicenseD1 {
  const licenses: FakeRow[] = [];
  const activations: FakeRow[] = [];
  const licenseEvents: FakeRow[] = [];
  const schemaStatements: string[] = [];

  function execute(sql: string, params: unknown[]): { success: boolean; meta?: { changes: number } } {
    const q = sql.replace(/\s+/g, " ").trim();

    if (/^CREATE TABLE/i.test(q) || /^CREATE INDEX/i.test(q)) {
      schemaStatements.push(q);
      return { success: true, meta: { changes: 0 } };
    }

    if (/^INSERT INTO licenses/i.test(q)) {
      const keyHash = paramValue(params, "?2") as string;
      const exists = licenses.some((row) => row.key_hash === keyHash);
      if (exists) return { success: true, meta: { changes: 0 } };
      licenses.push({
        id: paramValue(params, "?1") as string,
        key_hash: keyHash,
        status: "active",
        provider: paramValue(params, "?3") as string,
        provider_resource_id: paramValue(params, "?4") as string | null,
        plan: paramValue(params, "?5") as string,
        issued_at: paramValue(params, "?6") as number,
        expires_at: paramValue(params, "?7") as number | null,
        revoked_at: null,
        created_at: paramValue(params, "?6") as number,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (/^INSERT INTO activations/i.test(q)) {
      const licenseId = paramValue(params, "?1") as string;
      const installId = paramValue(params, "?2") as string;
      const now = paramValue(params, "?3") as number;
      const existing = activations.find(
        (row) => row.license_id === licenseId && row.install_id === installId,
      );
      if (existing) return { success: true, meta: { changes: 0 } };
      activations.push({ license_id: licenseId, install_id: installId, created_at: now, last_seen_at: now });
      return { success: true, meta: { changes: 1 } };
    }

    if (/^INSERT INTO license_events/i.test(q)) {
      const digest = paramValue(params, "?3") as string;
      const exists = licenseEvents.some((row) => row.payload_digest === digest);
      if (exists) return { success: true, meta: { changes: 0 } };
      licenseEvents.push({
        license_id: paramValue(params, "?1") as string | null,
        type: paramValue(params, "?2") as string,
        payload_digest: digest,
        created_at: paramValue(params, "?4") as number,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (/^UPDATE licenses SET status/i.test(q)) {
      const status = paramValue(params, "?1") as string;
      const revokedAt = paramValue(params, "?2") as number | null;
      const id = paramValue(params, "?3") as string;
      const row = licenses.find((r) => r.id === id);
      if (!row) return { success: true, meta: { changes: 0 } };
      row.status = status;
      row.revoked_at = revokedAt;
      return { success: true, meta: { changes: 1 } };
    }

    if (/^UPDATE licenses SET expires_at/i.test(q)) {
      const expiresAt = paramValue(params, "?1") as number | null;
      const id = paramValue(params, "?2") as string;
      const row = licenses.find((r) => r.id === id);
      if (!row) return { success: true, meta: { changes: 0 } };
      row.expires_at = expiresAt;
      return { success: true, meta: { changes: 1 } };
    }

    if (/^UPDATE activations SET last_seen_at/i.test(q)) {
      const lastSeen = paramValue(params, "?1") as number;
      const licenseId = paramValue(params, "?2") as string;
      const installId = paramValue(params, "?3") as string;
      const row = activations.find(
        (r) => r.license_id === licenseId && r.install_id === installId,
      );
      if (!row) return { success: true, meta: { changes: 0 } };
      row.last_seen_at = lastSeen;
      return { success: true, meta: { changes: 1 } };
    }

    // Unknown statement: fail loudly so test authors notice drift.
    throw new Error(`fake-d1: unsupported statement: ${q.slice(0, 120)}`);
  }

  function selectAll(sql: string, params: unknown[]): FakeRow[] {
    const q = sql.replace(/\s+/g, " ").trim().toLowerCase();

    if (q.includes("from licenses where key_hash")) {
      const keyHash = paramValue(params, "?1") as string;
      return licenses.filter((row) => row.key_hash === keyHash);
    }
    if (q.includes("from licenses where id")) {
      const id = paramValue(params, "?1") as string;
      return licenses.filter((row) => row.id === id);
    }
    if (q.includes("from licenses order by issued_at desc")) {
      const statusFilter = q.includes("where status")
        ? (paramValue(params, "?1") as string)
        : null;
      const limit = q.includes("where status")
        ? (paramValue(params, "?2") as number)
        : (paramValue(params, "?1") as number);
      const filtered = statusFilter
        ? licenses.filter((row) => row.status === statusFilter)
        : licenses.slice();
      return filtered
        .slice()
        .sort((a, b) => (b.issued_at as number) - (a.issued_at as number))
        .slice(0, limit as number);
    }
    if (q.includes("from licenses") && q.includes("provider_resource_id")) {
      const resourceId = paramValue(params, "?1") as string;
      const provider = paramValue(params, "?2") as string;
      return licenses.filter(
        (row) => row.provider_resource_id === resourceId && row.provider === provider,
      );
    }
    if (q.includes("from activations where license_id") && q.includes("install_id")) {
      const licenseId = paramValue(params, "?1") as string;
      const installId = paramValue(params, "?2") as string;
      return activations.filter(
        (row) => row.license_id === licenseId && row.install_id === installId,
      );
    }
    if (q.includes("count(*) as n from activations")) {
      const licenseId = paramValue(params, "?1") as string;
      return [{ n: activations.filter((row) => row.license_id === licenseId).length }];
    }
    throw new Error(`fake-d1: unsupported select: ${q.slice(0, 120)}`);
  }

  function prepare(sql: string) {
    const statement: LicensingD1PreparedStatement = {
      bind(...args: unknown[]) {
        return {
          run: async () => execute(sql, args),
          first: async <T>() => {
            const rows = selectAll(sql, args);
            return (rows[0] as T) ?? null;
          },
          all: async <T>() => {
            const rows = selectAll(sql, args);
            return { success: true, results: rows as T[] };
          },
        };
      },
      run: async () => execute(sql, []),
      first: async <T>() => {
        const rows = selectAll(sql, []);
        return (rows[0] as T) ?? null;
      },
      all: async <T>() => {
        const rows = selectAll(sql, []);
        return { success: true, results: rows as T[] };
      },
    };
    return statement;
  }

  const db: LicensingD1 = {
    prepare,
    batch: async (statements: unknown[]) => {
      for (const statement of statements) {
        const bound = statement as { run?: () => Promise<unknown>; sql?: string };
        if (typeof bound.run === "function") {
          await bound.run();
        }
      }
      return [];
    },
  };

  return { db, licenses, activations, licenseEvents, schemaStatements };
}

// ---------------------------------------------------------------------------
// LicenseProvider test fake (drives the same service code path)
// ---------------------------------------------------------------------------

export interface FakeProviderLicenseState {
  status: "active" | "revoked" | "refunded" | "expired";
  plan: string;
  providerResourceId: string;
  expiresAt: number | null;
}

export interface FakeLicenseProviderHarness {
  provider: LicenseProvider;
  seedLicense(licenseKey: string, overrides?: Partial<FakeProviderLicenseState>): void;
  webhookEvents: ProviderWebhookEvent[];
  issuedPlans: string[];
  validateCalls: string[];
}

/**
 * In-memory provider fake. Signatures are deliberately trivial: webhook
 * signature cryptography is covered separately against the real Lemon
 * Squeezy verifier; this fake exists to prove the service is
 * provider-agnostic.
 */
export function createFakeLicenseProvider(): FakeLicenseProviderHarness {
  const licenses = new Map<string, FakeProviderLicenseState>();
  const webhookEvents: ProviderWebhookEvent[] = [];
  const issuedPlans: string[] = [];
  const validateCalls: string[] = [];

  const provider: LicenseProvider = {
    name: "fake",

    async issue({ plan }) {
      issuedPlans.push(plan);
      return { ok: true, providerResourceId: `fake-resource-${issuedPlans.length}` };
    },

    async validate(licenseKey) {
      validateCalls.push(licenseKey);
      const state = licenses.get(licenseKey.trim());
      if (!state) {
        return { ok: false, error: "license_not_found", status: "unknown" };
      }
      return {
        ok: state.status === "active",
        error: state.status === "active" ? undefined : "license_invalid",
        status: state.status,
        plan: state.plan,
        providerResourceId: state.providerResourceId,
        expiresAt: state.expiresAt,
      };
    },

    async revoke(providerResourceId) {
      for (const [key, state] of licenses.entries()) {
        if (state.providerResourceId === providerResourceId) {
          licenses.set(key, { ...state, status: "revoked" });
        }
      }
      return { ok: true };
    },

    async verifyWebhook(rawBody, headers) {
      if (headers.get("X-Test-Signature") !== "valid") return null;
      try {
        const parsed = JSON.parse(rawBody) as ProviderWebhookEvent;
        webhookEvents.push(parsed);
        return parsed;
      } catch {
        return null;
      }
    },
  };

  return {
    provider,
    seedLicense: (licenseKey, overrides = {}) => {
      licenses.set(licenseKey.trim(), {
        status: "active",
        plan: TEST_LICENSE_PLAN,
        providerResourceId: `fake-resource-${licenses.size + 1}`,
        expiresAt: null,
        ...overrides,
      });
    },
    webhookEvents,
    issuedPlans,
    validateCalls,
  };
}
