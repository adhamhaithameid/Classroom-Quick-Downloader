// filepath: entrypoints/content/theme.ts

/**
 * THEME DETECTOR
 *
 * Goal: "Is the content I'm drawing on visually dark or light?"
 * Instead of guessing from <body>, we:
 *  - Respect Dark Reader if present
 *  - Look for obvious "dark mode" classes
 *  - Measure the effective background color of a *content* element
 *    (e.g. Google Classroom stream cards)
 */

/**
 * Returns true if the page *content area* is visually dark.
 */
export function isPageDark(): boolean {
  if (typeof document === 'undefined') return false;

  // 1. Fast path: Dark Reader attribute
  const drScheme = document.documentElement.getAttribute('data-darkreader-scheme');
  if (drScheme === 'dark') return true;
  if (drScheme === 'light') return false;

  // 2. Heuristic: obvious "dark mode" classes on <html> / <body>
  // (covers some frameworks and extensions)
  const darkTokens = ['dark', 'dark-theme', 'theme-dark', 'night', 'gm3-dark-theme'];
  const htmlClass = (document.documentElement.className || '').toLowerCase();
  const bodyClass = (document.body.className || '').toLowerCase();
  if (darkTokens.some(token => htmlClass.includes(token) || bodyClass.includes(token))) {
    return true;
  }

  // 3. Probe a *content* element, not the whole page background.
  //    For Classroom, posts are the main surface we draw on.
  const probeEl =
    document.querySelector<HTMLElement>('div[data-stream-item-id]') ||
    document.querySelector<HTMLElement>('[role="main"]') ||
    document.body;

  const bgColor = getEffectiveBackgroundColor(probeEl);
  const brightness = parseBrightness(bgColor);

  // 4. Decide threshold.
  //    128 is "50% gray", but that flips too early on slightly gray UIs.
  //    Use a stricter threshold so we only treat clearly dark UIs as dark.
  return brightness < 105;
}

/**
 * Walks up the DOM from a given element until it finds a non-transparent background color.
 * Falls back to <html> and finally to pure white.
 */
function getEffectiveBackgroundColor(start: HTMLElement): string {
  let el: HTMLElement | null = start;

  const isTransparent = (c: string | null) =>
    !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)';

  while (el) {
    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor;
    if (!isTransparent(bg)) return bg;
    el = el.parentElement;
  }

  // Try <html> as a last real element
  const htmlStyle = window.getComputedStyle(document.documentElement);
  const htmlBg = htmlStyle.backgroundColor;
  if (!isTransparent(htmlBg)) return htmlBg;

  // Absolute fallback: assume white
  return 'rgb(255, 255, 255)';
}

/**
 * Helper: Calculates brightness (0-255) from an RGB(A) string.
 * Uses the HSP color formula: sqrt(0.299*R^2 + 0.587*G^2 + 0.114*B^2)
 */
function parseBrightness(rgbString: string): number {
  const match = rgbString.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!match) {
    // If we can't parse it, assume bright so we don't accidentally flip to dark mode.
    return 255;
  }

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);

  // HSP equation is perceived brightness
  const brightness = Math.sqrt(
    0.299 * (r * r) +
    0.587 * (g * g) +
    0.114 * (b * b)
  );

  return brightness;
}

/**
 * Watcher: Notifies you when the theme likely changed.
 *
 * You can use this if you ever want to dynamically re-style things
 * when the user / extension toggles theme.
 */
export function watchThemeChanges(callback: (isDark: boolean) => void): MutationObserver {
  const handler = () => {
    callback(isPageDark());
  };

  const observer = new MutationObserver(handler);

  // Watch for attribute/class changes on <html> and <body>
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-darkreader-scheme', 'style', 'class'],
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  // Also listen to system theme changes as a backup signal
  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq) {
      const mqListener = () => handler();
      // Modern browsers
      if ((mq as any).addEventListener) {
        mq.addEventListener('change', mqListener);
      } else if ((mq as any).addListener) {
        // Legacy API
        (mq as any).addListener(mqListener);
      }
    }
  }

  // Initial call so the consumer can sync immediately
  handler();

  return observer;
}
