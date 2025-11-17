// filepath: entrypoints/content.ts
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

/* -----------------------------------------------------
 * Environment / Page Checks
 * ---------------------------------------------------*/

function isGoogleClassroom(): boolean {
  if (typeof location === 'undefined') return false;
  if (location.hostname !== 'classroom.google.com') return false;
  return CLASSROOM_URL_PATTERN.test(location.href);
}

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
 * Button injection
 * ---------------------------------------------------*/

function injectButtonIntoAttachment(container: HTMLElement, url: string): void {
  if (!url) return;

  const computed = window.getComputedStyle(container);
  if (computed.position === 'static') {
    container.style.position = 'relative';
  }

  const button = createDownloadButton(url);

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

function setButtonState(button: HTMLButtonElement, state: ButtonState): void {
  const icon = button.querySelector<HTMLElement>('.cqd-download-icon');
  const label = button.querySelector<HTMLSpanElement>('.cqd-label');
  if (!icon || !label) return;

  // Reset all state classes / styles
  button.classList.remove('cqd-loading', 'cqd-success', 'cqd-error');
  icon.classList.remove('cqd-spinner');
  icon.textContent = '';
  button.disabled = false;
  button.style.backgroundColor = '#1a73e8';
  label.textContent = 'Download';

  // Default: download icon
  icon.style.backgroundImage = `url("${DOWNLOAD_ICON_SVG_URL}")`;
  icon.style.backgroundSize = '20px 20px';

  switch (state) {
    case 'idle':
      // default circle + download icon
      break;

    case 'loading':
      button.classList.add('cqd-loading');
      button.disabled = true;
      label.textContent = 'Downloading…';
      icon.classList.add('cqd-spinner');
      // Spinner uses border; hide background image to avoid visual clash
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
      button.style.backgroundColor = '#e05952'; // bright red
      label.textContent = 'Error';
      icon.style.backgroundImage = `url("${ERROR_ICON_SVG_URL}")`;
      icon.style.backgroundSize = '20px 20px';
      break;
  }
}

/* -----------------------------------------------------
 * Button factory
 * ---------------------------------------------------*/

function createDownloadButton(url: string): HTMLButtonElement {
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

  button.appendChild(iconWrapper);
  button.appendChild(label);

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await handleSingleDownloadClick(button, url);
  });

  button.addEventListener('auxclick', async (event) => {
    if (event.button !== 1) return; // middle-click only
    event.preventDefault();
    event.stopPropagation();
    await handleSingleDownloadClick(button, url);
  });

  return button;
}

/* -----------------------------------------------------
 * Single download flow with states
 * ---------------------------------------------------*/

async function handleSingleDownloadClick(
  button: HTMLButtonElement,
  url: string,
): Promise<void> {
  if (!url) return;
  if (getButtonState(button) === 'loading') return;

  setButtonState(button, 'loading');
  const start = Date.now();

  const ok = await downloadFile(url);

  const elapsed = Date.now() - start;
  if (elapsed < LOADING_MIN_MS) {
    await delay(LOADING_MIN_MS - elapsed);
  }

  if (ok) {
    setButtonState(button, 'success');
    await delay(FEEDBACK_SUCCESS_MS);
  } else {
    setButtonState(button, 'error');
    await delay(FEEDBACK_ERROR_MS);
  }

  setButtonState(button, 'idle');
}

/* -----------------------------------------------------
 * Download logic (background + fallback)
 * ---------------------------------------------------*/

function downloadFile(rawUrl: string): Promise<boolean> {
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return Promise.resolve(false);

  const finalUrl = toDownloadUrl(rawUrl);

  // Offline? this will likely fail; just show error state.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.resolve(false);
  }

  // If we somehow still have auth_warmup at this point, treat as failure.
  if (/https:\/\/drive\.google\.com\/auth_warmup/.test(finalUrl)) {
    return Promise.resolve(false);
  }

  const hasChromeRuntime =
    typeof chrome !== 'undefined' &&
    !!chrome.runtime &&
    typeof chrome.runtime.sendMessage === 'function';

  if (hasChromeRuntime) {
    return new Promise<boolean>((resolve) => {
      let resolved = false;

      try {
        chrome.runtime.sendMessage(
          { type: 'CQD_DOWNLOAD', url: finalUrl },
          (response?: { ok?: boolean; error?: string }) => {
            const err = chrome.runtime.lastError;
            if (err) {
              console.warn('[CQD] sendMessage error:', err.message);
              if (!resolved) {
                resolved = true;
                // ❌ No fallback tab any more – just error state
                resolve(false);
              }
              return;
            }

            if (!response || response.ok === false) {
              if (response?.error) {
                console.warn('[CQD] background download error:', response.error);
              }
              if (!resolved) {
                resolved = true;
                resolve(false);
              }
              return;
            }

            if (!resolved) {
              resolved = true;
              resolve(true);
            }
          },
        );

        // Safety timeout in case the service worker dies / never responds
        window.setTimeout(() => {
          if (!resolved) {
            console.warn('[CQD] background download timed out');
            resolved = true;
            resolve(false);
          }
        }, 4000);
      } catch (e) {
        console.warn('[CQD] sendMessage threw:', e);
        if (!resolved) resolve(false);
      }
    });
  }

  // No background available: treat as error (no tabs opened).
  return Promise.resolve(false);
}


/**
 * Fallback: synthetic anchor click (may open tab, but still downloads).
 */
function fallbackAnchorDownload(url: string): void {
  if (typeof document === 'undefined') return;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  window.setTimeout(() => {
    anchor.remove();
  }, 0);
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
  setupObservers();
}

export default defineContentScript({
  matches: ['https://classroom.google.com/*'],
  runAt: 'document_idle',
  main() {
    initContentScript();
  },
});
