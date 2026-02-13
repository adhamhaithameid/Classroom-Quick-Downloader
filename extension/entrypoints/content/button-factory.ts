// filepath: extension/entrypoints/content/button-factory.ts
/**
 * Download button creation and event handling.
 */

import type { FileMeta, ButtonState } from './types';
import { INJECTED_ATTR, PROCESSED_ATTR } from './state';
import { toDownloadUrl } from './url-utils';
import { extractFileMeta } from './file-meta';
import { getButtonState, setButtonState, updateAriaLabel } from './button-state';
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

  const errorDetail = document.createElement('span');
  errorDetail.className = 'cqd-error-detail';

  button.appendChild(iconWrapper);
  button.appendChild(label);
  button.appendChild(errorDetail);

  // Shared interaction handlers (Mouse + Keyboard)
  const handleInteractionStart = () => {
    (button.dataset as any).cqdMouseOver = 'true';
    const s = getButtonState(button);
    if (s === 'loading' || s === 'trying') {
      button.classList.add('cqd-cancel');
      const btnLabel = button.querySelector<HTMLSpanElement>('.cqd-label');
      const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
      if (btnLabel) btnLabel.textContent = t('cancel') || 'Cancel';
      if (icon) {
        icon.className = 'cqd-download-icon';
        icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      }
      updateAriaLabel(button, 'cancel');
    }
  };

  const handleInteractionEnd = () => {
    (button.dataset as any).cqdMouseOver = 'false';
    const wasCancel = button.classList.contains('cqd-cancel');
    const isUnderlyingLoading = button.classList.contains('cqd-loading');
    const isUnderlyingTrying = button.classList.contains('cqd-trying');

    if (wasCancel) {
      button.classList.remove('cqd-cancel');
      const btnLabel = button.querySelector<HTMLSpanElement>('.cqd-label');
      const icon = button.querySelector<HTMLElement>('.cqd-download-icon');

      if (isUnderlyingLoading) {
        if (btnLabel) btnLabel.textContent = t('downloading') || 'Downloading...';
        if (icon) {
          icon.className = 'cqd-download-icon cqd-spinner';
          icon.style.backgroundImage = 'none';
        }
        updateAriaLabel(button, 'loading');
      } else if (isUnderlyingTrying) {
        if (btnLabel) btnLabel.textContent = t('trying') || 'Retrying...';
        if (icon) {
          icon.className = 'cqd-download-icon cqd-spinner';
          icon.style.backgroundImage = 'none';
        }
        updateAriaLabel(button, 'trying');
      }
    }
  };

  button.addEventListener('mouseenter', handleInteractionStart);
  button.addEventListener('mouseleave', handleInteractionEnd);
  button.addEventListener('focus', handleInteractionStart);
  button.addEventListener('blur', handleInteractionEnd);

  // Keydown handler for keyboard cancel
  button.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      const s = getButtonState(button);
      // If visually showing cancel (via interaction) OR underlying state is loading/trying
      if (s === 'cancel' || s === 'loading' || s === 'trying') {
        e.preventDefault();
        e.stopPropagation();
        delete (button.dataset as any).cqdMouseOver;
        await handleCancelClick(button);
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
