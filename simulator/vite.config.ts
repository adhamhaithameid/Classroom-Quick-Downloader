import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * CQD Simulator — plain Vite + React app that mounts the REAL extension
 * surfaces (no WXT). Cross-workspace source imports resolve by relative
 * path, exactly as the extension's own build sees them.
 */

/**
 * Commit-2 seam (changelog states): the popup's changelog module resolves
 * successfully by design (manual data), so the "fetch failed" surface has
 * no live trigger. This plugin wraps ONLY that module's export with a
 * simulator override check — the smallest documented test-only seam.
 * The extension's own builds never use this config.
 */
function changelogSeam() {
  return {
    name: 'cqd-simulator-changelog-seam',
    transform(code: string, id: string) {
      const normalized = id.replaceAll('\\', '/');
      if (!normalized.endsWith('entrypoints/utils/changelog.ts')) return null;
      if (code.includes('__cqdRealFetchChangelogDetailed')) return null;
      const wrapped = code.replace(
        'export async function fetchChangelogDetailed(',
        'async function __cqdRealFetchChangelogDetailed(',
      );
      if (wrapped === code) return null;
      return {
        code: `${wrapped}
export async function fetchChangelogDetailed(force = false) {
  const override = (globalThis).__cqdChangelogOverride;
  if (override) return override(force);
  return __cqdRealFetchChangelogDetailed(force);
}
`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), changelogSeam()],
  build: {
    target: 'esnext',
  },
});
