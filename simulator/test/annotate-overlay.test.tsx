/**
 * Annotate overlay tests — Route A pin placement from a real click event,
 * the pin editor, localStorage persistence across remounts, and Clear
 * notes. The overlay is mounted against a popup-frame surface stub; jsdom
 * gives no layout, so the geometry is stubbed with exact rects.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnotateOverlay } from '../src/annotate/AnnotateOverlay';
import { loadAnnotations, saveAnnotations } from '../src/annotate/store';
import type { Annotation } from '../src/annotate/types';

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

function stubNote(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'note-stub',
    route: 'popup',
    stateId: 'first-run',
    deepLink: '#popup=first-run',
    label: '',
    note: '',
    createdAt: '2026-10-09T00:00:00.000Z',
    target: { kind: 'percent', xPct: 25, yPct: 40 },
    ...overrides,
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function mountOverlay(): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container!);
    root!.render(
      <AnnotateOverlay route={{ kind: 'popup', stateId: 'first-run' }} enabled={true} />,
    );
  });
}

function clickButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

async function setNativeValue(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function buildSurface(): { frame: HTMLDivElement; target: HTMLButtonElement } {
  const frame = document.createElement('div');
  frame.className = 'sim-popup-frame';
  frame.innerHTML =
    '<div class="cqd-app"><button class="cqd-download-btn" data-cqd-file-id="fixture-file-0">Download</button></div>';
  document.body.appendChild(frame);
  frame.getBoundingClientRect = () => boxRect(0, 0, 400, 600);
  const target = frame.querySelector('button')!;
  target.getBoundingClientRect = () => boxRect(100, 150, 200, 40);
  return { frame, target };
}

afterEach(async () => {
  const currentRoot = root;
  await act(async () => {
    currentRoot?.unmount();
  });
  document.body.innerHTML = '';
  window.localStorage.clear();
  container = null;
  root = null;
});

describe('annotate overlay — Route A pin placement', () => {
  it('places a pin at the clicked element and saves the note', async () => {
    const { frame, target } = buildSurface();
    await mountOverlay();

    await act(async () => {
      target.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 200,
          clientY: 170,
        }),
      );
    });

    // Pin exists at the element-center percent within the surface.
    const pin = document.querySelector<HTMLButtonElement>('button.sim-pin');
    expect(pin).not.toBeNull();
    expect(pin!.style.left).toBe('50%');
    expect(pin!.style.top).toBe('28.3%');
    expect(pin!.getAttribute('aria-label')).toBe('Note 1');
    expect(pin!.textContent).toBe('1');

    // The editor opened for the new pin; write a note and save.
    const editor = document.querySelector('.sim-annotate-editor');
    expect(editor).not.toBeNull();
    const textarea = editor!.querySelector('textarea')!;
    await setNativeValue(textarea, 'Widen this label');
    await act(async () => {
      clickButton('Save')!.click();
    });

    const stored = loadAnnotations('first-run');
    expect(stored).toHaveLength(1);
    expect(stored[0]!.note).toBe('Widen this label');
    expect(stored[0]!.target.kind).toBe('element');
    if (stored[0]!.target.kind === 'element') {
      expect(stored[0]!.target.tag).toBe('button');
      expect(stored[0]!.target.classes).toEqual(['cqd-download-btn']);
      expect(stored[0]!.target.text).toBe('Download');
    }

    // Editor closed; the pin stays.
    expect(document.querySelector('.sim-annotate-editor')).toBeNull();
    expect(document.querySelector('button.sim-pin')).not.toBeNull();
    frame.getBoundingClientRect = () => boxRect(0, 0, 0, 0);
  });

  it('restores pins from localStorage on remount', async () => {
    buildSurface();
    saveAnnotations('first-run', [
      stubNote({ label: 'Check contrast', target: { kind: 'percent', xPct: 25, yPct: 40 } }),
    ]);
    await mountOverlay();

    const pin = document.querySelector<HTMLButtonElement>('button.sim-pin');
    expect(pin).not.toBeNull();
    expect(pin!.textContent).toBe('1');
    expect(pin!.style.left).toBe('25%');
    expect(pin!.style.top).toBe('40%');
    expect(pin!.getAttribute('aria-label')).toBe('Note 1: Check contrast');
  });

  it('editing an existing pin keeps it; cancel keeps it too', async () => {
    buildSurface();
    saveAnnotations('first-run', [stubNote({ note: 'first text' })]);
    await mountOverlay();

    await act(async () => {
      document.querySelector<HTMLButtonElement>('button.sim-pin')!.click();
    });
    expect(document.querySelector('.sim-annotate-editor')).not.toBeNull();
    await act(async () => {
      clickButton('Cancel')!.click();
    });
    expect(loadAnnotations('first-run')).toHaveLength(1);
    expect(loadAnnotations('first-run')[0]!.note).toBe('first text');
  });

  it('clears the current state notes after confirm', async () => {
    buildSurface();
    saveAnnotations('first-run', [stubNote()]);
    await mountOverlay();
    expect(document.querySelector('button.sim-pin')).not.toBeNull();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => {
      clickButton('Clear notes')!.click();
    });
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(loadAnnotations('first-run')).toEqual([]);
    expect(document.querySelector('button.sim-pin')).toBeNull();
    confirmSpy.mockRestore();
  });

  it('renders nothing over the surface when disabled', async () => {
    buildSurface();
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container!);
      root!.render(
        <AnnotateOverlay route={{ kind: 'popup', stateId: 'first-run' }} enabled={false} />,
      );
    });
    expect(document.querySelector('.sim-annotate-layer')).toBeNull();
    expect(document.querySelector('.sim-annotate-panel')).toBeNull();
    expect(document.querySelector('button.sim-pin')).toBeNull();
  });
});

describe('annotate overlay — Route B capture inside the same-origin iframe', () => {
  it('captures clicks from the fixture iframe document into classroom notes', async () => {
    // Same-origin frame with a loaded document (about:blank keeps its body
    // in jsdom; the dev-server URL form is covered by annotate.test.tsx).
    const wrap = document.createElement('div');
    wrap.className = 'sim-frame-wrap';
    const iframe = document.createElement('iframe');
    iframe.className = 'sim-classroom-frame';
    wrap.appendChild(iframe);
    document.body.appendChild(wrap);
    const frameDoc = iframe.contentDocument!;
    expect(frameDoc.body).not.toBeNull();
    frameDoc.body.innerHTML =
      '<div class="luto0c"><a class="VkhHKd" href="https://example.test/file.pdf">' +
      '<button class="cqd-download-btn" data-cqd-file-id="fixture-file-0">syllabus.pdf</button></a></div>';
    const innerButton = frameDoc.querySelector('button')!;
    // Pin placement uses the element center: center it on the click point.
    innerButton.getBoundingClientRect = () => boxRect(250, 180, 100, 40);
    Object.defineProperty(iframe, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(iframe, 'clientHeight', { value: 600, configurable: true });

    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container!);
      root!.render(
        <AnnotateOverlay
          route={{
            kind: 'classroom',
            pageId: 'mixed-links-post-en',
            params: new URLSearchParams(),
          }}
          enabled={true}
        />,
      );
    });
    // The pin layer hosts inside the classroom wrap, next to the iframe.
    expect(wrap.querySelector('.sim-annotate-layer')).not.toBeNull();

    await act(async () => {
      innerButton.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: 300,
          clientY: 200,
        }),
      );
    });

    const pin = document.querySelector<HTMLButtonElement>('button.sim-pin');
    expect(pin).not.toBeNull();
    expect(pin!.style.left).toBe('37.5%'); // 300 of 800
    expect(pin!.style.top).toBe('33.3%'); // 200 of 600

    const stored = loadAnnotations('mixed-links-post-en');
    expect(stored).toHaveLength(1);
    expect(stored[0]!.route).toBe('classroom');
    expect(stored[0]!.stateId).toBe('mixed-links-post-en');
    expect(stored[0]!.deepLink).toBe('#page=mixed-links-post-en');
    expect(stored[0]!.target.kind).toBe('element');
    if (stored[0]!.target.kind === 'element') {
      expect(stored[0]!.target.tag).toBe('button');
      expect(stored[0]!.target.classes).toEqual(['cqd-download-btn']);
      expect(stored[0]!.target.text).toBe('syllabus.pdf');
    }

    // Cancel the unsaved editor pin — Route B cleanup.
    await act(async () => {
      Array.from(document.querySelectorAll<HTMLButtonElement>('.sim-annotate-editor button'))
        .find((button) => button.textContent?.trim() === 'Cancel')!
        .click();
    });
    expect(loadAnnotations('mixed-links-post-en')).toEqual([]);
  });
});
