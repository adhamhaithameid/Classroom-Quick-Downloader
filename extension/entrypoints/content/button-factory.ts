// filepath: extension/entrypoints/content/button-factory.ts
/**
 * Download button creation and event handling.
 */

import type { FileMeta, ButtonState } from './types';
import { INJECTED_ATTR, PROCESSED_ATTR } from './state';
import { toDownloadUrl } from './url-utils';
import { extractFileMeta } from './file-meta';
import { getButtonState, setButtonState } from './button-state';
import { handleCancelClick, handleSingleDownloadClick } from './download-handler';
import { DOWNLOAD_ICON_SVG_URL, CANCEL_ICON_SVG_URL } from './icons';
import { t } from './i18n';
import { isPageDark } from './theme';

/**
 * Create a download button for an attachment.
 */
export function createDownloadButton(
  _container: HTMLElement,
  url: string,
  fileMeta: FileMeta
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-btn';
  if (isPageDark()) {
    button.classList.add('cqd-theme-dark');
  }
  button.setAttribute(INJECTED_ATTR, 'true');
  button.setAttribute('aria-label', `${t('ariaDownload')} ${fileMeta.name || ''}`);
  button.setAttribute('title', t('titleQuick'));

  try {
    if (url) (button.dataset as any).cqdUrl = url;
    if (fileMeta?.name) (button.dataset as any).cqdName = fileMeta.name;
    if (fileMeta?.ext) (button.dataset as any).cqdExt = fileMeta.ext;
  } catch { /* ignore */ }

  // Create button internals
  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'cqd-icon-wrapper';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'cqd-download-icon';
  iconWrapper.appendChild(iconSpan);

  const label = document.createElement('span');
  label.className = 'cqd-label';
  label.textContent = t('download');
  label.setAttribute('data-cancel-label', t('cancel') || 'Cancel');

  const errorDetail = document.createElement('span');
  errorDetail.className = 'cqd-error-detail';

  button.appendChild(iconWrapper);
  button.appendChild(label);
  button.appendChild(errorDetail);

  // Mouse enter: show cancel if active
  button.addEventListener('mouseenter', () => {
    (button.dataset as any).cqdMouseOver = 'true';
    const s = getButtonState(button);
    if (s === 'loading' || s === 'trying') {
      button.classList.add('cqd-cancel');
    }
  });

  // Mouse leave: revert to active state
  button.addEventListener('mouseleave', () => {
    (button.dataset as any).cqdMouseOver = 'false';
    // If we added cqd-cancel on hover, remove it now
    if (button.classList.contains('cqd-cancel')) {
      // Check if we should actually remove it (only if underlying state is loading/trying)
      // But getButtonState returns 'cancel' if cqd-cancel is present.
      // We rely on the fact that if we added it purely for hover, we can remove it.
      // If the state was legitimately set to 'cancel' via setButtonState, cqd-loading would have been removed.
      // But cqd-cancel class is the same for both hover and permanent state.

      const isUnderlyingLoading = button.classList.contains('cqd-loading');
      const isUnderlyingTrying = button.classList.contains('cqd-trying');

      // Only remove cqd-cancel if there is an underlying active state we want to revert to.
      // If there is NO underlying state (e.g. permanent cancel), we might have an issue?
      // But permanent cancel state replaces all classes, so cqd-loading is NOT present.
      // So checking for cqd-loading / cqd-trying ensures we only revert if we were in those states.

      if (isUnderlyingLoading || isUnderlyingTrying) {
        button.classList.remove('cqd-cancel');
      }
    }
  });

  // Click handler
  const clickHandler = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();

    const currentState = getButtonState(button);
    if (currentState === 'cancel') {
      delete (button.dataset as any).cqdMouseOver;
      await handleCancelClick(button);
      return;
    }

    await handleSingleDownloadClick(button, url, fileMeta);
  };

  button.addEventListener('click', clickHandler);
  button.addEventListener('auxclick', (e) => {
    if (e.button === 1) clickHandler(e);
  });

  return button;
}

/**
 * Inject download button into an attachment container.
 */
export function injectButtonIntoAttachment(
  container: HTMLElement,
  url: string
): void {
  if (!url) return;
  container.setAttribute(PROCESSED_ATTR, 'true');

  const computed = window.getComputedStyle(container);
  if (computed.position === 'static') container.style.position = 'relative';

  const directUrl = toDownloadUrl(url);
  const fileMeta = extractFileMeta(container, directUrl);

  const button = createDownloadButton(container, directUrl, fileMeta);
  const iconEl = button.querySelector<HTMLElement>('.cqd-download-icon');
  if (iconEl) iconEl.classList.add('cqd-icon-medium');

  container.appendChild(button);
}
