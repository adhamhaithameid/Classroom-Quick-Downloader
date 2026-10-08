// filepath: extension/tests/popup-stillwater-frame.test.ts
/**
 * Phase 4 batch D4 commit 2 — the popup frame reads as the approved
 * direction-A prototype (prototypes/popup-direction-a.html). These guards
 * pin the presentation contract only; behavior keeps its own feature tests:
 *   - the 360 x 600 stage;
 *   - the quiet header chrome (hairline band, 28px mark, 13px brand);
 *   - the 12px section rhythm and quiet card depth (4/8 grid);
 *   - history rows as the prototype's bordered h-rows with 26px tiles;
 *   - the error banner as the calm error card (not a pill);
 *   - ONE filled action: the non-Classroom hero carries the CTA glass
 *     treatment with its icon + title + sub geometry, same handler, same
 *     aria label.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../entrypoints/popup/App';

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(EXTENSION_ROOT, rel), 'utf8');

/** First declaration block of a flat CSS rule — enough for these guards. */
function block(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `missing selector ${selector}`).toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

describe('stillwater popup frame (App.css)', () => {
  const css = read('entrypoints/popup/App.css');
  // The token foundation moved to the shared sheet (q320) — one copy for
  // the popup and the options page.
  const tokens = read('src/ui/stillwater.css');

  it('opens the 360 x 600 stage from the prototype', () => {
    const body = block(css, 'body {');
    expect(body).toContain('width: 360px;');
    expect(body).toContain('height: 600px;');
  });

  it('the header carries the prototype p-head hairline (full-bleed band)', () => {
    const head = block(css, '.cqd-header {');
    expect(head).toContain('border-bottom');
  });

  it('the brand name sits on the 13px body step (quiet chrome, not a hero)', () => {
    const brand = block(css, '.cqd-brand-name {');
    expect(brand).toContain('var(--cqd-fs-body)');
  });

  it('the brand mark is the 28px header tile from the prototype', () => {
    const logo = block(css, '.cqd-brand-logo {');
    expect(logo).toContain('width: 28px;');
    expect(logo).toContain('height: 28px;');
  });

  it('sections breathe on the 12px step of the 4/8 grid', () => {
    const area = block(css, '.cqd-content-area {');
    expect(area).toContain('gap: 12px');
  });

  it('cards keep soft depth (quiet shadow on the shared card)', () => {
    const card = block(css, '.cqd-card {');
    expect(card).toContain('var(--cqd-shadow-soft)');
    expect(tokens).toMatch(/--cqd-shadow-soft: 0 2px 8px rgba\(15, 23, 42, 0\.05\);/);
  });

  it('history rows read as the bordered h-rows', () => {
    const row = block(css, '.cqd-history-row {');
    expect(row).toContain('border: 1px solid');
    expect(row).toContain('border-radius: 12px');
  });

  it('history status chips read as the 26px h-ic tiles', () => {
    const chip = block(css, '.cqd-history-state {');
    expect(chip).toContain('width: 26px;');
    expect(chip).toContain('height: 26px;');
    expect(chip).toContain('border-radius: 8px');
  });

  it('queue rows share the row treatment (one list grammar)', () => {
    const row = block(css, '.cqd-queue-row {');
    expect(row).toContain('border: 1px solid');
    expect(row).toContain('border-radius: 12px');
  });

  it('the error banner is the calm error card, not a pill', () => {
    const banner = block(css, '.cqd-banner-error {');
    expect(banner).not.toContain('border-radius: 999px');
    expect(banner).toContain('border-radius: 12px');
  });

  it('the footer is the translucent p-foot band (full-bleed, above nothing)', () => {
    const footer = block(css, '.cqd-footer {');
    expect(footer).toContain('background:');
  });

  it('motion settles on the approved curve everywhere (one easing, 200ms)', () => {
    expect(tokens).toContain('--cqd-transition-fast: 200ms cubic-bezier(0.22, 1, 0.36, 1);');
  });
});

describe('stillwater hero CTA (non-Classroom main action)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useRealTimers();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    localStorage.clear();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        getManifest: () => ({ version: '1.3.0' }),
        lastError: null,
      },
      tabs: {
        query: vi.fn((_q: unknown, cb: (tabs: Array<{ id: number; url: string }>) => void) => {
          // Not a Classroom tab — the hero surface is the non-Classroom card.
          cb([{ id: 1, url: 'https://example.com/' }]);
        }),
        create: vi.fn(),
      },
      storage: {
        local: {
          get: vi.fn((_k: unknown, cb: (r: Record<string, unknown>) => void) => {
            cb({ extensionEnabled: true, cqd_changelog_seen_v1: [] });
          }),
          set: vi.fn(),
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    };
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    localStorage.clear();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    delete (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    vi.restoreAllMocks();
  });

  it('renders the hero with icon + title + sub, same handler surface as before', async () => {
    flushSync(() => {
      root.render(createElement(App));
    });
    await new Promise((resolveTick) => setTimeout(resolveTick, 0));

    const hero = container.querySelector('button.cqd-open-classroom-btn') as HTMLButtonElement | null;
    expect(hero).not.toBeNull();
    // Same truthful aria + handler contract as before the integration.
    expect(hero?.getAttribute('aria-label')).toBe('Open Google Classroom in a new tab');
    expect(hero?.getAttribute('title')).toBe('Open Google Classroom in a new tab');

    const icon = hero?.querySelector('.cqd-cta-icon');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');

    const title = hero?.querySelector('.cqd-cta-title');
    expect(title?.textContent).toBe('Open Google Classroom');

    const sub = hero?.querySelector('.cqd-cta-sub');
    expect(sub?.textContent).toBe('Opens in a new tab');
  });
});
