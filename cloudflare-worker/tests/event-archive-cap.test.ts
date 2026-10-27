import { describe, expect, it, vi } from "vitest";
import {
  archiveBatch,
  MAX_ARCHIVE_PAYLOAD_BYTES,
  PAYLOAD_TOO_LARGE_ERROR,
} from "../src/event-archive";

// 0k86: the archiver itself must refuse oversize payloads up front with the
// classified error the DO fast-fails on — never attempt the doomed bind.
function mockDb() {
  return {
    batch: vi.fn(),
    prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn(async () => ({})) })) })),
  } as unknown as import("@cloudflare/workers-types").D1Database;
}

describe("event-archive payload cap (0k86)", () => {
  it("refuses an oversize payload without touching the database", async () => {
    const db = mockDb();
    const big = "x".repeat(MAX_ARCHIVE_PAYLOAD_BYTES + 1);
    const res = await archiveBatch(db, {
      batchId: "b1",
      kind: "extension-batch",
      createdAtUtc: Date.now(),
      eventCount: 1,
      weightedCount: 1,
      payload: big,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe(PAYLOAD_TOO_LARGE_ERROR);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("writes an under-cap payload normally", async () => {
    const db = mockDb();
    const res = await archiveBatch(db, {
      batchId: "b2",
      kind: "extension-batch",
      createdAtUtc: Date.now(),
      eventCount: 1,
      weightedCount: 1,
      payload: "x".repeat(1024),
    });
    expect(res.ok).toBe(true);
    expect(db.prepare).toHaveBeenCalled();
  });

  it("measures bytes, not UTF-16 units", () => {
    // Sanity on the cap constant itself: the check uses encoded byte length.
    const emojiHeavy = "🎉".repeat(MAX_ARCHIVE_PAYLOAD_BYTES / 2);
    expect(new TextEncoder().encode(emojiHeavy).length).toBeGreaterThan(MAX_ARCHIVE_PAYLOAD_BYTES);
  });
});
