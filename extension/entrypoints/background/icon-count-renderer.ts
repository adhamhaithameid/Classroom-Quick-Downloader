// filepath: extension/entrypoints/background/icon-count-renderer.ts
/**
 * Composites the active-download count into a spinner frame (bead 08fg.2).
 * The animation adapter hands us a frame path + count per size; we return
 * setIcon-ready ImageData, cached per frame:size:count so a steady count
 * costs one composite per frame per size and then pure cache hits. All
 * browser capabilities are injectable, so policy and caching are unit-
 * tested while the prod wiring (OffscreenCanvas, fetch, createImageBitmap)
 * stays a thin wrapper. When compositing is unavailable the adapter falls
 * back to badge text — never both.
 */

export interface CountRenderer {
  isAvailable(): boolean;
  /** Resolves null when compositing fails; the caller falls back. */
  render(framePath: string, size: number, count: number): Promise<ImageData | null>;
  cacheSize(): number;
}

const CACHE_CAP = 64;
const COUNT_CAP_LABEL = '99+';

/** Sizes below this show the spinner arc only — no room for digits. */
export const COUNT_MIN_SIZE = 32;

export interface CountRendererDeps {
  loadBitmap: (framePath: string, size: number) => Promise<ImageBitmap>;
  makeCanvas: (
    size: number,
  ) => { ctx: OffscreenCanvasRenderingContext2D; getImageData: () => ImageData };
}

export function createOffscreenCountRenderer(
  deps: CountRendererDeps,
  caps?: { hasOffscreenCanvas?: () => boolean; hasCreateImageBitmap?: () => boolean },
): CountRenderer {
  const hasOffscreen = caps?.hasOffscreenCanvas ?? (() => typeof OffscreenCanvas === 'function');
  const hasBitmap = caps?.hasCreateImageBitmap ?? (() => typeof createImageBitmap === 'function');
  const cache = new Map<string, ImageData>();

  function cachePut(key: string, data: ImageData): void {
    cache.delete(key);
    cache.set(key, data);
    while (cache.size > CACHE_CAP) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  function drawCount(ctx: OffscreenCanvasRenderingContext2D, size: number, count: number): void {
    const label = count > 99 ? COUNT_CAP_LABEL : String(count);
    const fontPx = Math.round(size * (label.length > 1 ? 0.3 : 0.36));
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.max(1, size / 24);
    ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
    ctx.fillText(label, size / 2, size / 2, size * 0.62);
    ctx.restore();
  }

  return {
    isAvailable: () => hasOffscreen() && hasBitmap(),

    async render(framePath: string, size: number, count: number): Promise<ImageData | null> {
      const key = `${framePath}:${size}:${count}`;
      const cached = cache.get(key);
      if (cached) return cached;
      try {
        const bitmap = await deps.loadBitmap(framePath, size);
        const { ctx, getImageData } = deps.makeCanvas(size);
        ctx.drawImage(bitmap, 0, 0, size, size);
        if (count > 0 && size >= COUNT_MIN_SIZE) drawCount(ctx, size, count);
        const data = getImageData();
        cachePut(key, data);
        return data;
      } catch {
        return null;
      }
    },

    cacheSize: () => cache.size,
  };
}

/** Prod wiring over the real browser APIs (service worker safe). */
export function createRuntimeCountRenderer(): CountRenderer {
  return createOffscreenCountRenderer({
    async loadBitmap(framePath) {
      const url = chrome.runtime.getURL(framePath);
      const blob = await (await fetch(url)).blob();
      return createImageBitmap(blob);
    },
    makeCanvas(size) {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      return { ctx, getImageData: () => ctx.getImageData(0, 0, size, size) };
    },
  });
}
