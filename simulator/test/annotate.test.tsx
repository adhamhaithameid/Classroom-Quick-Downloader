/**
 * Annotate mode unit tests — target capture, Markdown export (golden),
 * localStorage persistence, the same-origin fixture file server, and
 * Route B's readable iframe.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cssPath, describeElement, formatElementTarget } from '../src/annotate/describe';
import { formatAnnotationsMarkdown } from '../src/annotate/export';
import {
  clearAnnotations,
  listAnnotatedStateIds,
  loadAllGroups,
  loadAnnotations,
  saveAnnotations,
} from '../src/annotate/store';
import type { Annotation, AnnotationGroup } from '../src/annotate/types';
import { serveClassroomFixture } from '../src/fixtures/fixture-server';
import { classroomFixtureUrl, wrapPageHtml } from '../src/fixtures/page-html';
import { installFixtureChrome } from '../src/fixtures/fixture-chrome';
import { firstRunFixture } from '../src/fixtures/fixture-state';

function boxRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function baseNote(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'note-1',
    route: 'popup',
    stateId: 'first-download',
    deepLink: '#popup=first-download',
    label: '',
    note: 'Widen this label',
    createdAt: '2026-10-09T00:00:00.000Z',
    target: { kind: 'percent', xPct: 42.5, yPct: 31 },
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
});

describe('annotate export — deterministic Markdown', () => {
  it('formats the exact golden shape for grouped notes', () => {
    const groups: AnnotationGroup[] = [
      {
        stateId: 'first-download',
        route: 'popup',
        title: 'First download (milestone 1)',
        deepLink: '#popup=first-download',
        notes: [
          baseNote({
            target: {
              kind: 'element',
              tag: 'button',
              id: null,
              classes: ['cqd-download-btn'],
              data: [{ key: 'data-cqd-file-id', value: 'fixture-file-0' }],
              text: 'syllabus.pdf Download',
              path: 'div.luto0c > a.VkhHKd > button.cqd-download-btn',
              xPct: 42.5,
              yPct: 31,
            },
          }),
        ],
      },
      {
        stateId: 'mixed-links-post-en',
        route: 'classroom',
        title: 'Mixed links post (en)',
        deepLink: '#page=mixed-links-post-en',
        notes: [
          baseNote({
            id: 'note-2',
            route: 'classroom',
            stateId: 'mixed-links-post-en',
            deepLink: '#page=mixed-links-post-en',
            note: '',
            target: { kind: 'percent', xPct: 8.3, yPct: 22.1 },
          }),
          baseNote({
            id: 'note-3',
            route: 'classroom',
            stateId: 'mixed-links-post-en',
            deepLink: '#page=mixed-links-post-en',
            label: 'badge',
            note: 'Pill overlaps the title',
            target: { kind: 'percent', xPct: 10, yPct: 20 },
          }),
        ],
      },
    ];

    const md = formatAnnotationsMarkdown(groups, {
      now: new Date('2026-10-09T12:00:00.000Z'),
      baseUrl: 'http://localhost:5173/',
    });

    const golden = [
      '## SIMULATOR ANNOTATIONS — 2026-10-09T12:00:00.000Z',
      'Total: 3 notes',
      '',
      '### [1] first-download — First download (milestone 1)',
      '- Route: popup',
      '- Reproduce: http://localhost:5173/#popup=first-download',
      '- Target: div.luto0c > a.VkhHKd > button.cqd-download-btn "syllabus.pdf Download" @ 42.5,31',
      '- Note: Widen this label',
      '',
      '### [1] mixed-links-post-en — Mixed links post (en)',
      '- Route: classroom',
      '- Reproduce: http://localhost:5173/#page=mixed-links-post-en',
      '- Target: percent 8.3,22.1',
      '- Note: (no text)',
      '',
      '### [2] mixed-links-post-en — Mixed links post (en)',
      '- Route: classroom',
      '- Reproduce: http://localhost:5173/#page=mixed-links-post-en',
      '- Target: percent 10,20',
      '- Note: [badge] Pill overlaps the title',
    ].join('\n');

    expect(md).toBe(`${golden}\n`);
  });
});

describe('annotate describe — click target capture', () => {
  it('captures tag, cqd classes, data attrs, text, path, and percent center', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    surface.innerHTML = [
      '<div class="luto0c">',
      '<a class="VkhHKd" href="https://example.test" data-drive-id="drv-9" aria-label="Attachment: PDF: syllabus.pdf">',
      '<button class="cqd-download-btn cqd-error" data-cqd-file-id="fixture-file-0" data-cqd-state="error">',
      'syllabus.pdf Download',
      '</button></a></div>',
    ].join('');
    const surfaceEl = surface;
    const anchor = surface.querySelector('a')!;
    const button = surface.querySelector('button')!;
    surfaceEl.getBoundingClientRect = () => boxRect(0, 0, 400, 600);
    button.getBoundingClientRect = () => boxRect(100, 150, 200, 40);
    anchor.getBoundingClientRect = () => boxRect(96, 146, 208, 48);

    const surfaceBox = { left: 0, top: 0, width: 400, height: 600 };
    const target = describeElement(button, surfaceEl, false, surfaceBox);

    expect(target.tag).toBe('button');
    expect(target.id).toBeNull();
    expect(target.classes).toEqual(['cqd-download-btn', 'cqd-error']);
    expect(target.data).toEqual([
      { key: 'data-cqd-file-id', value: 'fixture-file-0' },
      { key: 'data-cqd-state', value: 'error' },
    ]);
    expect(target.text).toBe('syllabus.pdf Download');
    expect(target.path).toBe('button.cqd-download-btn > a.VkhHKd > div.luto0c');
    expect(target.xPct).toBe(50); // center 200 of 400
    expect(target.yPct).toBe(28.3); // center 170 of 600
    expect(formatElementTarget(target)).toBe(
      'button.cqd-download-btn > a.VkhHKd > div.luto0c "syllabus.pdf Download" @ 50,28.3',
    );

    // The path stops below the surface and caps at 4 steps.
    const anchorTarget = describeElement(anchor, surfaceEl, false, surfaceBox);
    expect(anchorTarget.path).toBe('a.VkhHKd > div.luto0c');
    expect(cssPath(surfaceEl, surfaceEl)).toBe('');
    expect(anchorTarget.text.length).toBeLessThanOrEqual(60);
  });

  it('trims long text and caps non-cqd classes at 3', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const el = document.createElement('button');
    el.className = 'a b c d cqd-flag';
    el.textContent = 'x'.repeat(100);
    surface.appendChild(el);
    el.getBoundingClientRect = () => boxRect(0, 0, 10, 10);

    const target = describeElement(el, surface, false, {
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    expect(target.classes).toEqual(['cqd-flag', 'a', 'b', 'c']);
    expect(target.text).toBe('x'.repeat(60));
  });
});

describe('annotate store — localStorage per state', () => {
  it('saves, reloads, renumbers by position, and clears', () => {
    const noteA = baseNote({ id: 'a' });
    const noteB = baseNote({ id: 'b' });
    saveAnnotations('first-run', [noteA, noteB]);
    saveAnnotations('mixed-links-post-en', [baseNote({ id: 'c' })]);

    expect(loadAnnotations('first-run')).toEqual([noteA, noteB]);
    expect(listAnnotatedStateIds().sort()).toEqual([
      'first-run',
      'mixed-links-post-en',
    ]);

    // Deleting the first note renumbers the rest by array position.
    saveAnnotations('first-run', [noteB]);
    expect(loadAnnotations('first-run')).toEqual([noteB]);

    clearAnnotations('first-run');
    expect(loadAnnotations('first-run')).toEqual([]);
    expect(listAnnotatedStateIds()).toEqual(['mixed-links-post-en']);
  });

  it('groups all notes with resolved titles, sorted by state id', () => {
    saveAnnotations('first-run', [baseNote({ id: 'a' })]);
    saveAnnotations('mixed-links-post-en', [
      baseNote({ id: 'c', route: 'classroom', stateId: 'mixed-links-post-en' }),
    ]);

    const groups = loadAllGroups();
    expect(groups.map((group) => group.stateId)).toEqual([
      'first-run',
      'mixed-links-post-en',
    ]);
    expect(groups[0]!.title).toBe('First run');
    expect(groups[1]!.title).toBe('Mixed links post (en)');

    // The current state (when asked) leads the list.
    const reordered = loadAllGroups('mixed-links-post-en');
    expect(reordered[0]!.stateId).toBe('mixed-links-post-en');
  });

  it('tolerates corrupt storage', () => {
    window.localStorage.setItem('cqd-sim-annotations:v1:broken', '{not json');
    expect(loadAnnotations('broken')).toEqual([]);
  });
});

describe('annotate fixture server — same-origin Route B pages', () => {
  // vitest runs with cwd = simulator/, so the shared fixtures sit one level up.
  const fixtureDir = path.resolve(process.cwd(), '../extension/tests/fixtures/classroom');

  it('serves the captured fixture wrapped in the page chrome', () => {
    const page = serveClassroomFixture(fixtureDir, '/mixed-links-post-en.html', null);
    expect(page?.status).toBe(200);
    expect(page?.contentType).toBe('text/html; charset=utf-8');
    expect(page?.body).toContain('data-stream-item-id');
    expect(page?.body).toContain('body { margin: 0; padding: 16px');
    expect(page?.body).toContain('<html lang="en">');
  });

  it('mirrors the registry rtl flag through the dir param', () => {
    const rtl = serveClassroomFixture(fixtureDir, '/rtl-flagged-post-ar.html', 'rtl');
    expect(rtl?.body).toContain('<html lang="ar" dir="rtl">');
  });

  it('404s unknown ids and falls through non-page paths', () => {
    expect(serveClassroomFixture(fixtureDir, '/nope.html', null)?.status).toBe(404);
    expect(serveClassroomFixture(fixtureDir, '/nested/page.html', null)).toBeUndefined();
  });

  it('builds the same-origin URL with the rtl param', () => {
    expect(classroomFixtureUrl({ id: 'mixed-links-post-en' })).toBe(
      '/sim/classroom/mixed-links-post-en.html',
    );
    expect(classroomFixtureUrl({ id: 'rtl-flagged-post-ar', rtl: true })).toBe(
      '/sim/classroom/rtl-flagged-post-ar.html?dir=rtl',
    );
  });

  it('wraps raw HTML identically for the build emission', () => {
    expect(wrapPageHtml('<p>x</p>', {})).toContain('<html lang="en">');
    expect(wrapPageHtml('<p>x</p>', { rtl: true })).toContain('<html lang="ar" dir="rtl">');
  });
});

describe('Route B iframe — same-origin readability', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(async () => {
    const currentRoot = root;
    await act(async () => {
      currentRoot?.unmount();
    });
    document.body.innerHTML = '';
    container = null;
    root = null;
  });

  it('loads the served URL and exposes a readable contentDocument', async () => {
    installFixtureChrome(firstRunFixture());
    const { ClassroomRoute } = await import('../src/routes/ClassroomRoute');
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container!);
      root!.render(
        <ClassroomRoute pageId="mixed-links-post-en" params={new URLSearchParams()} />,
      );
    });

    const iframe = container.querySelector('iframe.sim-classroom-frame');
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute('src')).toBe('/sim/classroom/mixed-links-post-en.html');
    expect(container.querySelector('.sim-frame-wrap')).not.toBeNull();

    // Same-origin: the frame document is exposed to the parent (a
    // cross-origin frame would throw on access). jsdom resolves the
    // same-origin URL without a network fetch, so the lazy document has no
    // parsed root yet — readable-but-empty is the correct dev-server shape.
    const doc = (iframe as HTMLIFrameElement).contentDocument;
    expect(doc).not.toBeNull();
    expect(typeof doc!.createElement).toBe('function');
  });

  it('passes the rtl flag for RTL fixtures', async () => {
    installFixtureChrome(firstRunFixture());
    const { ClassroomRoute } = await import('../src/routes/ClassroomRoute');
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container!);
      root!.render(
        <ClassroomRoute pageId="rtl-flagged-post-ar" params={new URLSearchParams()} />,
      );
    });
    const iframe = container.querySelector('iframe.sim-classroom-frame');
    expect(iframe!.getAttribute('src')).toBe(
      '/sim/classroom/rtl-flagged-post-ar.html?dir=rtl',
    );
  });
});
