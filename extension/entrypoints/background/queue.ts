/**
 * Background-side queue wiring (bead 0h4d.1.2). The invariants live in the
 * pure engine (src/queue/queue-engine.ts, properties in
 * tests/queue-engine.test.ts); this module holds the mutable snapshot, the
 * deferred starters, and the pump. Every download start funnels through
 * handleDownloadRequest → queueRequest; settlements re-enter via the
 * registry's onUnregister (cleanup/cancel/TTL all unregister).
 */
import {
  createEmptyQueue,
  enqueue,
  markActive,
  remove,
  selectNext,
  setPaused,
  type QueueSnapshot,
} from '../../src/queue/queue-engine';

export const QUEUE_CONCURRENCY = 3;

let snapshot: QueueSnapshot = createEmptyQueue();
const starters = new Map<string, () => void>();

/** A new download request: queue it and pump (admits immediately if capacity allows). */
export function queueRequest(requestId: string, start: () => void, onQueued?: () => void): void {
  starters.set(requestId, start);
  snapshot = enqueue(snapshot, requestId, Date.now());
  pump();
  // Still waiting after the pump? Tell the origin once (the pill shows it).
  if (onQueued && snapshot.entries.some((e) => e.requestId === requestId)) onQueued();
}

/** A request reached a terminal state (success/fail/cancel/TTL) — free its slot. */
export function queueSettled(requestId: string): void {
  const known =
    starters.has(requestId) ||
    snapshot.activeIds.includes(requestId) ||
    snapshot.entries.some((e) => e.requestId === requestId);
  if (!known) return;
  starters.delete(requestId);
  snapshot = remove(snapshot, requestId);
  pump();
}

/** Restart recovery: a reconciled record was already downloading pre-restart. */
export function queueRecoverActive(requestId: string): void {
  snapshot = markActive(snapshot, requestId);
}

export function setQueuePaused(paused: boolean): void {
  snapshot = setPaused(snapshot, paused);
  pump();
}

export function getQueueSnapshot(): QueueSnapshot {
  return snapshot;
}

export function resetQueueForTests(): void {
  snapshot = createEmptyQueue();
  starters.clear();
}

function pump(): void {
  const { snapshot: next, admitted } = selectNext(snapshot, QUEUE_CONCURRENCY);
  snapshot = next;
  for (const id of admitted) starters.get(id)?.();
}
