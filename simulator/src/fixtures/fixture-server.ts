/**
 * Classroom fixture file server — the Node half of the same-origin Route B.
 *
 * vite.config.ts mounts this through dev/preview middleware under
 * `/sim/classroom/`. Kept as a pure function so vitest can exercise the
 * real disk read + wrapper without opening a socket.
 */

import fs from 'node:fs';
import path from 'node:path';
import { wrapPageHtml } from './page-html';

export interface FixtureResponse {
  status: number;
  contentType: string;
  body: string;
}

/**
 * Resolve `/sim/classroom/<id>.html` to the captured fixture page wrapped in
 * the simulator page chrome. Non-matching paths return undefined so the
 * middleware can fall through; a matching id with no fixture file answers
 * 404 rather than the SPA fallback.
 */
export function serveClassroomFixture(
  fixtureDir: string,
  pathname: string,
  dirParam: string | null,
): FixtureResponse | undefined {
  const match = /^\/([a-z0-9-]+)\.html$/.exec(pathname);
  if (!match) return undefined;
  const id = match[1]!;
  const file = path.join(fixtureDir, `${id}.html`);
  if (!fs.existsSync(file)) {
    return { status: 404, contentType: 'text/plain; charset=utf-8', body: 'fixture not found' };
  }
  const html = fs.readFileSync(file, 'utf8');
  return {
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: wrapPageHtml(html, { rtl: dirParam === 'rtl' }),
  };
}
