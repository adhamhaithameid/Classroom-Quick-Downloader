// filepath: extension/tests/popup-coffee-shimmer.test.ts
/**
 * Stillwater star shimmer (Phase 4 batch D3, commit 2).
 *
 * The popup's Buy-Me-a-Coffee button carries the approved stars + sheen
 * shimmer (prototypes/effects.html B): five four-point stars on staggered
 * 4.8s cycles plus one sheen pass every 6.5s, all decorative
 * (aria-hidden), CSS + inline SVG only. The button's accessibility
 * (aria-label, title, logo alt) stays untouched, and BOTH reduce-motion
 * gates freeze the effect to a static, still-special state.
 */
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../entrypoints/popup/App';

const EXTENSION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(EXTENSION_ROOT, rel), 'utf8');

describe('popup coffee button star shimmer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  /** Fake timers are global (setup.ts) — settle the async settings load. */
  async function renderApp(): Promise<void> {
    await act(async () => {
      root.render(createElement(App));
      await vi.advanceTimersByTimeAsync(50);
    });
  }

  function coffeeButton(): HTMLButtonElement {
    return container.querySelector(
      'button.cqd-coffee-button[aria-label="Support the developer on Buy Me a Coffee"]',
    ) as HTMLButtonElement;
  }

  it('carries five decorative stars and one sheen layer, all aria-hidden', async () => {
    await renderApp();

    const button = coffeeButton();
    expect(button).not.toBeNull();

    const stars = button.querySelectorAll('svg.cqd-coffee-star');
    expect(stars.length).toBe(5);
    for (const star of stars) {
      expect(star.getAttribute('aria-hidden')).toBe('true');
      expect(star.getAttribute('viewBox')).toBe('0 0 12 12');
    }

    const sheen = button.querySelector('span.cqd-coffee-sheen');
    expect(sheen).not.toBeNull();
    expect(sheen?.getAttribute('aria-hidden')).toBe('true');
  });

  it('the button accessibility is untouched (label, title, logo alt)', async () => {
    await renderApp();

    const button = coffeeButton();
    expect(button.getAttribute('title')).toBe(
      'Support the developer on Buy Me a Coffee',
    );
    const logo = button.querySelector('img.cqd-coffee-icon');
    expect(logo?.getAttribute('alt')).toBe('Buy Me a Coffee');
  });
});

describe('shimmer stylesheet contract (App.css)', () => {
  const css = read('entrypoints/popup/App.css');

  it('defines the prototype timing: 4.8s twinkle cycles, 6.5s sheen pass', () => {
    expect(css).toContain('@keyframes cqd-twinkle');
    expect(css).toContain('@keyframes cqd-sheen-pass');
    expect(css).toContain('4.8s');
    expect(css).toContain('6.5s');
    // Five staggered star delays (0s … 4.1s, the prototype's schedule).
    expect(css).toMatch(/\.cqd-coffee-star[^{]*\{[^}]*animation-delay:\s*0s/);
    for (const delay of ['1.4s', '2.6s', '3.4s', '4.1s']) {
      expect(css).toContain(`animation-delay: ${delay}`);
    }
  });

  it('freezes to a static state under the in-app reduce-motion class', () => {
    const section = css.slice(css.indexOf('STAR SHIMMER'));
    const inApp = section.slice(section.indexOf('.cqd-reduce-motion'));
    expect(inApp).toMatch(
      /\.cqd-reduce-motion\s+\.cqd-coffee-star[^{]*\{[^}]*animation:\s*none/,
    );
    expect(inApp).toMatch(/opacity:\s*\.3|opacity:\s*0\.3/);
    expect(inApp).toMatch(/\.cqd-reduce-motion\s+\.cqd-coffee-sheen::before/);
  });

  it('freezes to the same static state under the OS media query', () => {
    const section = css.slice(css.indexOf('STAR SHIMMER'));
    const mediaStart = section.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(mediaStart).toBeGreaterThan(-1);
    const media = section.slice(mediaStart);
    expect(media).toMatch(/\.cqd-coffee-star[^{]*\{[^}]*animation:\s*none/);
    expect(media).toMatch(/opacity:\s*\.3|opacity:\s*0\.3/);
    expect(media).toMatch(/\.cqd-coffee-sheen::before/);
  });
});
