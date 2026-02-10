import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isPageDark, watchThemeChanges } from '../entrypoints/content/theme';

describe('content/theme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-darkreader-scheme');
    document.documentElement.className = '';
    document.body.className = '';
    document.body.innerHTML = '';
  });

  it('uses Dark Reader scheme first', () => {
    document.documentElement.setAttribute('data-darkreader-scheme', 'dark');
    expect(isPageDark()).toBe(true);

    document.documentElement.setAttribute('data-darkreader-scheme', 'light');
    expect(isPageDark()).toBe(false);
  });

  it('detects obvious dark mode classes', () => {
    document.documentElement.className = 'gm3-dark-theme';
    expect(isPageDark()).toBe(true);
  });

  it('falls back to measured background brightness', () => {
    const post = document.createElement('div');
    post.setAttribute('data-stream-item-id', '1');
    post.style.backgroundColor = 'rgb(20, 20, 20)';
    document.body.appendChild(post);

    expect(isPageDark()).toBe(true);
  });

  it('watchThemeChanges emits initial and mutation-driven updates', async () => {
    const callback = vi.fn();
    const observer = watchThemeChanges(callback);
    expect(callback).toHaveBeenCalledTimes(1);

    document.documentElement.setAttribute('data-darkreader-scheme', 'dark');
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(2);

    observer.disconnect();
  });
});
