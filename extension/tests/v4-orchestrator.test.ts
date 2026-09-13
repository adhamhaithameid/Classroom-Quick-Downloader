// extension/tests/v4-orchestrator.test.ts
import { describe, it, expect, vi } from 'vitest';

// Isolate the orchestrator singleton per test (established repo idiom).
vi.mock('../../src/engines/engine-registry', () => ({
  engineRegistry: {
    getActiveEngines: vi.fn(() => []),
    getEngine: vi.fn(() => null),
    getMode: vi.fn(() => 'legacy'),
    setModeChangeCallback: vi.fn(),
    getSummary: vi.fn(() => ''),
  },
}));
vi.mock('../../src/v2/context/route-classifier', () => ({
  RouteWatcher: class { start() {} stop() {} },
  isClassroomUrl: vi.fn((url: string) => url.includes('classroom.google.com')),
}));
vi.mock('../../src/v2/compat/shadow-compare', () => ({ ShadowComparator: class {} }));

import { Orchestrator } from '../src/v2/orchestrator/orchestrator';
import { ViewKind } from '../src/engines/types';

describe('Orchestrator page bus (S5)', () => {
  it('exposes a page bus and publishes route:changed for an accepted view', async () => {
    const o = new Orchestrator();
    o.start();
    const bus = o.getBus();
    const seen: Array<{ view: ViewKind; url: string }> = [];
    bus.subscribe('route:changed', (p) => seen.push(p));
    // Reach into the private lifecycle through the mode-change callback the
    // registry captured — the same path production navigation uses.
    // (Alternative: call (o as any).handleViewChange(...) — allowed, test-only.)
    await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.STREAM, null, 'https://classroom.google.com/u/0/a/not-in-any-class');
    expect(seen).toEqual([{ view: ViewKind.STREAM, url: 'https://classroom.google.com/u/0/a/not-in-any-class' }]);
  });

  it('does NOT publish route:changed for rejected views', async () => {
    const o = new Orchestrator();
    o.start();
    const seen: unknown[] = [];
    o.getBus().subscribe('route:changed', (p) => seen.push(p));
    await (o as unknown as { handleViewChange: (v: ViewKind, p: ViewKind | null, u: string) => Promise<void> })
      .handleViewChange(ViewKind.UNKNOWN, null, 'https://example.com');
    expect(seen).toEqual([]);
  });
});
