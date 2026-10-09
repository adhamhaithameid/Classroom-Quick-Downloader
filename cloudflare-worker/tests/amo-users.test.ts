import { describe, expect, it, vi } from "vitest";
import {
  parseAmoUsersCache,
  readAmoUsersCache,
  refreshAmoUsersKv,
  AMO_USERS_KV_KEY,
} from "../src/store-stats";

function memoryKv(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

function amoResponse(users: number): Response {
  return new Response(JSON.stringify({ average_daily_users: users }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("AMO users KV cache (24h TTL, one upstream call per day)", () => {
  it("fetches once and serves later refreshes from KV within 24h", async () => {
    const kv = memoryKv();
    const fetchImpl = vi.fn(async () => amoResponse(4321));

    await refreshAmoUsersKv({ SITE_SNAPSHOT_KV: kv }, { now: 1_000_000, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("addons.mozilla.org");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("classroom-quick-downloader");

    // Same day: hourly cron ticks hit the TTL gate, never the network.
    await refreshAmoUsersKv({ SITE_SNAPSHOT_KV: kv }, { now: 1_000_000 + 3 * 3_600_000, fetchImpl: fetchImpl as unknown as typeof fetch });
    await refreshAmoUsersKv({ SITE_SNAPSHOT_KV: kv }, { now: 1_000_000 + 23 * 3_600_000, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const cached = await readAmoUsersCache({ SITE_SNAPSHOT_KV: kv });
    expect(cached).toEqual({ firefoxUsers: 4321, fetchedAtUtc: 1_000_000 });

    // After the TTL lapses: exactly one more upstream call.
    await refreshAmoUsersKv({ SITE_SNAPSHOT_KV: kv }, { now: 1_000_000 + 25 * 3_600_000, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const refreshed = await readAmoUsersCache({ SITE_SNAPSHOT_KV: kv });
    expect(refreshed?.firefoxUsers).toBe(4321);
    expect(refreshed?.fetchedAtUtc).toBe(1_000_000 + 25 * 3_600_000);
  });

  it("keeps the previous cache when upstream fails or returns junk", async () => {
    const kv = memoryKv();
    kv.store.set(AMO_USERS_KV_KEY, JSON.stringify({ firefoxUsers: 100, fetchedAtUtc: 0 }));

    const failing = vi.fn(async () => new Response("down", { status: 503 }));
    await refreshAmoUsersKv({ SITE_SNAPSHOT_KV: kv }, { now: 10 * 24 * 3_600_000, fetchImpl: failing as unknown as typeof fetch });
    expect(await readAmoUsersCache({ SITE_SNAPSHOT_KV: kv })).toEqual({ firefoxUsers: 100, fetchedAtUtc: 0 });

    const throwing = vi.fn(async () => {
      throw new Error("network down");
    });
    await refreshAmoUsersKv({ SITE_SNAPSHOT_KV: kv }, { now: 10 * 24 * 3_600_000, fetchImpl: throwing as unknown as typeof fetch });
    expect(await readAmoUsersCache({ SITE_SNAPSHOT_KV: kv })).toEqual({ firefoxUsers: 100, fetchedAtUtc: 0 });
  });

  it("reads safely with no KV binding or malformed payloads", async () => {
    expect(await readAmoUsersCache({})).toBeNull();
    expect(parseAmoUsersCache(null)).toBeNull();
    expect(parseAmoUsersCache("junk{")).toBeNull();
    expect(parseAmoUsersCache('{"firefoxUsers":"nope","fetchedAtUtc":1}')).toBeNull();
  });
});
