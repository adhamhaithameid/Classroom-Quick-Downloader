/**
 * ============================================================================
 * QUEUE ENGINE — the pure scheduler at the heart of the download queue
 * (bead 0h4d.1.2, plan docs/superpowers/plans/2026-09-28-queue-engine.md)
 * ============================================================================
 *
 * No chrome APIs, no timers: every admission decision is a total function of
 * (queue, active, cap, paused), so the fast-check properties in
 * tests/queue-engine.test.ts are the contract. The background wiring
 * (handleDownloadRequest gating + settlement hooks) must preserve them —
 * the same discipline as src/core/acquire/state-machine.ts.
 *
 * `priority` is reserved for Pro reordering (0h4d.3.5); free is FIFO with
 * equal priorities. `queuedAt` is the FIFO tie-break clock.
 */

export interface QueueEntry {
  requestId: string;
  queuedAt: number;
  priority?: number;
}

export interface QueueSnapshot {
  /** Queued requests in insertion order; selection re-sorts. */
  entries: QueueEntry[];
  /** Requests currently downloading (admitted, not yet settled). */
  activeIds: string[];
  paused: boolean;
}

export function createEmptyQueue(): QueueSnapshot {
  return { entries: [], activeIds: [], paused: false };
}

/** Idempotent: a requestId occupies at most one queue slot (P-Q5). */
export function enqueue(
  snap: QueueSnapshot,
  requestId: string,
  queuedAt: number,
  priority?: number,
): QueueSnapshot {
  if (snap.entries.some((e) => e.requestId === requestId)) return snap;
  if (snap.activeIds.includes(requestId)) return snap;
  const entry: QueueEntry = { requestId, queuedAt, ...(priority !== undefined ? { priority } : {}) };
  return { ...snap, entries: [...snap.entries, entry] };
}

/** Cancel/terminal: the id vanishes from both the waiting list and active (P-Q4). */
export function remove(snap: QueueSnapshot, requestId: string): QueueSnapshot {
  const entries = snap.entries.filter((e) => e.requestId !== requestId);
  const activeIds = snap.activeIds.filter((id) => id !== requestId);
  if (entries.length === snap.entries.length && activeIds.length === snap.activeIds.length) {
    return snap;
  }
  return { ...snap, entries, activeIds };
}

/** The wiring calls this when an admitted request actually starts downloading. */
export function markActive(snap: QueueSnapshot, requestId: string): QueueSnapshot {
  if (snap.activeIds.includes(requestId)) return snap;
  const entries = snap.entries.filter((e) => e.requestId !== requestId);
  return { ...snap, entries, activeIds: [...snap.activeIds, requestId] };
}

export function setPaused(snap: QueueSnapshot, paused: boolean): QueueSnapshot {
  if (snap.paused === paused) return snap;
  return { ...snap, paused };
}

/**
 * Admit waiting requests while capacity allows. Selection order: priority
 * ascending (undefined = 0), then queuedAt ascending (FIFO). Idempotent while
 * nothing settles — a second select with the same snapshot admits nothing
 * new (P-Q6). Paused queues admit nothing (P-Q3).
 */
export function selectNext(
  snap: QueueSnapshot,
  cap: number,
): { snapshot: QueueSnapshot; admitted: string[] } {
  if (snap.paused) return { snapshot: snap, admitted: [] };
  const capacity = cap - snap.activeIds.length;
  if (capacity <= 0 || snap.entries.length === 0) return { snapshot: snap, admitted: [] };

  const sorted = [...snap.entries].sort((a, b) => {
    const pa = a.priority ?? 0;
    const pb = b.priority ?? 0;
    if (pa !== pb) return pa - pb;
    return a.queuedAt - b.queuedAt;
  });
  const admitted = sorted.slice(0, capacity).map((e) => e.requestId);
  const admittedSet = new Set(admitted);
  return {
    snapshot: {
      ...snap,
      entries: snap.entries.filter((e) => !admittedSet.has(e.requestId)),
      activeIds: [...snap.activeIds, ...admitted],
    },
    admitted,
  };
}
