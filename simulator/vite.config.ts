import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { serveClassroomFixture } from './src/fixtures/fixture-server';
import { CLASSROOM_PAGE_META, wrapPageHtml } from './src/fixtures/page-html';

/**
 * CQD Simulator — plain Vite + React app that mounts the REAL extension
 * surfaces (no WXT). Cross-workspace source imports resolve by relative
 * path, exactly as the extension's own build sees them.
 */

/**
 * Route B same-origin server: captured classroom fixtures are served at
 * `/sim/classroom/<id>.html` from the dev-server origin (and emitted into
 * the build output), so the iframe document stays same-origin and
 * `contentDocument` is readable — required by Annotate mode's click capture.
 */
function classroomFixtureServer(): Plugin {
  const fixtureDir = fileURLToPath(
    new URL('../extension/tests/fixtures/classroom', import.meta.url),
  );
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://simulator.local');
    const page = serveClassroomFixture(fixtureDir, url.pathname, url.searchParams.get('dir'));
    if (!page) {
      next();
      return;
    }
    res.statusCode = page.status;
    res.setHeader('Content-Type', page.contentType);
    res.end(page.body);
  };
  return {
    name: 'cqd-simulator-classroom-fixture-server',
    configureServer(server) {
      server.middlewares.use('/sim/classroom', middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/sim/classroom', middleware);
    },
    generateBundle() {
      for (const meta of CLASSROOM_PAGE_META) {
        const file = path.join(fixtureDir, `${meta.id}.html`);
        if (!fs.existsSync(file)) continue;
        this.emitFile({
          type: 'asset',
          fileName: `sim/classroom/${meta.id}.html`,
          source: wrapPageHtml(fs.readFileSync(file, 'utf8'), { rtl: meta.rtl === true }),
        });
      }
    },
  };
}

/**
 * Commit-2 seam (changelog states): the popup's changelog module resolves
 * successfully by design (manual data), so the "fetch failed" and "offline
 * fallback" surfaces have no live trigger. This plugin wraps ONLY that
 * module's export with a simulator override check — the smallest documented
 * test-only seam. The extension's own builds never use this config.
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
  plugins: [react(), changelogSeam(), classroomFixtureServer()],
  build: {
    target: 'esnext',
  },
});
