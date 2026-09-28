import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createEmptyQueue,
  enqueue,
  markActive,
  remove,
  selectNext,
  setPaused,
  type QueueSnapshot,
} from '../src/queue/queue-engine';

// ============================================================================
// QUEUE ENGINE — scheduler invariants (bead 0h4d.1.2, plan
// docs/superpowers/plans/2026-09-28-queue-engine.md). The scheduler is the
// pure core of the queue: every admission decision is a total function of
// (queue, active, cap, paused). These properties are the queue's contract;
// the background wiring (0h4d.1.2 task 2) must preserve them.
// ============================================================================

const arbId = fc.string({ minLength: 1, maxLength: 12 }).filter((s) => !s.includes(':'));

type Op =
  | { kind: 'enqueue'; id: string; priority: number }
  | { kind: 'remove'; id: string }
  | { kind: 'markActive'; id: string }
  | { kind: 'select' }
  | { kind: 'pause'; value: boolean };

const arbOp = fc.oneof(
  fc.record({ kind: fc.constant('enqueue' as const), id: arbId, priority: fc.integer({ min: 0, max: 3 }) }),
  fc.record({ kind: fc.constant('remove' as const), id: arbId }),
  fc.record({ kind: fc.constant('markActive' as const), id: arbId }),
  fc.record({ kind: fc.constant('select' as const) }),
  fc.record({ kind: fc.constant('pause' as const), value: fc.boolean() }),
);

function applyOp(snap: QueueSnapshot, op: Op): QueueSnapshot {
  switch (op.kind) {
    case 'enqueue':
      return enqueue(snap, op.id, 0, op.priority);
    case 'remove':
      return remove(snap, op.id);
    case 'markActive':
      return markActive(snap, op.id);
    case 'select':
      return selectNext(snap, 3).snapshot;
    case 'pause':
      return setPaused(snap, op.value);
  }
}

describe('queue engine — scheduler invariants (0h4d.1.2)', () => {
  it('P-Q1: selectNext never admits more than the remaining capacity', () => {
    fc.assert(
      fc.property(
        fc.array(arbOp, { maxLength: 60 }),
        fc.integer({ min: 1, max: 6 }),
        (ops, cap) => {
          let snap = createEmptyQueue();
          for (const op of ops) {
            if (op.kind === 'select') {
              // Admission is bounded by the capacity LEFT by the active set.
              // (markActive may exceed cap legitimately: restarted in-progress
              // records from reconcile are already running — the cap governs
              // new admissions, never cancels running work.)
              const remaining = Math.max(0, cap - snap.activeIds.length);
              const { snapshot, admitted } = selectNext(snap, cap);
              expect(admitted.length).toBeLessThanOrEqual(remaining);
              expect(snapshot.activeIds.length).toBeLessThanOrEqual(
                snap.activeIds.length + remaining,
              );
              snap = snapshot;
            } else {
              snap = applyOp(snap, op);
            }
          }
        },
      ),
    );
  });

  it('P-Q2: admissions follow priority then FIFO (queuedAt) order', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: arbId, priority: fc.integer({ min: 0, max: 2 }) }), {
          minLength: 1,
          maxLength: 12,
        }),
        (items) => {
          const unique = [...new Map(items.map((i) => [i.id, i])).values()];
          let snap = createEmptyQueue();
          unique.forEach((item, idx) => {
            snap = enqueue(snap, item.id, idx, item.priority);
          });
          const { snapshot, admitted } = selectNext(snap, unique.length);
          expect(snapshot.paused).toBe(false);
          expect(admitted).toEqual(
            [...unique]
              .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
              .map((i) => i.id),
          );
        },
      ),
    );
  });

  it('P-Q3: paused freezes admissions; resuming admits nothing until select is called', () => {
    fc.assert(
      fc.property(fc.array(arbId, { minLength: 1, maxLength: 8 }), (ids) => {
        let snap = createEmptyQueue();
        ids.forEach((id) => {
          snap = enqueue(snap, id, 0);
        });
        snap = setPaused(snap, true);
        const pausedResult = selectNext(snap, 10);
        expect(pausedResult.admitted).toEqual([]);
        expect(pausedResult.snapshot.activeIds).toEqual([]);
        const resumed = selectNext(setPaused(pausedResult.snapshot, false), 10);
        expect(resumed.admitted.length).toBe(ids.length);
      }),
    );
  });

  it('P-Q4: a removed id is never admitted afterwards', () => {
    fc.assert(
      fc.property(
        fc.array(arbOp, { maxLength: 50 }),
        arbId,
        (ops, doomed) => {
          let snap = createEmptyQueue();
          snap = enqueue(snap, doomed, 0);
          for (const op of ops) {
            if (op.kind === 'remove' && op.id === doomed) continue;
            snap = applyOp(snap, op);
          }
          snap = remove(snap, doomed);
          const { snapshot } = selectNext(snap, 10);
          expect(snapshot.activeIds).not.toContain(doomed);
          expect(snapshot.entries.some((e) => e.requestId === doomed)).toBe(false);
        },
      ),
    );
  });

  it('P-Q5: enqueueing the same requestId twice yields one entry (idempotent)', () => {
    fc.assert(
      fc.property(arbId, fc.array(arbId, { maxLength: 6 }), (dup, others) => {
        let snap = createEmptyQueue();
        others.forEach((id, idx) => {
          snap = enqueue(snap, id, idx);
        });
        snap = enqueue(snap, dup, 100);
        snap = enqueue(snap, dup, 200);
        const matching = snap.entries.filter((e) => e.requestId === dup);
        expect(matching.length).toBe(1);
      }),
    );
  });

  it('P-Q6: select is idempotent — a second select with no settlements admits nothing new', () => {
    fc.assert(
      fc.property(fc.array(arbId, { minLength: 1, maxLength: 8 }), (ids) => {
        let snap = createEmptyQueue();
        ids.forEach((id, idx) => {
          snap = enqueue(snap, id, idx);
        });
        const first = selectNext(snap, 3);
        const second = selectNext(first.snapshot, 3);
        expect(second.admitted).toEqual([]);
        expect(second.snapshot.activeIds).toEqual(first.snapshot.activeIds);
      }),
    );
  });
});
