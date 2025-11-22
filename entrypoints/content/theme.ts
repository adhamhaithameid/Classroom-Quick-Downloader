// filepath: entrypoints/content/theme.ts

/**
 * THEME DETECTOR
 * Reliably detects if the page is currently dark, whether via:
 * - Native Dark Mode (future proofing)
 * - Dark Reader Extension
 * - Chrome Force Dark Mode
 * - Custom CSS
 */

/**
 * Returns true if the page background is visually dark.
 */
export function isPageDark(): boolean {
  if (typeof document === 'undefined') return false;

  // 1. Fast Check: "Dark Reader" extension specific attribute
  const drScheme = document.documentElement.getAttribute('data-darkreader-scheme');
  if (drScheme === 'dark') return true;
  if (drScheme === 'light') return false;

  // 2. Mathematical Check: Compute Background Brightness
  // We look at the body's computed background color.
  try {
    const style = window.getComputedStyle(document.body);
    const bgColor = style.backgroundColor; // returns "rgb(r, g, b)" or "rgba(r, g, b, a)"

    // If transparent, we assume light (default web) unless html is dark
    if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
       const htmlStyle = window.getComputedStyle(document.documentElement);
       return parseBrightness(htmlStyle.backgroundColor) < 128;
    }

    return parseBrightness(bgColor) < 128;
  } catch (e) {
    // Fallback: Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}

/**
 * Helper: Calculates brightness (0-255) from an RGB string.
 * Uses the HSP color formula: sqrt(0.299*R^2 + 0.587*G^2 + 0.114*B^2)
 * Threshold is usually 127.5.
 */
function parseBrightness(rgbString: string): number {
  const match = rgbString.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return 255; // Assume white if unparseable

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
 * (e.g. User toggled Dark Reader on/off)
 */
export function watchThemeChanges(callback: (isDark: boolean) => void): MutationObserver {
  const observer = new MutationObserver(() => {
    callback(isPageDark());
  });

  // Watch for attribute changes on HTML (Dark Reader adds attributes here)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-darkreader-scheme', 'style', 'class'],
  });

  // Watch body style changes
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  return observer;
}