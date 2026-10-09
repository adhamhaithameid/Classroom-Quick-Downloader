/**
 * Route B driver tests — the REAL renderButton / renderFlagBadge /
 * setButtonStateV2 run against the REAL captured fixture markup (no iframe
 * needed; jsdom documents behave the same for these renderers).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mixedLinksPostEn from '../../extension/tests/fixtures/classroom/mixed-links-post-en.html?raw';
import {
  DEFAULT_DRIVER_OPTIONS,
  findAttachmentAnchors,
  findPosts,
  forceButtonState,
  injectRealStylesInto,
  renderButtonsIn,
  renderFlagVerdictIn,
  removeSimulatorStyles,
} from '../src/fixtures/classroom-driver';

describe('classroom driver — real renderers on real fixture markup', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = mixedLinksPostEn;
  });

  afterEach(() => {
    removeSimulatorStyles();
    document.body.innerHTML = '';
  });

  it('injects the real stylesheets and renders real buttons', () => {
    injectRealStylesInto(document, true);
    expect(document.getElementById('sim-cqd-v2-button-styles')?.textContent).toContain(
      '.cqd-download-btn',
    );
    expect(document.getElementById('sim-cqd-v2-flag-styles')?.textContent).toContain('.cqd-flag');
    // The V1 sheet copy carries the shared placeholder-substituted sheet.
    expect(document.getElementById('sim-cqd-style')?.textContent).toContain('cancelClick');

    expect(findPosts(document)).toHaveLength(1);
    expect(findAttachmentAnchors(document)).toHaveLength(2);

    renderButtonsIn(document, {
      renderButtons: true,
      renderDownloadAll: true,
    });

    const single = document.querySelectorAll('.cqd-download-btn[data-cqd-injected]');
    expect(single).toHaveLength(2);
    expect(single[0]?.getAttribute('data-cqd-file-id')).toBe('fixture-file-0');

    // The group button anchors before the post header (collapsed-post case).
    const group = document.querySelector<HTMLButtonElement>('.cqd-download-all-btn');
    expect(group).not.toBeNull();
    expect(group!.nextElementSibling?.tagName).toBe('HEADER');
    expect(group!.querySelector('.cqd-download-all-sub')?.textContent).toBe('2 files');
  });

  it('forces state classes through the real state machine', () => {
    renderButtonsIn(document, { renderButtons: true, renderDownloadAll: false });
    forceButtonState(document, 'loading');
    const button = document.querySelector<HTMLButtonElement>('.cqd-download-btn');
    expect(button?.classList.contains('cqd-loading')).toBe(true);
    expect(button?.querySelector('.cqd-label')?.textContent).toBe('Downloading…');

    forceButtonState(document, 'error', 'Drive returned 403');
    expect(button?.classList.contains('cqd-error')).toBe(true);
    expect(button?.querySelector('.cqd-error-detail')?.textContent).toBe('Drive returned 403');
  });

  it('renders flag verdicts through the real flag renderer', () => {
    injectRealStylesInto(document, false);
    renderFlagVerdictIn(document, {
      ...DEFAULT_DRIVER_OPTIONS,
      flagVerdict: 'comment',
      flagCommentCount: 5,
    });
    const badge = document.querySelector<HTMLElement>('.cqd-comment-badge');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-cqd-comment-count')).toBe('5');
    expect(document.body.getAttribute('data-cqd-dir')).toBe('ltr');
  });
});
