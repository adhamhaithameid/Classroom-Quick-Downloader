import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeFirstInView } from './in-view';

/**
 * Node-env stubs: the vitest environment is `node`, so there is no DOM.
 * The module resolves the IntersectionObserver constructor and the viewport
 * height from `globalThis` at call time, so tests stub them with
 * `vi.stubGlobal` and drive the captured observer callback manually.
 * Hosts are plain objects exposing only `getBoundingClientRect()`.
 */

interface FakeRect {
  top: number;
  bottom: number;
  width: number;
  height: number;
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;
  private targets: Element[] = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(_target: Element): void {}

  disconnect(): void {}

  /** Deliver an intersecting entry — even after disconnect, so only the module's own disconnect/once guard can block it. */
  enter(): void {
    this.deliver(true);
  }

  exit(): void {
    this.deliver(false);
  }

  private deliver(isIntersecting: boolean): void {
    const entry = { isIntersecting, target: this.targets[0] } as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
}

function fakeHost(rectValue: FakeRect): Element {
  return { getBoundingClientRect: () => rectValue } as unknown as Element;
}

function rect(partial: Partial<FakeRect>): FakeRect {
  return { top: 0, bottom: 0, width: 0, height: 0, ...partial };
}

function baseOptions(onEnter: () => void) {
  return { threshold: 0, rootMargin: '0px 0px -8% 0px', onEnter };
}

// Entirely below a 900px viewport.
const BELOW_VIEWPORT_RECT: Partial<FakeRect> = { top: 1000, bottom: 1100, width: 100, height: 100 };

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('observeFirstInView', () => {
  it('a. fires onEnter immediately for a host partially inside the real viewport even though the observer never fires (the -8% rootMargin bug)', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('innerHeight', 900);
    const onEnter = vi.fn();
    // 30px of the host are visible at the very bottom of a 900px viewport:
    // inside the real viewport but below the observer's shrunken root.
    const host = fakeHost(rect({ top: 850, bottom: 880, width: 100, height: 30 }));

    observeFirstInView(host, baseOptions(onEnter));

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(FakeIntersectionObserver.instances).toHaveLength(1); // constructed, never fires

    vi.advanceTimersByTime(10_000);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('b. waits for the observer when the host is entirely below the viewport and fires on isIntersecting', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('innerHeight', 900);
    const onEnter = vi.fn();
    const host = fakeHost(rect(BELOW_VIEWPORT_RECT));

    observeFirstInView(host, baseOptions(onEnter));

    expect(onEnter).not.toHaveBeenCalled();
    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    expect(FakeIntersectionObserver.instances[0].options).toEqual({
      threshold: 0,
      rootMargin: '0px 0px -8% 0px'
    });

    FakeIntersectionObserver.instances[0].exit();
    expect(onEnter).not.toHaveBeenCalled();

    FakeIntersectionObserver.instances[0].enter();
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('c. does not take the fast path for a zero-size (display:none) rect and waits for the observer instead', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('innerHeight', 900);
    const onEnter = vi.fn();
    const host = fakeHost(rect({ top: 0, bottom: 0, width: 0, height: 0 }));

    observeFirstInView(host, baseOptions(onEnter));

    expect(onEnter).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3999);
    expect(onEnter).not.toHaveBeenCalled();

    FakeIntersectionObserver.instances[0].enter();
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('d. falls back to onEnter after the delay when the host stays outside the viewport and the observer never fires', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('innerHeight', 900);
    const onEnter = vi.fn();
    const host = fakeHost(rect(BELOW_VIEWPORT_RECT));

    observeFirstInView(host, baseOptions(onEnter));

    vi.advanceTimersByTime(3999);
    expect(onEnter).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('e. fires exactly once when the observer fires twice and the fallback also elapses', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('innerHeight', 900);
    const onEnter = vi.fn();
    const host = fakeHost(rect(BELOW_VIEWPORT_RECT));

    observeFirstInView(host, baseOptions(onEnter));

    FakeIntersectionObserver.instances[0].enter();
    FakeIntersectionObserver.instances[0].enter();
    vi.advanceTimersByTime(10_000);

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('f. disconnect() prevents any later onEnter from observer or fallback', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('innerHeight', 900);
    const onEnter = vi.fn();
    const host = fakeHost(rect(BELOW_VIEWPORT_RECT));

    const handle = observeFirstInView(host, baseOptions(onEnter));
    handle.disconnect();

    FakeIntersectionObserver.instances[0].enter();
    vi.advanceTimersByTime(10_000);

    expect(onEnter).not.toHaveBeenCalled();
  });

  it('g. fires immediately when IntersectionObserver is undefined', () => {
    expect(globalThis.IntersectionObserver).toBeUndefined(); // node env, no stub
    vi.stubGlobal('innerHeight', 900);
    const onEnter = vi.fn();
    const host = fakeHost(rect({ top: 850, bottom: 880, width: 100, height: 30 }));

    observeFirstInView(host, baseOptions(onEnter));

    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
