// filepath: extension/tests/popup-history.test.ts
/**
 * 0h4d.1.6 task 4 — the popup History panel. Render + interaction contract:
 * rows render with status chips, the search box drives onQueryChange, and
 * clear/re-download fire their callbacks with the right payloads.
 */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryPanel, type HistoryRow } from '../entrypoints/popup/App';

const ROWS: HistoryRow[] = [
  {
    id: 'req-1',
    ts: Date.UTC(2026, 8, 29),
    filename: 'lecture-notes.pdf',
    ext: 'pdf',
    bytes: 12345,
    status: 'success',
    host: 'drive.usercontent.google.com',
    url: 'https://drive.usercontent.google.com/download?id=FILE123',
  },
  {
    id: 'req-2',
    ts: Date.UTC(2026, 8, 28),
    filename: 'syllabus.docx',
    status: 'failed',
    errorCode: 'SIZE_MISMATCH',
    host: 'drive.usercontent.google.com',
    url: 'https://drive.usercontent.google.com/download?id=FILE456',
  },
];

describe('popup history panel (0h4d.1.6)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  function renderPanel(overrides: Partial<Parameters<typeof HistoryPanel>[0]> = {}) {
    const onQueryChange = vi.fn();
    const onClear = vi.fn();
    const onRedownload = vi.fn();
    flushSync(() => {
      root.render(
        createElement(HistoryPanel, {
          rows: ROWS,
          query: '',
          onQueryChange,
          onClear,
          onRedownload,
          ...overrides,
        }),
      );
    });
    return { onQueryChange, onClear, onRedownload };
  }

  it('renders rows with status chips and filenames', () => {
    renderPanel();
    const rows = [...container.querySelectorAll('.cqd-history-row')];
    expect(rows).toHaveLength(2);
    expect(container.textContent).toContain('lecture-notes.pdf');
    expect(container.textContent).toContain('syllabus.docx');
    const chips = [...container.querySelectorAll('.cqd-history-state')];
    expect(chips[0].className).toContain('cqd-history-state-ok');
    expect(chips[1].className).toContain('cqd-history-state-fail');
    expect(chips[1].getAttribute('title')).toBe('SIZE_MISMATCH');
  });

  it('shows the empty state when there is no history', () => {
    renderPanel({ rows: [] });
    expect(container.querySelector('.cqd-history-empty')?.textContent).toContain('No downloads yet');
  });

  it('typing in the search box drives the query callback', () => {
    const { onQueryChange } = renderPanel();
    const input = container.querySelector('.cqd-history-search') as HTMLInputElement;
    // React listens to the value setter, not dispatched Events alone.
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setValue.call(input, 'lecture');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onQueryChange).toHaveBeenCalledWith('lecture');
  });

  it('clear-all fires the clear callback', () => {
    const { onClear } = renderPanel();
    (container.querySelector('.cqd-history-clear') as HTMLButtonElement).click();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('re-download fires with the row url', () => {
    const { onRedownload } = renderPanel();
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cqd-history-redownload')];
    buttons[1].click();
    expect(onRedownload).toHaveBeenCalledWith(ROWS[1].url);
  });
});
