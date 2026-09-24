/**
 * D1 event archive: the Cloudflare-side replacement for the Oracle backend's
 * analytics storage. Flushed batches (extension analytics + website events)
 * are persisted here with the same batch identity the delivery pipeline
 * already tracks, so archiving is auditable and replayable without any
 * external dependency.
 */

export type EventArchiveKind = "extension-batch" | "website-events";

export interface ArchiveWriteResult {
  ok: boolean;
  error?: string;
}

export interface ArchiveStats {
  totalBatches: number;
  lastArchivedAtUtc: number | null;
}

const ARCHIVE_TABLE = "event_archive";

let schemaReady = false;

/**
 * Create the archive table if needed. Best-effort idempotent; failures are
 * returned so the caller can run its existing retry/dead-letter path.
 */
export async function ensureArchiveSchema(db: D1Database): Promise<ArchiveWriteResult> {
  if (schemaReady) return { ok: true };
  try {
    await db.batch([
      db.prepare(
        `CREATE TABLE IF NOT EXISTS ${ARCHIVE_TABLE} (
          batch_id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          created_at_utc INTEGER NOT NULL,
          event_count INTEGER NOT NULL DEFAULT 0,
          weighted_count INTEGER NOT NULL DEFAULT 0,
          payload TEXT NOT NULL,
          archived_at_utc INTEGER NOT NULL
        )`,
      ),
      db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_event_archive_kind_time
         ON ${ARCHIVE_TABLE} (kind, created_at_utc)`,
      ),
    ]);
    schemaReady = true;
    return { ok: true };
  } catch (error) {
    return { ok: false, error: trimError("archive_schema_failed", error) };
  }
}

export interface ArchiveBatchInput {
  batchId: string;
  kind: EventArchiveKind;
  createdAtUtc: number;
  eventCount: number;
  weightedCount: number;
  payload: string;
}

/**
 * Persist one flushed batch. The payload is the same aggregated envelope the
 * delivery pipeline already built (no raw events), so rows stay small.
 */
export async function archiveBatch(db: D1Database, input: ArchiveBatchInput): Promise<ArchiveWriteResult> {
  const schema = await ensureArchiveSchema(db);
  if (!schema.ok) return schema;

  try {
    await db
      .prepare(
        `INSERT INTO ${ARCHIVE_TABLE}
           (batch_id, kind, created_at_utc, event_count, weighted_count, payload, archived_at_utc)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (batch_id) DO NOTHING`,
      )
      .bind(
        input.batchId,
        input.kind,
        clampUtc(input.createdAtUtc),
        clampCount(input.eventCount),
        clampCount(input.weightedCount),
        input.payload,
        Date.now(),
      )
      .run();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: trimError("archive_write_failed", error) };
  }
}

/** Aggregate counters for admin consoles, best-effort only. */
export async function readArchiveStats(db: D1Database): Promise<ArchiveStats | null> {
  try {
    const result = await db
      .prepare(
        `SELECT COUNT(*) AS total_batches, MAX(archived_at_utc) AS last_archived_at_utc
         FROM ${ARCHIVE_TABLE}`,
      )
      .first<{ total_batches?: number; last_archived_at_utc?: number }>();
    return {
      totalBatches: typeof result?.total_batches === "number" ? result.total_batches : 0,
      lastArchivedAtUtc: typeof result?.last_archived_at_utc === "number" ? result.last_archived_at_utc : null,
    };
  } catch {
    return null;
  }
}

function clampUtc(value: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : Date.now();
}

function clampCount(value: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function trimError(prefix: string, error: unknown): string {
  const detail = String(error).slice(0, 200);
  return `${prefix}: ${detail}`;
}
