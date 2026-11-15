import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FLASH_MS,
  SPIN_FRAME_COUNT,
  createIconStateMachine,
  type IconRender,
} from '../src/icon/icon-state-machine';

/**
 * Deterministic timer harness. The machine takes injected timers, so tests
 * never depend on vitest fake-timer globals.
 */
function createFakeTimers() {
  type Job = { id: number; fn: () => void; everyMs: number | null; nextAt: number };
  let seq = 0;
  let now = 0;
  const jobs: Job[] = [];
  const remove = (id: number) => {
    const i = jobs.findIndex((j) => j.id === id);
    if (i >= 0) jobs.splice(i, 1);
  };
  return {
    now: () => now,
    pendingCount: () => jobs.length,
    setInterval(fn: () => void, ms: number): number {
      const id = ++seq;
      jobs.push({ id, fn, everyMs: ms, nextAt: now + ms });
      return id;
    },
    clearInterval(id: number): void {
      remove(id);
    },
    setTimeout(fn: () => void, ms: number): number {
      const id = ++seq;
      jobs.push({ id, fn, everyMs: null, nextAt: now + ms });
      return id;
    },
    clearTimeout(id: number): void {
      remove(id);
    },
    advance(durationMs: number): void {
      const end = now + durationMs;
      for (;;) {
        const due = jobs
          .filter((j) => j.nextAt <= end)
          .sort((a, b) => a.nextAt - b.nextAt || a.id - b.id)[0];
        if (!due) break;
        now = due.nextAt;
        if (due.everyMs === null) jobs.splice(jobs.indexOf(due), 1);
        else due.nextAt = now + due.everyMs;
        due.fn();
      }
      now = end;
    },
  };
}

type Harness = ReturnType<typeof createFakeTimers>;

function createMachine(timers: Harness, onChange: (r: IconRender) => void = () => {}) {
  const machine = createIconStateMachine({
    timers,
    onChange,
    flashMs: DEFAULT_FLASH_MS,
  });
  return machine;
}

describe('icon state machine', () => {
  it('starts idle with no timers live', () => {
    const timers = createFakeTimers();
    const m = createMachine(timers);
    expect(m.getState()).toMatchObject({ phase: 'idle', frameIndex: 0, enabled: true });
    expect(m.activeTimerCount()).toBe(0);
  });

  it('goes active on the first download and advances spinner frames on ticks', () => {
    const timers = createFakeTimers();
    const renders: IconRender[] = [];
    const m = createMachine(timers, (r) => renders.push(r));
    m.setActiveCount(1);
    expect(m.getState().phase).toBe('active');
    expect(m.getState().frameIndex).toBe(0);
    expect(m.activeTimerCount()).toBe(1);

    timers.advance(350); // 3 ticks at 100ms
    expect(m.getState().frameIndex).toBe(3);
    expect(renders.filter((r) => r.phase === 'active').length).toBeGreaterThanOrEqual(3);
  });

  it('wraps spinner frames modulo the frame count', () => {
    const timers = createFakeTimers();
    const m = createMachine(timers);
    m.setActiveCount(2);
    timers.advance(100 * SPIN_FRAME_COUNT);
    expect(m.getState().frameIndex).toBe(0);
  });

  it('keeps spinning (no restart, no flag reset) when the queue grows', () => {
    const timers = createFakeTimers();
    const m = createMachine(timers);
    m.setActiveCount(1);
    timers.advance(250);
    m.notifySettled('success');
    m.setActiveCount(3);
    expect(m.getState().frameIndex).toBe(2); // spin not restarted
    timers.advance(DEFAULT_FLASH_MS + 1); // stale flash timer must not exist
    expect(m.getState().phase).toBe('active');
  });

  it('shows the success flash when the queue drains with successes only', () => {
    const timers = createFakeTimers();
    const renders: IconRender[] = [];
    const m = createMachine(timers, (r) => renders.push(r));
    m.setActiveCount(1);
    m.notifySettled('success');
    m.setActiveCount(0);
    expect(m.getState().phase).toBe('success-flash');
    expect(m.activeTimerCount()).toBe(1);

    timers.advance(DEFAULT_FLASH_MS - 1);
    expect(m.getState().phase).toBe('success-flash');
    timers.advance(1);
    expect(m.getState().phase).toBe('idle');
    expect(m.activeTimerCount()).toBe(0);
  });

  it('shows the error flash when any item failed in the batch', () => {
    const timers = createFakeTimers();
    const m = createMachine(timers);
    m.setActiveCount(2);
    m.notifySettled('success');
    m.notifySettled('fail');
    m.setActiveCount(0);
    expect(m.getState().phase).toBe('error-flash');
    timers.advance(DEFAULT_FLASH_MS);
    expect(m.getState().phase).toBe('idle');
    expect(m.activeTimerCount()).toBe(0);
  });

  it('skips the flash for a batch with only cancellations', () => {
    const timers = createFakeTimers();
    const m = createMachine(timers);
    m.setActiveCount(1);
    m.setActiveCount(0);
    expect(m.getState().phase).toBe('idle');
    expect(m.activeTimerCount()).toBe(0);
  });

  it('a new batch during a flash preempts it and clears the flash timer', () => {
    const timers = createFakeTimers();
    const m = createMachine(timers);
    m.setActiveCount(1);
    m.notifySettled('fail');
    m.setActiveCount(0);
    expect(m.getState().phase).toBe('error-flash');

    m.setActiveCount(1);
    expect(m.getState().phase).toBe('active');
    expect(m.getState().frameIndex).toBe(0);
    expect(m.activeTimerCount()).toBe(1); // only the spinner interval
    timers.advance(DEFAULT_FLASH_MS + 1); // old flash expiry must be inert
    expect(m.getState().phase).toBe('active');
  });

  it('disable stops everything and re-enable follows the queue state', () => {
    const timers = createFakeTimers();
    const renders: IconRender[] = [];
    const m = createMachine(timers, (r) => renders.push(r));
    m.setActiveCount(1);
    m.setEnabled(false);
    expect(m.getState().phase).toBe('disabled');
    expect(m.activeTimerCount()).toBe(0);
    const framesBefore = m.getState().frameIndex;
    timers.advance(500);
    expect(m.getState().frameIndex).toBe(framesBefore); // frozen

    m.setEnabled(true);
    expect(m.getState().phase).toBe('active'); // queue still busy → spinner resumes
    m.setActiveCount(0);
    expect(m.getState().phase).toBe('idle');
  });

  it('ignores settle notifications arriving while idle', () => {
    const timers = createFakeTimers();
    const m = createMachine(timers);
    m.notifySettled('fail');
    m.setActiveCount(1);
    m.setActiveCount(0);
    expect(m.getState().phase).toBe('idle'); // flags reset on batch start
  });

  it('never emits twice for the same render', () => {
    const timers = createFakeTimers();
    const renders: IconRender[] = [];
    const m = createMachine(timers, (r) => renders.push(r));
    m.setActiveCount(1);
    m.setActiveCount(1);
    const before = renders.length;
    m.setEnabled(true); // no-op enable
    expect(renders.length).toBe(before);
    expect(renders.filter((r, i) => i > 0 && r.phase === renders[i - 1].phase && r.frameIndex === renders[i - 1].frameIndex).length).toBe(0);
  });

  it('dispose leaves zero live timers', () => {
    const timers = createFakeTimers();
    const m = createMachine(timers);
    m.setActiveCount(1);
    m.dispose();
    expect(m.activeTimerCount()).toBe(0);
  });
});
