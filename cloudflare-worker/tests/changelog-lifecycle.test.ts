import { afterEach, describe, expect, it, vi } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { DownloadsDurable } from "../src/downloads_do";
import type { Env } from "../src/types";

class MockStorage {
  private map = new Map<string, unknown>();
  private alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }

  async setAlarm(ts: number): Promise<void> {
    this.alarm = ts;
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }
}

class MockState {
  storage = new MockStorage();
  pending: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>) {
    this.pending.push(promise.catch(() => {}));
  }
}

function makeDO() {
  const state = new MockState();
  const env: Env = {
    ORACLE_ENDPOINT: "https://example.com",
    DO_SHARED_SECRET: "secret",
    MAX_BATCH_EVENTS: "10000",
  } as Env;
  const obj = new DownloadsDurable(state as unknown as DurableObjectState, env);
  return { obj, state };
}

async function adminPost(obj: DownloadsDurable, path: string, body: unknown) {
  return obj.fetch(
    new Request(`http://do${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-secret": "secret",
      },
      body: JSON.stringify(body),
    }),
  );
}

async function adminGet(obj: DownloadsDurable, path: string) {
  return obj.fetch(
    new Request(`http://do${path}`, {
      method: "GET",
      headers: {
        "x-admin-secret": "secret",
      },
    }),
  );
}

async function publicGet(obj: DownloadsDurable, path: string) {
  return obj.fetch(
    new Request(`http://do${path}`, {
      method: "GET",
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DO changelog lifecycle", () => {
  it("saves notification rules with server-side normalization and dedupe", async () => {
    const { obj } = makeDO();

    const res = await adminPost(obj, "/admin/changelog/rules", {
      rules: [
        { id: "r1", target: "v1.2.3", priority: "major", effect: "glow" },
        { id: "r2", target: "1.2.3", priority: "minor", effect: "pulse" },
        { id: "r3", target: "all", priority: "normal", effect: "none" },
      ],
    });
    const body = (await res.json()) as { ok?: boolean; config?: { rules?: Array<{ target: string; priority: string; effect: string }> } };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.config?.rules).toBeDefined();
    expect(body.config?.rules?.length).toBe(2);

    const versionRule = body.config?.rules?.find((rule) => rule.target === "1.2.3");
    expect(versionRule?.priority).toBe("minor");
    expect(versionRule?.effect).toBe("pulse");

    const changelogRes = await publicGet(obj, "/changelog");
    const changelogBody = (await changelogRes.json()) as { config?: { rules?: Array<{ target: string }> } };
    expect(changelogBody.config?.rules?.map((r) => r.target)).toContain("1.2.3");
    expect(changelogBody.config?.rules?.map((r) => r.target)).toContain("all");
  });

  it("keeps live changelog unchanged on draft save, then publishes draft to live", async () => {
    const { obj } = makeDO();
    const markdown = [
      "## v9.9.9",
      "### Summary",
      "Draft-only summary.",
      "### Added",
      "- Added draft feature.",
      "### Changed",
      "- Changed draft logic.",
      "### Fixed",
      "- Fixed draft bug.",
    ].join("\n");

    const draftRes = await adminPost(obj, "/admin/changelog/draft", { markdown });
    const draftBody = (await draftRes.json()) as {
      ok?: boolean;
      draft?: { entries?: Array<{ version: string }> };
      live?: { entries?: Array<{ version: string }> };
    };
    expect(draftRes.status).toBe(200);
    expect(draftBody.ok).toBe(true);
    expect(draftBody.draft?.entries?.[0]?.version).toBe("9.9.9");
    expect((draftBody.live?.entries || []).some((entry) => entry.version === "9.9.9")).toBe(false);

    const liveBefore = await publicGet(obj, "/changelog");
    const beforePayload = (await liveBefore.json()) as { entries?: Array<{ version: string }> };
    expect((beforePayload.entries || []).some((entry) => entry.version === "9.9.9")).toBe(false);

    const publishRes = await adminPost(obj, "/admin/changelog/publish", {});
    const publishBody = (await publishRes.json()) as { ok?: boolean };
    expect(publishRes.status).toBe(200);
    expect(publishBody.ok).toBe(true);

    const liveAfter = await publicGet(obj, "/changelog");
    const afterPayload = (await liveAfter.json()) as { entries?: Array<{ version: string }>; meta?: { applyMode?: string } };
    expect((afterPayload.entries || []).some((entry) => entry.version === "9.9.9")).toBe(true);
    expect(afterPayload.meta?.applyMode).toBe("manual");
    expect(liveAfter.headers.get("cache-control")).toBe("no-store, max-age=0, must-revalidate");
  });

  it("syncs from GitHub in auto mode and preserves last-good live data on sync failure", async () => {
    const { obj } = makeDO();
    const firstMarkdown = [
      "## v8.8.8",
      "### Summary",
      "Auto sync release.",
      "### Added",
      "- Added auto sync feature.",
      "### Changed",
      "- Changed auto sync behavior.",
      "### Fixed",
      "- Fixed auto sync issue.",
    ].join("\n");

    const fetchMock = vi.fn(async () =>
      new Response(firstMarkdown, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const modeRes = await adminPost(obj, "/admin/changelog/mode", {
      applyMode: "auto_github",
      autoSyncEnabled: true,
      autoSyncIntervalMinutes: 60,
      markdownSourceUrl: "https://example.com/user-friendly-changelog.md",
    });
    expect(modeRes.status).toBe(200);

    const syncRes = await adminPost(obj, "/admin/changelog/sync-now", {});
    const syncBody = (await syncRes.json()) as { ok?: boolean; updated?: boolean };
    expect(syncRes.status).toBe(200);
    expect(syncBody.ok).toBe(true);
    expect(syncBody.updated).toBe(true);

    const liveAfterSync = await publicGet(obj, "/changelog");
    const syncedPayload = (await liveAfterSync.json()) as { entries?: Array<{ version: string }> };
    expect((syncedPayload.entries || []).some((entry) => entry.version === "8.8.8")).toBe(true);

    fetchMock.mockResolvedValueOnce(new Response("upstream error", { status: 500 }));
    const failedSyncRes = await adminPost(obj, "/admin/changelog/sync-now", {});
    const failedBody = (await failedSyncRes.json()) as { ok?: boolean; error?: string };
    expect(failedSyncRes.status).toBe(400);
    expect(failedBody.ok).toBe(false);
    expect(failedBody.error).toBeTruthy();

    const liveAfterFailure = await publicGet(obj, "/changelog");
    const failurePayload = (await liveAfterFailure.json()) as { entries?: Array<{ version: string }> };
    expect((failurePayload.entries || []).some((entry) => entry.version === "8.8.8")).toBe(true);

    const adminState = await adminGet(obj, "/admin/changelog");
    const adminPayload = (await adminState.json()) as {
      sync?: { lastAutoSyncStatus?: string; lastAutoSyncError?: string | null };
    };
    expect(adminPayload.sync?.lastAutoSyncStatus).toBe("error");
    expect(adminPayload.sync?.lastAutoSyncError).toBeTruthy();
  });

  it("rejects changelog sync responses with oversized markdown bodies", async () => {
    const { obj } = makeDO();
    const tooLargeMarkdown = `## v9.0.0\n### Summary\n${"A".repeat(750_001)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(tooLargeMarkdown, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
      ),
    );

    const modeRes = await adminPost(obj, "/admin/changelog/mode", {
      applyMode: "auto_github",
      autoSyncEnabled: true,
      autoSyncIntervalMinutes: 60,
      markdownSourceUrl: "https://example.com/user-friendly-changelog.md",
    });
    expect(modeRes.status).toBe(200);

    const syncRes = await adminPost(obj, "/admin/changelog/sync-now", {});
    const syncBody = (await syncRes.json()) as { ok?: boolean; error?: string };
    expect(syncRes.status).toBe(400);
    expect(syncBody.ok).toBe(false);
    expect(syncBody.error).toBe("markdown_too_large");
  });

  it("rejects changelog sync responses with unexpected content-type", async () => {
    const { obj } = makeDO();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html>not markdown</html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    );

    const modeRes = await adminPost(obj, "/admin/changelog/mode", {
      applyMode: "auto_github",
      autoSyncEnabled: true,
      autoSyncIntervalMinutes: 60,
      markdownSourceUrl: "https://example.com/user-friendly-changelog.md",
    });
    expect(modeRes.status).toBe(200);

    const syncRes = await adminPost(obj, "/admin/changelog/sync-now", {});
    const syncBody = (await syncRes.json()) as { ok?: boolean; error?: string };
    expect(syncRes.status).toBe(400);
    expect(syncBody.ok).toBe(false);
    expect(syncBody.error).toBe("markdown_content_type_invalid");
  });

  it("public /changelog returns full config with rules, entries, and meta after admin updates", async () => {
    const { obj } = makeDO();

    // 1. Save notification rules
    const rulesRes = await adminPost(obj, "/admin/changelog/rules", {
      rules: [
        { id: "r-global", target: "all", priority: "minor", effect: "glow" },
        { id: "r-specific", target: "v2.0.0", priority: "major", effect: "pulse" },
      ],
    });
    expect(rulesRes.status).toBe(200);

    // 2. Save changelog entries via markdown
    const markdown = [
      "## v2.0.0",
      "### Summary",
      "Major release with new features.",
      "### Added",
      "- Added new dashboard.",
      "### Changed",
      "- Changed notification system.",
      "### Fixed",
      "- Fixed sync issue.",
    ].join("\n");
    const updateRes = await adminPost(obj, "/admin/changelog", { markdown });
    expect(updateRes.status).toBe(200);

    // 3. Fetch public /changelog and verify full response structure
    const publicRes = await publicGet(obj, "/changelog");
    expect(publicRes.status).toBe(200);
    expect(publicRes.headers.get("cache-control")).toBe("no-store, max-age=0, must-revalidate");

    const body = (await publicRes.json()) as {
      ok?: boolean;
      entries?: Array<{ version: string; changes: string[]; summary?: string; added?: string[]; changed?: string[]; fixed?: string[] }>;
      config?: {
        rules?: Array<{ id: string; target: string; priority: string; effect: string }>;
        lastUpdated?: number;
      };
      meta?: {
        liveUpdatedAt?: number;
        applyMode?: string;
      };
    };

    // Verify entries
    expect(body.ok).toBe(true);
    expect(body.entries).toBeDefined();
    expect(body.entries!.length).toBeGreaterThanOrEqual(1);
    const v200 = body.entries!.find((e) => e.version === "2.0.0");
    expect(v200).toBeDefined();
    expect(v200!.summary).toBe("Major release with new features.");
    expect(v200!.added).toContain("Added new dashboard.");
    expect(v200!.changed).toContain("Changed notification system.");
    expect(v200!.fixed).toContain("Fixed sync issue.");

    // Verify config with rules
    expect(body.config).toBeDefined();
    expect(body.config!.rules).toBeDefined();
    expect(body.config!.rules!.length).toBe(2);

    const allRule = body.config!.rules!.find((r) => r.target === "all");
    expect(allRule).toBeDefined();
    expect(allRule!.priority).toBe("minor");
    expect(allRule!.effect).toBe("glow");

    const specificRule = body.config!.rules!.find((r) => r.target === "2.0.0");
    expect(specificRule).toBeDefined();
    expect(specificRule!.priority).toBe("major");
    expect(specificRule!.effect).toBe("pulse");

    // Verify meta
    expect(body.meta).toBeDefined();
    expect(typeof body.meta!.liveUpdatedAt).toBe("number");

    // Verify lastUpdated is present and recent (within last 5 seconds)
    expect(body.config!.lastUpdated).toBeDefined();
    expect(Date.now() - body.config!.lastUpdated!).toBeLessThan(5000);
  });
});
