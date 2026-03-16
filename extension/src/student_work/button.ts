// filepath: extension/src/student_work/button.ts

import type { FileMeta } from '../../entrypoints/content/types';
import { getButtonState, setButtonState } from '../../entrypoints/content/button-state';
import {
  handleCancelClick,
  handleSingleDownloadClick,
  showErrorState,
} from '../../entrypoints/content/download-handler';
import { CANCEL_ICON_SVG_URL } from '../../entrypoints/content/icons';
import { t } from '../../entrypoints/content/i18n';
import { isPageDark } from '../../entrypoints/content/theme';
import {
  resolveStudentWorkUrl,
  type ResolveStudentWorkResult,
} from './resolver';

export interface StudentWorkButtonOptions {
  resolve?: (rawUrl: string, signal?: AbortSignal) => Promise<ResolveStudentWorkResult>;
}

const resolveControllers = new WeakMap<HTMLButtonElement, AbortController>();

function resolveMessageFromReason(reason: string): string {
  if (reason.includes('resolver_timeout')) {
    return 'Could not resolve file link in time.';
  }
  if (reason.includes('aborted')) {
    return t('cancelled') || 'Cancelled';
  }
  return 'Could not resolve Student Work file link.';
}

function withStudentWorkRequestNonce(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, window.location.href);
    parsed.searchParams.set('cqd_sw_req', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function buildButtonSkeleton(fileMeta: FileMeta): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-btn';
  button.dataset.cqdSw = 'true';
  if (isPageDark()) {
    button.classList.add('cqd-theme-dark');
  }

  button.setAttribute('aria-label', `${t('ariaDownload')} ${fileMeta.name || ''}`);
  button.setAttribute('title', t('titleQuick'));

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

  button.addEventListener('mouseenter', () => {
    button.dataset.cqdMouseOver = 'true';
    const state = getButtonState(button);
    if (state === 'loading' || state === 'trying') {
      button.classList.add('cqd-cancel');
      const btnLabel = button.querySelector<HTMLSpanElement>('.cqd-label');
      const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
      if (btnLabel) btnLabel.textContent = t('cancel') || 'Cancel';
      if (icon) {
        icon.className = 'cqd-download-icon';
        icon.style.backgroundImage = `url("${CANCEL_ICON_SVG_URL}")`;
      }
    }
  });

  button.addEventListener('mouseleave', () => {
    button.dataset.cqdMouseOver = 'false';
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
      } else if (isUnderlyingTrying) {
        if (btnLabel) btnLabel.textContent = t('trying') || 'Retrying...';
        if (icon) {
          icon.className = 'cqd-download-icon cqd-spinner';
          icon.style.backgroundImage = 'none';
        }
      }
    }
  });

  return button;
}

export function createStudentWorkButton(
  sourceUrl: string,
  fileMeta: FileMeta,
  options: StudentWorkButtonOptions = {},
): HTMLButtonElement {
  const resolver = options.resolve ?? ((rawUrl: string, signal?: AbortSignal) =>
    resolveStudentWorkUrl(rawUrl, { signal }));

  const button = buildButtonSkeleton(fileMeta);

  if (sourceUrl) button.dataset.cqdSwSourceUrl = sourceUrl;
  if (fileMeta?.name) button.dataset.cqdName = fileMeta.name;
  if (fileMeta?.ext) button.dataset.cqdExt = fileMeta.ext;

  const clickHandler = async (event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    const currentState = getButtonState(button);
    if (currentState === 'cancel') {
      const resolvingController = resolveControllers.get(button);
      if (resolvingController) {
        resolvingController.abort();
        resolveControllers.delete(button);
        setButtonState(button, 'cancelled');
        window.setTimeout(() => {
          if (getButtonState(button) === 'cancelled') {
            setButtonState(button, 'idle');
          }
        }, 900);
        return;
      }

      await handleCancelClick(button);
      return;
    }

    if (currentState !== 'idle') return;
    if (!sourceUrl) return;

    const controller = new AbortController();
    resolveControllers.set(button, controller);
    setButtonState(button, 'trying', { userMessage: 'Resolving…' });

    let resolved: ResolveStudentWorkResult;
    try {
      resolved = await resolver(sourceUrl, controller.signal);
    } finally {
      if (resolveControllers.get(button) === controller) {
        resolveControllers.delete(button);
      }
    }

    if (controller.signal.aborted) {
      return;
    }

    if (!resolved.ok || !resolved.url) {
      await showErrorState(button, resolveMessageFromReason(resolved.reason));
      return;
    }

    const requestScopedUrl = withStudentWorkRequestNonce(resolved.url);
    button.dataset.cqdUrl = requestScopedUrl;

    // Move from resolving visual to real download lifecycle.
    setButtonState(button, 'idle');
    await handleSingleDownloadClick(button, requestScopedUrl, fileMeta);
  };

  button.addEventListener('click', clickHandler);
  button.addEventListener('auxclick', (event) => {
    if (event.button === 1) {
      void clickHandler(event);
    }
  });

  return button;
}

