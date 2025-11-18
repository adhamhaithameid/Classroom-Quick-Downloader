// filepath: entrypoints/index.ts
const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;

import {
  DOWNLOAD_ICON_SVG_URL,
  SUCCESS_ICON_SVG_URL,
  ERROR_ICON_SVG_URL,
} from './icons';

import { injectStyles } from './styles';

const INJECTED_ATTR = 'data-cqd-injected';
const RESCAN_INTERVAL_MS = 2000;
const RESCAN_DEBOUNCE_MS = 250;

// Loading / feedback durations (ms)
const LOADING_MIN_MS = 600;
const FEEDBACK_SUCCESS_MS = 2000;
const FEEDBACK_ERROR_MS = 4000;

const DRIVE_ANCHOR_SELECTOR =
  'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';

const ATTACHMENT_CONTAINER_SELECTOR = [
  '.KlRXdf', // common attachment card
  '.z3vRcc', // chip-like attachment
  '.VfPpkd-aPP78e', // Material card wrapper
  '[data-drive-id]', // Drive attachment
  '[data-id][data-item-id]', // metadata blocks
].join(', ');

const DRIVE_URL_PATTERNS: RegExp[] = [
  /https:\/\/drive\.google\.com\/file\/d\//,
  /https:\/\/drive\.google\.com\/open\?/,
  /https:\/\/drive\.google\.com\/uc\?/,
  /https:\/\/classroom\.google\.com\/drive\//,
];

let scanTimeoutId: number | null = null;
let observer: MutationObserver | null = null;

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

type FileMeta = {
  name?: string;
  ext?: string;
  kind?: string;
};

type PendingButton = {
  button: HTMLButtonElement;
  requestId: string;
  fileMeta?: FileMeta;
  startedAt: number;
};

type DownloadStatus = 'complete' | 'interrupted' | 'blocked_html';

const pendingButtons = new Map<string, PendingButton>();
let nextRequestSeq = 1;

/* -----------------------------------------------------
 * Environment / Page Checks
 * ---------------------------------------------------*/

function isGoogleClassroom(): boolean {
  if (typeof location === 'undefined') return false;
  if (location.hostname !== 'classroom.google.com') return false;
  return CLASSROOM_URL_PATTERN.test(location.href);
}

/* -----------------------------------------------------
 * Scanning / Observers
 * ---------------------------------------------------*/

function scheduleScan(): void {
  if (scanTimeoutId !== null) {
    window.clearTimeout(scanTimeoutId);
  }
  scanTimeoutId = window.setTimeout(() => {
    scanTimeoutId = null;
    scanForAttachments();
  }, RESCAN_DEBOUNCE_MS);
}

function setupObservers(): void {
  if (typeof document === 'undefined') return;

  if (!document.body) {
    window.addEventListener(
      'DOMContentLoaded',
      () => {
        setupObservers();
      },
      { once: true },
    );
    return;
  }

  if (observer) return;

  observer = new MutationObserver((mutations) => {
    const hasChildListChange = mutations.some(
      (m) => m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0),
    );
    if (hasChildListChange) {
      scheduleScan();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.setInterval(() => {
    scheduleScan();
  }, RESCAN_INTERVAL_MS);

  scheduleScan();
}

/**
 * Main scan: inject single-file buttons.
 */
function scanForAttachments(): void {
  if (!isGoogleClassroom()) return;
  if (typeof document === 'undefined') return;

  injectSingleFileButtons();
}

/* -----------------------------------------------------
 * Single-file buttons
 * ---------------------------------------------------*/

function injectSingleFileButtons(): void {
  // Anchors with Drive URLs
  const anchors = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(DRIVE_ANCHOR_SELECTOR),
  );

  for (const anchor of anchors) {
    const url = extractDriveUrlFromAnchor(anchor);
    if (!url) continue;

    const container =
      (anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) as HTMLElement | null) ||
      anchor.parentElement ||
      anchor;

    if (!container) continue;
    if (hasInjectedButton(container)) continue;

    injectButtonIntoAttachment(container, url);
  }

  // Elements with Drive metadata
  const metaElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]',
    ),
  );

  for (const el of metaElements) {
    if (hasInjectedButton(el)) continue;
    const url = findDriveUrl(el);
    if (!url) continue;

    injectButtonIntoAttachment(el, url);
  }
}

/* -----------------------------------------------------
 * URL / DOM Helpers
 * ---------------------------------------------------*/

function hasInjectedButton(container: HTMLElement): boolean {
  return !!container.querySelector(`[${INJECTED_ATTR}="true"]`);
}

function extractDriveUrlFromAnchor(anchor: HTMLAnchorElement): string | null {
  const href = anchor.href;
  if (!href) return null;
  const isDriveUrl = DRIVE_URL_PATTERNS.some((re) => re.test(href));
  return isDriveUrl ? href : null;
}

function findDriveUrl(element: HTMLElement): string | null {
  const nearAnchor =
    element.querySelector<HTMLAnchorElement>(DRIVE_ANCHOR_SELECTOR) ||
    (element.closest(DRIVE_ANCHOR_SELECTOR) as HTMLAnchorElement | null);

  if (nearAnchor) {
    const href = extractDriveUrlFromAnchor(nearAnchor);
    if (href) return href;
  }

  const driveId = element.getAttribute('data-drive-id') || element.getAttribute('data-id');
  if (driveId) {
    const anchorWithId =
      document.querySelector<HTMLAnchorElement>(`a[data-drive-id="${driveId}"]`) ||
      document.querySelector<HTMLAnchorElement>(`a[data-id="${driveId}"]`) ||
      document.querySelector<HTMLAnchorElement>(`a[href*="${driveId}"]`);

    if (anchorWithId) {
      const href = extractDriveUrlFromAnchor(anchorWithId);
      if (href) return href;
    }

    // Fallback: best-effort direct download URL from Drive ID
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
  }

  return null;
}

/**
 * Convert any view / classroom-proxy URL to a direct download URL when possible.
 */
function toDownloadUrl(originalUrl: string, depth = 0): string {
  if (depth > 3) return originalUrl;

  try {
    const parsed = new URL(originalUrl, location.href);
    const hostname = parsed.hostname;
    const pathname = parsed.pathname;

    if (hostname === 'drive.google.com') {
      // auth_warmup unwrapping
      if (pathname.startsWith('/auth_warmup')) {
        const cont = parsed.searchParams.get('continue');
        if (cont) return toDownloadUrl(cont, depth + 1);

        const id = parsed.searchParams.get('id');
        if (id) {
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        }
        return originalUrl;
      }

      const fileMatch = pathname.match(/^\/file\/d\/([^/]+)/);
      if (fileMatch) {
        const id = fileMatch[1];
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
      }

      if (pathname === '/open') {
        const id = parsed.searchParams.get('id');
        if (id) {
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        }
      }

      if (pathname === '/uc') {
        parsed.searchParams.set('export', 'download');
        return parsed.toString();
      }
    }

    if (hostname === 'classroom.google.com' && pathname.startsWith('/drive')) {
      const id =
        parsed.searchParams.get('id') ||
        parsed.searchParams.get('resourceId') ||
        parsed.searchParams.get('fileId');
      if (id) {
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
      }
    }

    return originalUrl;
  } catch {
    return originalUrl;
  }
}

/* -----------------------------------------------------
 * File metadata extraction (from DOM)
 * ---------------------------------------------------*/

function extractFileMeta(container: HTMLElement, url: string): FileMeta {
  let name: string | undefined;

  const tooltip =
    container.getAttribute('data-tooltip') ||
    container.getAttribute('aria-label') ||
    container.getAttribute('title');

  if (tooltip && tooltip.trim()) {
    name = tooltip.trim();
  } else {
    const text = (container.textContent || '').trim();
    if (text) {
      const firstLine = text.split('\n')[0].trim();
      if (firstLine) name = firstLine;
    }
  }

  if (!name) {
    try {
      const u = new URL(url);
      name = decodeURIComponent(u.pathname.split('/').pop() || '');
    } catch {
      // ignore
    }
  }

  let ext: string | undefined;
  if (name) {
    const m = name.match(/\.([a-zA-Z0-9]{1,6})$/);
    if (m) ext = m[1].toLowerCase();
  }

  if (!ext) {
    try {
      const u = new URL(url);
      const path = u.pathname;
      const m2 = path.match(/\.([a-zA-Z0-9]{1,6})$/);
      if (m2) ext = m2[1].toLowerCase();
    } catch {
      // ignore
    }
  }

  let kind: string | undefined;
  if (ext) {
    if (['pdf'].includes(ext)) kind = 'pdf';
    else if (['doc', 'docx'].includes(ext)) kind = 'doc';
    else if (['xls', 'xlsx', 'csv'].includes(ext)) kind = 'sheet';
    else if (['ppt', 'pptx'].includes(ext)) kind = 'slide';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) kind = 'image';
    else if (['zip', 'rar', '7z'].includes(ext)) kind = 'archive';
    else if (['mp4', 'mov', 'mkv', 'avi'].includes(ext)) kind = 'video';
    else if (['html', 'htm'].includes(ext)) kind = 'html';
    else kind = 'other';
  }

  return { name, ext, kind };
}

/* -----------------------------------------------------
 * Button injection
 * ---------------------------------------------------*/

function injectButtonIntoAttachment(container: HTMLElement, url: string): void {
  if (!url) return;

  const computed = window.getComputedStyle(container);
  if (computed.position === 'static') {
    container.style.position = 'relative';
  }

  const directUrl = toDownloadUrl(url);
  const fileMeta = extractFileMeta(container, directUrl);
  const button = createDownloadButton(container, directUrl, fileMeta);

  const iconEl = button.querySelector<HTMLElement>('.cqd-download-icon');
  if (iconEl) {
    iconEl.classList.add('cqd-icon-medium');
  }

  container.appendChild(button);
}

/* -----------------------------------------------------
 * Button state helpers
 * ---------------------------------------------------*/

function getButtonState(button: HTMLButtonElement): ButtonState {
  if (button.classList.contains('cqd-loading')) return 'loading';
  if (button.classList.contains('cqd-success')) return 'success';
  if (button.classList.contains('cqd-error')) return 'error';
  return 'idle';
}

function setButtonState(
  button: HTMLButtonElement,
  state: ButtonState,
  options?: { userMessage?: string },
): void {
  const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
  const label = button.querySelector<HTMLSpanElement>('.cqd-label');
  const errorDetail = button.querySelector<HTMLSpanElement>('.cqd-error-detail');
  if (!icon || !label || !errorDetail) return;

  // Reset all state classes / styles
  button.classList.remove('cqd-loading', 'cqd-success', 'cqd-error');
  icon.classList.remove('cqd-spinner');
  icon.textContent = '';
  button.disabled = false;
  button.style.backgroundColor = '#1a73e8';
  label.textContent = 'Download';
  errorDetail.textContent = '';

  // Default: download icon
  icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
  icon.style.backgroundSize = '';

  switch (state) {
    case 'idle':
      break;

    case 'loading':
      button.classList.add('cqd-loading');
      button.disabled = true;
      label.textContent = 'Downloading…';
      icon.classList.add('cqd-spinner');
      icon.style.backgroundImage = 'none';
      break;

    case 'success':
      button.classList.add('cqd-success');
      button.style.backgroundColor = '#188038'; // Google green
      label.textContent = 'Downloaded';
      icon.style.backgroundImage = `url("${SUCCESS_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;

    case 'error':
      button.classList.add('cqd-error');
      button.style.backgroundColor = '#e05952';
      label.textContent = 'Error';
      icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      errorDetail.textContent =
        options?.userMessage ||
        'Something went wrong while downloading this file.';
      break;
  }
}

/* -----------------------------------------------------
 * Button factory
 * ---------------------------------------------------*/

function createDownloadButton(
  _container: HTMLElement,
  url: string,
  fileMeta: FileMeta,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cqd-download-btn';
  button.setAttribute(INJECTED_ATTR, 'true');
  button.setAttribute('aria-label', 'Quick download attachment');
  button.setAttribute('title', 'Quick download');

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'cqd-icon-wrapper';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'cqd-download-icon';
  iconWrapper.appendChild(iconSpan);

  const label = document.createElement('span');
  label.className = 'cqd-label';
  label.textContent = 'Download';

  const errorDetail = document.createElement('span');
  errorDetail.className = 'cqd-error-detail';
  errorDetail.textContent = '';

  button.appendChild(iconWrapper);
  button.appendChild(label);
  button.appendChild(errorDetail);

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await handleSingleDownloadClick(button, url, fileMeta);
  });

  button.addEventListener('auxclick', async (event) => {
    if (event.button !== 1) return; // middle-click only
    event.preventDefault();
    event.stopPropagation();
    await handleSingleDownloadClick(button, url, fileMeta);
  });

  return button;
}

/* -----------------------------------------------------
 * Single download flow with states
 * ---------------------------------------------------*/

async function handleSingleDownloadClick(
  button: HTMLButtonElement,
  url: string,
  fileMeta: FileMeta,
): Promise<void> {
  if (!url) return;

  // Only start download from the IDLE state
  const currentState = getButtonState(button);
  if (currentState !== 'idle') return;

  const requestId = `cqd-${Date.now()}-${nextRequestSeq++}`;
  const startedAt = Date.now();

  setButtonState(button, 'loading');

  const startResult = await startBackgroundDownload(requestId, url, fileMeta);

  if (!startResult.ok) {
    await ensureMinLoading(startedAt);
    await showErrorState(button, startResult.userMessage);
    return;
  }

  // Track this button until background tells us the final status
  pendingButtons.set(requestId, {
    button,
    requestId,
    fileMeta,
    startedAt,
  });
}

function startBackgroundDownload(
  requestId: string,
  url: string,
  fileMeta: FileMeta,
): Promise<{ ok: boolean; userMessage?: string }> {
  const finalUrl = toDownloadUrl(url);

  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      resolve({
        ok: false,
        userMessage:
          'The extension runtime is not available. Try reloading the extension.',
      });
      return;
    }

    try {
      chrome.runtime.sendMessage(
        {
          type: 'CQD_DOWNLOAD',
          url: finalUrl,
          requestId,
          fileMeta,
        },
        (response?: {
          started?: boolean;
          requestId?: string;
          userMessage?: string;
        }) => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.warn('[CQD] sendMessage error:', err.message);
            resolve({
              ok: false,
              userMessage:
                'Quick Downloader could not talk to its background process. Try reloading the extension.',
            });
            return;
          }

          if (!response || response.started === false) {
            resolve({
              ok: false,
              userMessage:
                response?.userMessage ||
                'Could not start the download for this file.',
            });
            return;
          }

          resolve({ ok: true });
        },
      );
    } catch (e) {
      console.warn('[CQD] sendMessage threw:', e);
      resolve({
        ok: false,
        userMessage:
          'Something went wrong before starting the download. Please try again.',
      });
    }
  });
}

/* -----------------------------------------------------
 * Handle download status messages from background
 * ---------------------------------------------------*/

function setupDownloadStatusListener(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (!message || message.type !== 'CQD_DOWNLOAD_STATUS') return;

    const {
      requestId,
      status,
      userMessage,
    }: {
      requestId: string;
      status: DownloadStatus;
      userMessage?: string;
    } = message;

    const pending = pendingButtons.get(requestId);
    if (!pending) return;

    void handleDownloadStatusForButton(pending, status, userMessage);
  });
}

async function handleDownloadStatusForButton(
  pending: PendingButton,
  status: DownloadStatus,
  userMessage?: string,
): Promise<void> {
  const { button, startedAt, requestId } = pending;

  await ensureMinLoading(startedAt);

  if (status === 'complete') {
    setButtonState(button, 'success');
    await delay(FEEDBACK_SUCCESS_MS);
    setButtonState(button, 'idle');
  } else {
    await showErrorState(button, userMessage);
  }

  pendingButtons.delete(requestId);
}

/* -----------------------------------------------------
 * Error state that respects hover (message stays while hovering)
 * ---------------------------------------------------*/

async function showErrorState(
  button: HTMLButtonElement,
  userMessage?: string,
): Promise<void> {
  setButtonState(button, 'error', { userMessage });

  const earliestReset = Date.now() + FEEDBACK_ERROR_MS;

  while (true) {
    await delay(200);

    if (getButtonState(button) !== 'error') {
      // State was changed externally
      return;
    }

    const now = Date.now();
    if (now < earliestReset) {
      continue;
    }

    // If still hovering, keep showing the error squircle
    const hovered = button.matches(':hover');
    if (!hovered) {
      setButtonState(button, 'idle');
      return;
    }
  }
}

/* -----------------------------------------------------
 * Utils
 * ---------------------------------------------------*/

async function ensureMinLoading(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < LOADING_MIN_MS) {
    await delay(LOADING_MIN_MS - elapsed);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/* -----------------------------------------------------
 * Init
 * ---------------------------------------------------*/

function initContentScript(): void {
  if (!isGoogleClassroom()) return;
  injectStyles();
  setupDownloadStatusListener();
  setupObservers();
}

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    initContentScript();
  },
});
