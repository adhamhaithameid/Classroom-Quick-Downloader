import { describe, expect, it, vi } from 'vitest';
import {
  createOffscreenCountRenderer,
  type CountRendererDeps,
} from '../entrypoints/background/icon-count-renderer';

function makeCtx() {
  return {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ pixelData: true })),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    save: vi.fn(),
    restore: vi.fn(),
    set font(_v: string) {},
    set fillStyle(_v: string) {},
    set textAlign(_v: string) {},
    set textBaseline(_v: string) {},
    set shadowColor(_v: string) {},
    set shadowBlur(_v: number) {},
  };
}

const fakeImageData = { width: 48, height: 48 } as ImageData;

function makeDeps() {
  const ctx = makeCtx();
  const loadBitmap = vi.fn(async () => ({ width: 48, height: 48 }));
  const makeCanvas = vi.fn(() => ({
    ctx,
    getImageData: () => fakeImageData,
  }));
  return { ctx, loadBitmap, makeCanvas, deps: { loadBitmap, makeCanvas } as unknown as CountRendererDeps };
}

describe('offscreen count renderer', () => {
  it('reports unavailable when OffscreenCanvas or createImageBitmap is missing', () => {
    const { deps } = makeDeps();
    const unavailable = createOffscreenCountRenderer(deps, {
      hasOffscreenCanvas: () => false,
      hasCreateImageBitmap: () => true,
    });
    const noBitmap = createOffscreenCountRenderer(deps, {
      hasOffscreenCanvas: () => true,
      hasCreateImageBitmap: () => false,
    });
    expect(unavailable.isAvailable()).toBe(false);
    expect(noBitmap.isAvailable()).toBe(false);
  });

  it('composites frame bitmap + count for sizes >= 32 and returns image data', async () => {
    const { ctx, deps } = makeDeps();
    const r = createOffscreenCountRenderer(deps, {
      hasOffscreenCanvas: () => true,
      hasCreateImageBitmap: () => true,
    });
    const out = await r.render('icon/fx/spin-0-48.png', 48, 3);
    expect(out).toBe(fakeImageData);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenCalledWith('3', 24, 24, expect.anything());
  });

  it('skips the count text at size 16 (arc only)', async () => {
    const { ctx, deps } = makeDeps();
    const r = createOffscreenCountRenderer(deps, {
      hasOffscreenCanvas: () => true,
      hasCreateImageBitmap: () => true,
    });
    await r.render('icon/fx/spin-0-16.png', 16, 3);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('renders 99+ for counts above the cap', async () => {
    const { ctx, deps } = makeDeps();
    const r = createOffscreenCountRenderer(deps, {
      hasOffscreenCanvas: () => true,
      hasCreateImageBitmap: () => true,
    });
    await r.render('icon/fx/spin-0-32.png', 32, 147);
    expect(ctx.fillText).toHaveBeenCalledWith('99+', 16, 16, expect.anything());
  });

  it('caches composites per frame:size:count (one bitmap load, one draw)', async () => {
    const { ctx, loadBitmap, deps } = makeDeps();
    const r = createOffscreenCountRenderer(deps, {
      hasOffscreenCanvas: () => true,
      hasCreateImageBitmap: () => true,
    });
    await r.render('icon/fx/spin-0-48.png', 48, 3);
    await r.render('icon/fx/spin-0-48.png', 48, 3);
    await r.render('icon/fx/spin-0-48.png', 48, 4); // count change recomposites
    expect(loadBitmap).toHaveBeenCalledTimes(2);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });

  it('evicts oldest cache entries beyond the cap', async () => {
    const { loadBitmap, deps } = makeDeps();
    const r = createOffscreenCountRenderer(deps, {
      hasOffscreenCanvas: () => true,
      hasCreateImageBitmap: () => true,
    });
    for (let i = 0; i < 80; i += 1) {
      await r.render(`icon/fx/spin-${i % 8}-48.png`, 48, i + 1);
    }
    expect(loadBitmap.mock.calls.length).toBeGreaterThan(60); // cache did work
    expect(r.cacheSize()).toBeLessThanOrEqual(64);
  });

  it('returns null when bitmap loading fails (caller falls back)', async () => {
    const deps = {
      loadBitmap: vi.fn(async () => {
        throw new Error('fetch failed');
      }),
      makeCanvas: vi.fn(() => {
        throw new Error('no canvas');
      }),
    };
    const r = createOffscreenCountRenderer(deps, {
      hasOffscreenCanvas: () => true,
      hasCreateImageBitmap: () => true,
    });
    await expect(r.render('icon/fx/spin-0-48.png', 48, 3)).resolves.toBeNull();
  });
});
