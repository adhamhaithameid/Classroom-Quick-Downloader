/**
 * W3: the extension appends compact download totals (`d` = downloads,
 * `a` = attempts) to its uninstall URL so usage survives uninstall. The
 * prerendered uninstall page parses them back (SSR-safe: pure function over
 * URLSearchParams, no window access here) and includes them in the uninstall
 * page's telemetry event meta.
 */

function coerceCount(raw: string | null): number {
  if (raw === null) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

export function parseUninstallStatsParams(params: URLSearchParams): {
  downloads: number;
  attempts: number;
} {
  return {
    downloads: coerceCount(params.get('d')),
    attempts: coerceCount(params.get('a'))
  };
}
