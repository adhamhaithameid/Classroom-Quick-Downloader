export type BrowserKey = 'chrome' | 'firefox' | 'edge';

export function detectBrowserFromUserAgent(userAgent: string): BrowserKey {
  const ua = String(userAgent || '').toLowerCase();
  if (ua.includes('edg/') || ua.includes('edge')) return 'edge';
  if (ua.includes('firefox')) return 'firefox';
  return 'chrome';
}

export function detectBrowserFromNavigator(): BrowserKey {
  if (typeof navigator === 'undefined') return 'chrome';
  return detectBrowserFromUserAgent(navigator.userAgent);
}

export function browserDisplayName(browser: BrowserKey): 'Chrome' | 'Firefox' | 'Edge' {
  if (browser === 'firefox') return 'Firefox';
  if (browser === 'edge') return 'Edge';
  return 'Chrome';
}
